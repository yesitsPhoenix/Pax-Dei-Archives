alter table public.mail_messages
  add column if not exists board_quest_id uuid references public.board_quests(id) on delete set null,
  add column if not exists board_quest_acceptance_id uuid references public.board_quest_acceptances(id) on delete set null,
  add column if not exists template_key text;

create index if not exists idx_mail_messages_board_quest_id
  on public.mail_messages(board_quest_id);

create index if not exists idx_mail_messages_board_quest_acceptance_id
  on public.mail_messages(board_quest_acceptance_id);

create index if not exists idx_mail_messages_template_key
  on public.mail_messages(template_key);
