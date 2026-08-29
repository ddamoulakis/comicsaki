-- Public CDN bucket for scraped greekcomics.gr cover images ({covId}_{filename}.jpg).
insert into storage.buckets (id, name, public)
values ('greek-covers', 'greek-covers', true)
on conflict (id) do nothing;

create policy "greek_covers_select"
  on storage.objects for select
  using (bucket_id = 'greek-covers');
