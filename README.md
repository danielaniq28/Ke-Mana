# Ke Mana

Community road awareness web app for Malaysia — report hazards, police, roadblocks, and view OpenStreetMap speed cameras, bumps, and traffic signals. Built for [Vercel](https://vercel.com).

## Features

- **Waze-style reports**: hazard, police, roadblock, accident, traffic jam, flood (2-hour TTL)
- **OpenStreetMap layers**: speed cameras, speed displays, traffic signals, speed bumps/humps (via Overpass API)
- **Bilingual UI**: Bahasa Malaysia & English (persists locally; syncs to account when signed in)
- **Sign in / register**: email & password or Google — save **Home**, **Work**, and route preferences (`/account`)
- **Route preferences**: avoid freeways, tolls, ferries (Valhalla routing when navigating from your GPS location)
- **Malaysia-first UX**: default map center Kuala Lumpur, Nominatim search scoped to `MY`
- **Mobile-friendly**: large touch targets, safe-area padding, PWA-ready metadata

## Run locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and set Google OAuth + `NEXTAUTH_SECRET`.

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

1. Push this repo to GitHub (or import the folder in Vercel).
2. Import the project in Vercel — framework preset **Next.js**.
3. Add environment variables: `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (your production URL), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
4. In Google Cloud Console, add authorized redirect URI: `https://YOUR_DOMAIN/api/auth/callback/google`

### Notes on shared reports

Community reports are stored in the serverless function memory store (`src/lib/reports-store.ts`). On Vercel, instances are ephemeral and not shared globally — suitable for demos. For production, connect **Vercel KV**, **Postgres**, or **Upstash Redis** and replace the store implementation.

## Routing engine (A* + CRP + CH + Valhalla)

Ke Mana uses a layered planner in `src/lib/routing/`:

1. **CRP-style metric customization** — fast overlay of user preferences (avoid highway/toll) and vehicle type on base edge weights (`crp.ts`).
2. **Real-time dynamic updates** — community reports (police, flood, roadblock, etc.) increase edge costs near incidents without rebuilding the graph (`dynamic-costs.ts`).
3. **Contraction Hierarchies (CH)** — preprocessed shortcuts on the KL micro-graph for sub-millisecond queries on customized weights (`ch.ts`).
4. **A\*** — foundational graph search fallback on the same dynamic graph (`astar.ts`).
5. **Valhalla** — nationwide fallback when endpoints are outside the micro-graph bounds.

`/api/directions` returns `engine`: `ch_crp`, `astar`, or `valhalla`, plus `dynamicUpdatesApplied` (edges penalized by live reports).

Precompute CH offline:

```bash
npx tsx scripts/preprocess-ch.ts
```

## API

| Route | Method | Description |
|-------|--------|-------------|
| `/api/reports` | GET | List reports (optional `south,west,north,east`) |
| `/api/reports` | POST | Create report `{ type, lat, lng, note? }` |
| `/api/reports/[id]/upvote` | POST | Increment upvotes |
| `/api/osm` | GET | OSM features in bbox |
| `/api/search` | GET | Malaysia place search (`q`) |

## Data attribution

Map tiles and features © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL).
