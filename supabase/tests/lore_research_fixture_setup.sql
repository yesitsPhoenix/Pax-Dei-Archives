-- Disposable local fixture only. Never run against the live Supabase project.
\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant anon, authenticated, service_role to postgres;

create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.admin_users (user_id uuid primary key, lore_role text);
insert into public.admin_users values
  ('00000000-0000-0000-0000-000000000003', 'lore_editor');
grant select on public.admin_users to authenticated;

create table public.lore_items (
  id uuid primary key, title text, slug text, category text, sort_order integer,
  author text, date text, titles text, association text, known_works text,
  sources text, research text, related_entries text, content text,
  created_at timestamptz, updated_at timestamptz, summary text, embedding text
);
insert into public.lore_items (id, title, slug, category, sort_order, research) values
  ('10000000-0000-0000-0000-000000000001', 'Fixture one', 'fixture-one', 'Ages', 1, 'Private note'),
  ('10000000-0000-0000-0000-000000000002', 'Fixture two', 'fixture-two', 'World', 1, null);

-- Model the permissive public table access that the migration replaces.
alter table public.lore_items enable row level security;
create policy lore_fixture_public_read on public.lore_items for select to anon, authenticated using (true);
create policy lore_fixture_open_write on public.lore_items for all to authenticated using (true) with check (true);
grant select on public.lore_items to anon, authenticated;
-- A separate column grant survives a table-level REVOKE unless explicitly removed.
grant select (research) on public.lore_items to anon;
grant insert, update, delete on public.lore_items to authenticated;
