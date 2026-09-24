-- Keep the official Lore row as the source of truth. Public readers use an
-- explicit projection; only authorized Lore editors may read the base table.
-- Apply together with the Suite and retained legacy reader changes.
begin;

-- Fail closed if an existing public view or materialized view already depends
-- on the research column. Its grant must be reviewed before this cutover.
do $research_view_check$
declare dependent_views text;
begin
  select string_agg(name, ', ') into dependent_views
  from (
    select distinct format('%I.%I', ns.nspname, view_rel.relname) as name
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
      and ns.nspname = 'public'
  ) as names;
  if dependent_views is not null then
    raise exception 'Review public views depending on lore_items.research before cutover: %', dependent_views;
  end if;
end
$research_view_check$;

create or replace view public.lore_items_public
with (security_barrier = true)
as
select
  id, title, slug, category, sort_order, author, date, titles,
  association, known_works, sources, related_entries, content,
  created_at, updated_at, summary, embedding
from public.lore_items;

-- Supabase migrations run as postgres. The view intentionally uses its
-- owner's base-table rights to expose only the columns listed above.
alter view public.lore_items_public owner to postgres;
revoke all on public.lore_items_public from public, anon, authenticated;
grant select on public.lore_items_public to anon, authenticated;

alter table public.lore_items enable row level security;

-- Preserve historical policies for rollback and unrelated service access.
-- PostgreSQL ANDs restrictive policies with the OR of permissive policies,
-- so an old public-read policy cannot bypass this editor-only gate.
create policy lore_items_anon_gate on public.lore_items
as restrictive for all to anon
using (false)
with check (false);

create policy lore_items_editor_gate on public.lore_items
as restrictive for all to authenticated
using (
  exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid()) and lore_role = 'lore_editor'
  )
)
with check (
  exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid()) and lore_role = 'lore_editor'
  )
);

-- A permissive editor policy also makes the editor work when no historical
-- permissive policy grants that operation.
create policy lore_items_editor_allow on public.lore_items
for all to authenticated
using (
  exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid()) and lore_role = 'lore_editor'
  )
)
with check (
  exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid()) and lore_role = 'lore_editor'
  )
);

-- The editor uses the signed-in user's JWT. Service-role bots keep their
-- existing direct table access; anonymous readers use the public view.
revoke all on public.lore_items from public, anon, authenticated;
-- Table-level REVOKE does not remove a pre-existing column-level grant.
-- Deny direct anonymous research selection even if one was granted earlier.
revoke select (research) on public.lore_items from public, anon;
grant select, insert, update, delete on public.lore_items to authenticated;
grant all on public.lore_items to service_role;

notify pgrst, 'reload schema';
commit;
