alter table public.publication_entries
add column if not exists server_label text;
