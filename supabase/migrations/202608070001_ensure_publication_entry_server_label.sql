-- The publication editor writes this field when saving or carrying over entries.
-- Keep this repair idempotent in case the original migration was already applied.
alter table public.publication_entries
add column if not exists server_label text;

-- Make the new column available to PostgREST immediately after the migration.
notify pgrst, 'reload schema';
