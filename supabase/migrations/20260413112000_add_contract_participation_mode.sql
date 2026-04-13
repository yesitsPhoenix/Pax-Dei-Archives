alter table public.board_quests
  add column if not exists participation_mode text not null default 'single';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'board_quests_participation_mode_check'
      and conrelid = 'public.board_quests'::regclass
  ) then
    alter table public.board_quests
      add constraint board_quests_participation_mode_check
      check (participation_mode in ('single', 'open'));
  end if;
end $$;

update public.board_quests
set participation_mode = 'open'
where player_contract_category ilike '%Events & Gatherings%'
  and participation_mode = 'single';

create or replace function public.can_accept_board_quest(
  p_board_quest_id uuid,
  p_character_id uuid
)
returns table(can_accept boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post public.board_quests%rowtype;
  v_active_acceptance_count integer;
  v_limit integer;
begin
  select *
  into v_post
  from public.board_quests
  where id = p_board_quest_id;

  if not found then
    return query select false, 'not_found';
    return;
  end if;

  if v_post.status <> 'posted' then
    return query select false, 'not_posted';
    return;
  end if;

  if v_post.expires_at is not null and v_post.expires_at <= now() then
    return query select false, 'expired';
    return;
  end if;

  if v_post.author_character_id = p_character_id then
    return query select false, 'own_post';
    return;
  end if;

  if exists (
    select 1
    from public.board_quest_acceptances
    where board_quest_id = p_board_quest_id
      and character_id = p_character_id
      and status in ('accepted', 'in_progress', 'awaiting_confirmation')
  ) then
    return query select false, 'already_accepted';
    return;
  end if;

  if v_post.participation_mode = 'open' then
    return query select true, 'available';
    return;
  end if;

  select count(*)
  into v_active_acceptance_count
  from public.board_quest_acceptances
  where board_quest_id = p_board_quest_id
    and status in ('accepted', 'in_progress', 'awaiting_confirmation');

  v_limit := greatest(coalesce(v_post.capacity, 1), 1);

  if v_active_acceptance_count >= v_limit then
    return query select false, 'filled';
    return;
  end if;

  return query select true, 'available';
end;
$$;

grant execute on function public.can_accept_board_quest(uuid, uuid) to anon, authenticated;
