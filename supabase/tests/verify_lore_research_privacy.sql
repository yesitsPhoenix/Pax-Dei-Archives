-- Local PostgreSQL fixture for 202609230001_protect_lore_research.sql.
-- Run this file after fixture setup and the migration; it makes no live calls.
\set ON_ERROR_STOP on

set role anon;
do $$
begin
  if (select count(*) from public.lore_items_public) <> 2 then
    raise exception 'Anonymous public view did not retain both documents';
  end if;
  if has_table_privilege(current_user, 'public.lore_items', 'SELECT') then
    raise exception 'Anonymous clients can still select the base Lore table';
  end if;
  if has_column_privilege(current_user, 'public.lore_items', 'research', 'SELECT') then
    raise exception 'Anonymous clients can still select the research column';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lore_items_public' and column_name = 'research'
  ) then
    raise exception 'Public view includes research';
  end if;
end $$;
reset role;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$
begin
  if (select count(*) from public.lore_items_public) <> 2 then
    raise exception 'Ordinary signed-in reader cannot browse public Lore';
  end if;
  if (select count(*) from public.lore_items) <> 0 then
    raise exception 'Ordinary signed-in reader can see base Lore rows';
  end if;
end $$;
do $$
declare changed_rows integer;
begin
  update public.lore_items set research = 'Unauthorized change' where slug = 'fixture-one';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'Ordinary signed-in reader can update a Lore row';
  end if;
  delete from public.lore_items where slug = 'fixture-one';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'Ordinary signed-in reader can delete a Lore row';
  end if;
  begin
    insert into public.lore_items (id, title, slug, category) values
      ('10000000-0000-0000-0000-000000000004', 'Unauthorized', 'unauthorized', 'Ages');
    raise exception 'Ordinary signed-in reader can insert a Lore row';
  exception when insufficient_privilege then
    null;
  end;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$
begin
  if (select count(*) from public.lore_items) <> 2 then
    raise exception 'Lore editor cannot read both base rows';
  end if;
  if (select count(*) from public.lore_items where research is not null) <> 1 then
    raise exception 'Lore editor cannot read the preserved research note';
  end if;
end $$;
update public.lore_items set research = 'Editor update' where slug = 'fixture-one';
do $$
begin
  if (select research from public.lore_items where slug = 'fixture-one') <> 'Editor update' then
    raise exception 'Lore editor cannot update research';
  end if;
end $$;
insert into public.lore_items (id, title, slug, category, sort_order, research) values
  ('10000000-0000-0000-0000-000000000003', 'Fixture three', 'fixture-three', 'Ages', 3, 'New private note');
do $$
begin
  if (select count(*) from public.lore_items) <> 3 then
    raise exception 'Lore editor cannot insert a new article';
  end if;
end $$;
delete from public.lore_items where slug = 'fixture-three';
do $$
begin
  if (select count(*) from public.lore_items) <> 2 then
    raise exception 'Lore editor cannot delete its temporary article';
  end if;
end $$;
reset role;

set role service_role;
do $$
begin
  if (select count(*) from public.lore_items) <> 2 then
    raise exception 'Service-role bot cannot read the base table';
  end if;
end $$;
reset role;

select 'Lore privacy fixture passed' as result;
