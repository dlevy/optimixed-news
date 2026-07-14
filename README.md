# Optimixed

Aggregates SEO & digital-marketing news from RSS feeds and XML sitemaps, dedupes,
AI-categorizes into 12 topics, generates a TLDR + summary, and publishes to a fast,
SEO-optimized reader UI built with **Material Design 3**.

## Stack

- **Next.js 16** (App Router, ISR) · **React 19** · **TypeScript**
- **Tailwind v4** with a full **Material Design 3** token layer (generated from a seed color)
- **Supabase** (Postgres + full-text search + pgvector) with RLS
- **Claude Haiku 4.5** (structured outputs) for categorization + summaries
- **Vercel Cron** for scheduled ingestion

## Setup

1. **Install:** `npm install`
2. **Supabase:** create a project, then run the SQL in `supabase/migrations/` (in order) via the SQL editor.
3. **Env:** copy `.env.example` → `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD` (gates `/admin`)
   - `ANTHROPIC_API_KEY`
   - `CRON_SECRET` (protects `/api/ingest`)
4. **Run:** `npm run dev` → http://localhost:3000

## Using it

- **Admin** at `/admin` (sign in with `ADMIN_PASSWORD`):
  - **Sources** — add RSS feeds or XML sitemaps.
  - **Dashboard** — live counts + **Run ingest now** button.
  - **Articles** — hide/show and reclassify any article.
- **Ingest** — runs automatically every 2h on Vercel (see `vercel.json`), or manually:
  - `npm run ingest` (local CLI), or
  - the dashboard button, or
  - `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://…/api/ingest`

## Theming

The MD3 palette derives from one seed color. To re-theme:

```bash
npm run theme -- "#0B5FA5"   # any brand hex → regenerates app/theme.css
```

## Deploy (Vercel)

1. Push to a Git repo and import into Vercel.
2. Add all `.env.local` vars in the Vercel project settings (including `CRON_SECRET`).
3. Set `NEXT_PUBLIC_SITE_URL` to the production domain.
4. Vercel picks up `vercel.json` and schedules the ingest cron automatically.

## Project structure

```
app/(site)/        Public reader UI (home, category, source, author, date, calendar, article, search)
app/admin/         Password-gated admin (dashboard, sources CRUD, article moderation)
app/api/ingest/    Secured ingestion endpoint (Vercel Cron target)
components/md/      MD3 primitives (Button, Card, Chip, Icon)
components/site/    Reader components (PostCard, PostGrid, Pagination, CategoryChips)
lib/pipeline/       Ingestion: fetch → classify → ingest
lib/queries.ts      Public read layer · lib/admin-queries.ts  Admin/service-role layer
supabase/migrations Schema + seed
scripts/            generate-theme.mjs · ingest.ts
```
