# Scout Grid

NFL Draft prospect analytics platform. Built with Next.js (App Router),
React, TypeScript, and Tailwind CSS. Dark mode by default.

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Deploying to Vercel

Push this repo to GitHub and import it in Vercel — no configuration is
required, it's a standard Next.js App Router project.

## Google Sheets integration (live data)

The site pulls real prospect data from the "All-Time Prospect Scores"
Google Sheet instead of static files. `lib/googleSheets.ts` fetches
the sheet's public CSV export and parses three tables by locating each
one's header text (not fixed row numbers, so inserting/deleting rows
in the sheet is safe):

- The master prospect table (name, draft year, position, scores, career Hit/Miss)
- The overall Tier hit-rate summary
- The Class Year historical trend table

Data is revalidated every 60 seconds — edit the sheet, and the change
shows up on the site within a minute, with no redeploy needed.

**Required setup:** the sheet must be shared as **"Anyone with the
link can view"** (File → Share → General access, in Google Sheets).
Vercel has no Google login of its own — it fetches the sheet the same
way a logged-out browser would, so if the sheet is private, every page
that needs live data will fail to load. This does mean anyone with the
link can *view* (not edit) the sheet. If you'd rather keep it fully
private, swap the fetcher in `lib/googleSheets.ts` for the Google
Sheets API with a service account, and add its credentials as Vercel
environment variables instead.

**Known gaps**, since the sheet doesn't include these columns yet:
school, height/weight/age, class year, and a per-prospect tier label
(the sheet's Tier data only exists as an aggregate summary, not
assigned to individual rows) all render as "—" or are simply absent.
The Tier filter on the rankings and position pages currently won't
match anything for the same reason. Everything else — name, position,
draft year, Raw/Pre-Draft/O.I.S/Prospect Score, career Finish, and
Hit/Miss — is real and live.

## Project structure

```
app/
  layout.tsx              Root layout — fonts, Navbar, Footer, search, dark theme
  page.tsx                 Homepage
  players/
    page.tsx                 Rankings table (live data)
    [id]/page.tsx              Player profile (live data)
  positions/[position]/page.tsx  QB/RB/WR/TE pages (live data)
  analytics/page.tsx          Analytics dashboard (live data)
  classes/, about/            Static section pages
  api/prospects/route.ts      JSON endpoint for client-side search

components/
  layout/     Navbar, Footer, Container, SectionIntro, SectionHeading
  home/       Homepage sections (Hero, PositionNav, DraftClasses, etc.)
  ui/         Button, Badge, CornerFrame — shared primitives
  rankings/   RankingsTable, TierBadge, FilterSelect, Pagination
  positions/  Position page components (header, stats, explorer, cards)
  profile/    Player profile components (score rings, radar chart, etc.)
  analytics/  Dashboard cards and hand-rolled interactive charts
  search/     Global command-palette search (⌘K)

lib/
  googleSheets.ts     Live data fetch + parse (the real data source)
  analytics.ts        Pure aggregation functions over prospect data
  prospects.ts        Static filter option lists (positions, tiers)
  positionThemes.ts   Per-position accent colors and copy
  utils.ts            cn() class name helper

types/
  prospect.ts         Domain types
```

## Design system

- **Palette** — near-black void background (`#0A0C0F`) with a single
  warm gold accent (`#E8A33D`), evoking stadium lights / a graded
  report card. Each position page (QB/RB/WR/TE) has its own accent
  color layered on top (`lib/positionThemes.ts`). Riser/faller greens
  and reds are used for outcome indicators (Hit/Miss).
- **Type** — Space Grotesk (display), Inter (body), IBM Plex Mono
  (data, labels, eyebrows).
- **Signature element** — `CornerFrame`, a viewfinder-style bracket
  panel referencing the reticles scouts use to mark up film.

## Pages

- **Home** (`/`) — hero, position nav, draft classes, recent updates, model info
- **Rankings** (`/players`) — sortable/filterable table of all live prospects
- **Player profile** (`/players/[id]`) — full scouting-report-style page: scores, radar chart, strengths/weaknesses, comparisons, career stats, draft projection, real career outcome
- **Position pages** (`/positions/qb`, `/rb`, `/wr`, `/te`) — themed rankings + score distribution per position
- **Analytics** (`/analytics`) — dashboard: score distribution, averages by position/class, real tier hit rates, historical trend line, calibration shell
- **Global search** (⌘K anywhere) — instant player/school search across the whole site

## Roadmap (not yet built)

- Team draft needs pages
- Mock draft simulator
- Light mode toggle
- Per-prospect school, measurables, and tier (needs those columns added to the sheet)
- Calibration chart data (needs per-prospect outcome pairing, not just tier aggregates)
