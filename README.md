# Brand Aid

**AI Competitor & Ad-Strategy Intelligence Dashboard** — IIT Patna Generative AI Capstone Sprint 2026, Batch 4.

Tell it your niche, and it finds your top competitors — a mix of local businesses and national players that actually
operate in your city — pulls their website and reviews automatically, and gives you an instant breakdown of their
positioning, SWOT, ad strategy, and how to outposition them. An animated funnel dashboard tracks the whole pipeline live.

Full design/architecture writeup: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Stack

Vite + React + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion · Supabase (Postgres + Auth + Edge Functions +
Storage) · Claude API (incl. vision) · SerpAPI/Google Custom Search · Google Places API · Gemini (Imagen) for campaign
creative images.

## Quick start (demo mode, no setup)

```bash
npm install
npm run dev
```

Sign in with any email/password — the app runs entirely on a localStorage-backed mock dataset until Supabase is
configured, so every screen is clickable with zero backend setup. Every AI/fetch result carries a **Demo data** badge in
this mode.

## Going live

1. Create a project at [supabase.com](https://supabase.com), then from the project root:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push   # applies all migrations, including the competitor tier column and campaign-creatives bucket
   ```
2. Set Edge Function secrets (all optional individually — each integration falls back to an error, not fake data, if its
   secret is missing):
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase secrets set SERPAPI_KEY=...
   supabase secrets set GOOGLE_PLACES_API_KEY=...
   supabase secrets set GEMINI_API_KEY=...
   # or, instead of SERPAPI_KEY:
   supabase secrets set GOOGLE_CSE_KEY=... GOOGLE_CSE_CX=...
   ```
3. Deploy the Edge Functions:
   ```bash
   supabase functions deploy discover-competitors
   supabase functions deploy fetch-competitor-data
   supabase functions deploy analyze-competitor
   supabase functions deploy analyze-ads
   supabase functions deploy analyze-ad-image
   supabase functions deploy generate-campaign
   supabase functions deploy generate-campaign-creative
   supabase functions deploy env-status
   ```
4. Copy `.env.example` to `.env` and fill in the values from your Supabase project's API settings:
   ```
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   ```
5. `npm run dev` — the Settings page shows Live/Demo status per integration.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and produce a production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run Oxlint |

## Project layout

```
src/
  components/ui/        shadcn-style primitives (button, card, tabs, table, dialog, ...)
  components/layout/    Sidebar + DashboardShell
  components/dashboard/ SwotCard, FunnelChart, ComparisonChart, CampaignApprovalQueue, CompetitorCard, DataSourceBadge
  lib/
    dataStore.ts         Supabase-or-mock data layer — every page calls this, never Supabase directly
    mockData.ts          deterministic demo dataset
    supabaseClient.ts     Supabase client (null when unconfigured)
    auth.tsx             auth context (Supabase auth or local mock session)
  pages/                 Landing, Login, Dashboard, NewAnalysis, AnalysisDetail, Campaign, Settings
supabase/
  migrations/            0001_init.sql (schema + RLS), 0002_add_competitor_tier.sql, 0003_add_campaign_creative_image.sql
  functions/              discover-competitors, fetch-competitor-data, analyze-competitor,
                          analyze-ads, analyze-ad-image, generate-campaign, generate-campaign-creative
docs/ARCHITECTURE.md    full design doc — diagrams, ERD, edge function contracts, UX flow
```

## Data integrity

Only publicly available data is used. Ad creative, copy, and run-times are shown as facts; spend posture and funnel
strategy are always labeled as AI-inferred estimates. Reviews are analyzed as paraphrased patterns, never reproduced
verbatim at length. Private metrics (exact budget, CPR, precise targeting) are never fabricated or presented as fact.
