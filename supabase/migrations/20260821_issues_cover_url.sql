-- Optional: store cover images on catalog issues
-- Fixes: Could not find the 'cover_url' column of 'issues' in the schema cache

alter table if exists public.issues
  add column if not exists cover_url text;

notify pgrst, 'reload schema';
