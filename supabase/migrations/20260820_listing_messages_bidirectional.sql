-- Αμφίδρομα μηνύματα σε αγγελία: αγοραστής ↔ πωλητής

drop policy if exists "listing_messages_insert_sender" on public.listing_messages;
create policy "listing_messages_insert_sender"
  on public.listing_messages for insert
  with check (
    auth.uid() = sender_id
    and sender_id <> recipient_id
    and exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and (
          -- Αγοραστής στέλνει στον πωλητή
          (l.user_id = recipient_id and l.user_id <> auth.uid())
          -- Πωλητής απαντά σε ενδιαφερόμενο
          or (l.user_id = auth.uid())
        )
    )
  );

grant select, insert on public.listing_messages to authenticated;
