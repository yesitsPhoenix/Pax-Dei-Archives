-- Read-only Lore privacy preflight for the target Supabase database.
-- Run as a database administrator before applying 202609230001. It returns
-- counts and catalog metadata only; no research-note text or JWT is returned.
-- Review any callable function found below, especially if it mentions
-- research or builds a query dynamically. Static catalog scans cannot prove
-- that a function never exposes notes.

with
table_state as (
  select c.relrowsecurity as rls_enabled,
         c.relforcerowsecurity as rls_forced,
         pg_get_userbyid(c.relowner) as owner
  from pg_class c
  where c.oid = 'public.lore_items'::regclass
),
document_counts as (
  select count(*) as documents,
         count(*) filter (where research is not null) as documents_with_research,
         count(distinct slug) as distinct_slugs,
         count(distinct category) as categories
  from public.lore_items
),
role_access as (
  select role_name,
         has_table_privilege(role_name, 'public.lore_items', 'SELECT') as base_select,
         has_column_privilege(role_name, 'public.lore_items', 'research', 'SELECT') as research_select,
         has_table_privilege(role_name, 'public.lore_items', 'INSERT') as base_insert,
         has_table_privilege(role_name, 'public.lore_items', 'UPDATE') as base_update,
         has_table_privilege(role_name, 'public.lore_items', 'DELETE') as base_delete,
         case when to_regclass('public.lore_items_public') is not null
           then has_table_privilege(role_name, 'public.lore_items_public', 'SELECT')
           else false end as public_view_select
  from unnest(array['anon', 'authenticated', 'service_role']) as roles(role_name)
),
policies as (
  select policyname, permissive, roles, cmd, qual, with_check
  from pg_policies
  where schemaname = 'public' and tablename = 'lore_items'
),
research_views as (
  select distinct ns.nspname as schema_name,
         view_rel.relname as view_name,
         view_rel.relkind as relation_kind,
         has_table_privilege('anon', view_rel.oid, 'SELECT') as anon_select,
         has_table_privilege('authenticated', view_rel.oid, 'SELECT') as authenticated_select
  from pg_rewrite rewrite
  join pg_class view_rel on view_rel.oid = rewrite.ev_class
  join pg_namespace ns on ns.oid = view_rel.relnamespace
  join pg_depend dependency on dependency.objid = rewrite.oid
  join pg_attribute column_ref
    on column_ref.attrelid = dependency.refobjid
   and column_ref.attnum = dependency.refobjsubid
  where dependency.refobjid = 'public.lore_items'::regclass
    and column_ref.attname = 'research'
    and view_rel.relkind in ('v', 'm')
),
lore_functions as (
  select ns.nspname as schema_name,
         p.oid::regprocedure::text as signature,
         has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
         pg_get_functiondef(p.oid) ~* '\mresearch\M' as mentions_research,
         pg_get_functiondef(p.oid) ~* 'select\s+\*' as mentions_select_star
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where p.prokind in ('f', 'p')
    and ns.nspname not in ('pg_catalog', 'information_schema')
    and pg_get_functiondef(p.oid) ~* '\mlore_items\M'
),
slug_constraints as (
  select conname, contype, pg_get_constraintdef(oid) as definition
  from pg_constraint
  where conrelid = 'public.lore_items'::regclass
    and contype in ('p', 'u')
)
select jsonb_pretty(jsonb_build_object(
  'table', (select to_jsonb(table_state) from table_state),
  'counts', (select to_jsonb(document_counts) from document_counts),
  'editor_role_count', (select count(*) from public.admin_users where lore_role = 'lore_editor'),
  'public_view_exists', to_regclass('public.lore_items_public') is not null,
  'role_access', (select coalesce(jsonb_agg(to_jsonb(role_access) order by role_name), '[]'::jsonb) from role_access),
  'policies', (select coalesce(jsonb_agg(to_jsonb(policies) order by policyname), '[]'::jsonb) from policies),
  'research_dependent_views', (select coalesce(jsonb_agg(to_jsonb(research_views) order by schema_name, view_name), '[]'::jsonb) from research_views),
  'lore_referencing_functions', (select coalesce(jsonb_agg(to_jsonb(lore_functions) order by schema_name, signature), '[]'::jsonb) from lore_functions),
  'slug_constraints', (select coalesce(jsonb_agg(to_jsonb(slug_constraints) order by conname), '[]'::jsonb) from slug_constraints)
)) as lore_preflight;
