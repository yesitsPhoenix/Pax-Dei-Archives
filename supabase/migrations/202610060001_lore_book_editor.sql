-- Apply after 202609230001_protect_lore_research.sql. Official Lore drafts must
-- never be readable through the anonymous base table or the public projection.
begin;

do $$
begin
  if to_regclass('public.lore_items_public') is null then
    raise exception 'Apply the Lore research/privacy migration before enabling Lore drafts';
  end if;
  if has_any_column_privilege('anon', 'public.lore_items', 'SELECT') then
    raise exception 'Anonymous base-table Lore reads must be revoked before enabling drafts';
  end if;
end
$$;

alter table public.lore_items
  add column if not exists status text not null default 'published',
  add column if not exists cover_image text,
  add column if not exists cover_color text,
  add column if not exists cover_ornament boolean not null default false,
  add column if not exists cover_position_x integer not null default 50,
  add column if not exists cover_position_y integer not null default 50;

alter table public.lore_items
  add constraint lore_items_status_check check (status in ('draft', 'published')),
  add constraint lore_items_cover_image_check check (cover_image is null or cover_image ~ '^[a-f0-9]{32}\.(png|jpg|webp)$'),
  add constraint lore_items_cover_color_check check (cover_color is null or cover_color in ('walnut', 'olive', 'forest', 'teal', 'indigo', 'plum', 'crimson')),
  add constraint lore_items_cover_position_check check (
    cover_position_x between 0 and 100 and cover_position_y between 0 and 100
  );

create unique index lore_items_cover_image_unique
  on public.lore_items (cover_image) where cover_image is not null;

-- Preserve the established public-view column order and append only public
-- cover fields. Research remains absent. PostgreSQL permits adding columns to
-- a view via CREATE OR REPLACE, but the existing privacy view must exist first.
create or replace view public.lore_items_public
with (security_barrier = true)
as
select
  id, title, slug, category, sort_order, author, date, titles,
  association, known_works, sources, related_entries, content,
  created_at, updated_at, summary, embedding,
  cover_image, cover_color, cover_ornament, cover_position_x, cover_position_y
from public.lore_items
where status = 'published';

alter view public.lore_items_public owner to postgres;
revoke all on public.lore_items_public from public, anon, authenticated;
grant select on public.lore_items_public to anon, authenticated;

-- These six generated reference volumes need their own editable book details.
-- Individual writings and documents keep their details on lore_items.
create table public.lore_volume_editions (
  book_id text primary key check (book_id in (
    'lore-volume:the-ages', 'lore-volume:divine', 'lore-volume:factions',
    'lore-volume:known-figures', 'lore-volume:redeemers', 'lore-volume:world'
  )),
  title text not null check (char_length(btrim(title)) between 1 and 240),
  author text not null default '' check (char_length(author) <= 240),
  status text not null default 'draft' check (status in ('draft', 'published')),
  cover_image text unique check (cover_image is null or cover_image ~ '^[a-f0-9]{32}\.(png|jpg|webp)$'),
  cover_color text check (cover_color is null or cover_color in ('walnut', 'olive', 'forest', 'teal', 'indigo', 'plum', 'crimson')),
  cover_ornament boolean not null default false,
  cover_position_x integer not null default 50 check (cover_position_x between 0 and 100),
  cover_position_y integer not null default 50 check (cover_position_y between 0 and 100),
  updated_at timestamptz not null default now()
);

alter table public.lore_volume_editions enable row level security;

create policy lore_volume_editor_access on public.lore_volume_editions
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

revoke all on public.lore_volume_editions from public, anon, authenticated;
grant select, insert, update, delete on public.lore_volume_editions to authenticated;
grant all on public.lore_volume_editions to service_role;

-- Draft volume details remain private; the public status alone lets the
-- bookshelf hide a volume that an editor moved back to Draft.
create view public.lore_volume_editions_public
with (security_barrier = true)
as
select
  book_id, status,
  case when status = 'published' then title else null end as title,
  case when status = 'published' then author else null end as author,
  case when status = 'published' then cover_image else null end as cover_image,
  case when status = 'published' then cover_color else null end as cover_color,
  case when status = 'published' then cover_ornament else null end as cover_ornament,
  case when status = 'published' then cover_position_x else null end as cover_position_x,
  case when status = 'published' then cover_position_y else null end as cover_position_y
from public.lore_volume_editions;

alter view public.lore_volume_editions_public owner to postgres;
revoke all on public.lore_volume_editions_public from public, anon, authenticated;
grant select on public.lore_volume_editions_public to anon, authenticated;

notify pgrst, 'reload schema';
commit;
