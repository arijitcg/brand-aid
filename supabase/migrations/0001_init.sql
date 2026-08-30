-- Brand Aid — initial schema
-- Run with: supabase db push  (after `supabase link` to your project)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- searches: one row per "niche" the user researched
-- ---------------------------------------------------------------------------
create table if not exists searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  niche text not null,
  selected_competitor_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- competitors: candidates discovered for a search (selected or not)
-- ---------------------------------------------------------------------------
create table if not exists competitors (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references searches(id) on delete cascade,
  name text not null,
  website_url text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- competitor_data: fetched website summary + reviews (one row per competitor)
-- ---------------------------------------------------------------------------
create table if not exists competitor_data (
  competitor_id uuid primary key references competitors(id) on delete cascade,
  website_summary text not null default '',
  reviews jsonb not null default '[]',
  avg_rating numeric not null default 0,
  review_count integer not null default 0,
  source text not null default 'mock' check (source in ('live', 'mock')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- analyses: AI-generated SWOT / positioning / outposition plan
-- ---------------------------------------------------------------------------
create table if not exists analyses (
  competitor_id uuid primary key references competitors(id) on delete cascade,
  swot jsonb not null,
  positioning text not null,
  pricing_notes text not null default '',
  complaint_patterns jsonb not null default '[]',
  outposition_tips jsonb not null default '[]',
  source text not null default 'mock' check (source in ('live', 'mock')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ad_examples: manually pasted Meta Ad Library copy + AI messaging-angle read
-- ---------------------------------------------------------------------------
create table if not exists ad_examples (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitors(id) on delete cascade,
  pasted_text text not null,
  messaging_angle text not null default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- campaigns: 7-day counter-campaign, one row per day, approval queue status
-- ---------------------------------------------------------------------------
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references searches(id) on delete cascade,
  day integer not null check (day between 1 and 7),
  hook text not null,
  caption text not null,
  creative_concept text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- reports: a saved/exported PDF report record
-- ---------------------------------------------------------------------------
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references searches(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security — every row is reachable only by the owning user,
-- traced back to searches.user_id.
-- ---------------------------------------------------------------------------
alter table searches enable row level security;
alter table competitors enable row level security;
alter table competitor_data enable row level security;
alter table analyses enable row level security;
alter table ad_examples enable row level security;
alter table campaigns enable row level security;
alter table reports enable row level security;

create policy "searches: owner full access" on searches
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "competitors: owner full access" on competitors
  for all using (exists (select 1 from searches s where s.id = competitors.search_id and s.user_id = auth.uid()))
  with check (exists (select 1 from searches s where s.id = competitors.search_id and s.user_id = auth.uid()));

create policy "competitor_data: owner full access" on competitor_data
  for all using (
    exists (
      select 1 from competitors c join searches s on s.id = c.search_id
      where c.id = competitor_data.competitor_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from competitors c join searches s on s.id = c.search_id
      where c.id = competitor_data.competitor_id and s.user_id = auth.uid()
    )
  );

create policy "analyses: owner full access" on analyses
  for all using (
    exists (
      select 1 from competitors c join searches s on s.id = c.search_id
      where c.id = analyses.competitor_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from competitors c join searches s on s.id = c.search_id
      where c.id = analyses.competitor_id and s.user_id = auth.uid()
    )
  );

create policy "ad_examples: owner full access" on ad_examples
  for all using (
    exists (
      select 1 from competitors c join searches s on s.id = c.search_id
      where c.id = ad_examples.competitor_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from competitors c join searches s on s.id = c.search_id
      where c.id = ad_examples.competitor_id and s.user_id = auth.uid()
    )
  );

create policy "campaigns: owner full access" on campaigns
  for all using (exists (select 1 from searches s where s.id = campaigns.search_id and s.user_id = auth.uid()))
  with check (exists (select 1 from searches s where s.id = campaigns.search_id and s.user_id = auth.uid()));

create policy "reports: owner full access" on reports
  for all using (exists (select 1 from searches s where s.id = reports.search_id and s.user_id = auth.uid()))
  with check (exists (select 1 from searches s where s.id = reports.search_id and s.user_id = auth.uid()));

create index if not exists idx_competitors_search_id on competitors(search_id);
create index if not exists idx_ad_examples_competitor_id on ad_examples(competitor_id);
create index if not exists idx_campaigns_search_id on campaigns(search_id);
create index if not exists idx_reports_search_id on reports(search_id);
