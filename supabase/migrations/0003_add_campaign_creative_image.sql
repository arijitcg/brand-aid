-- Adds on-demand AI-generated creative images to campaign days, stored in a
-- public Supabase Storage bucket (the images are marketing creatives, not
-- sensitive data, so a public bucket keeps serving them simple).

alter table campaigns
  add column if not exists creative_image_url text;

insert into storage.buckets (id, name, public)
values ('campaign-creatives', 'campaign-creatives', true)
on conflict (id) do nothing;

create policy "campaign-creatives: public read"
  on storage.objects for select
  using (bucket_id = 'campaign-creatives');

create policy "campaign-creatives: authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'campaign-creatives');

create policy "campaign-creatives: authenticated overwrite"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'campaign-creatives');
