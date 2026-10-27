# REDLINK — Blood availability & donor coordination

A Progressive Web App that connects people who need blood, voluntary donors, verified hospitals and blood banks.
Its distinguishing idea is the **Confirmation Clock**: every availability claim carries who confirmed it and how old
that confirmation is, and donor willingness is never counted as stock.

> REDLINK coordinates information. It does not provide medical advice, verify donor eligibility, or decide clinical
> compatibility. The matching rules are preliminary filters for qualified professionals to review.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, Realtime, RLS) · Zod +
React Hook Form · Leaflet · Motion · Vitest · Playwright.

## Quick start

```bash
npm install
cp .env.example .env.local     # fill in Supabase values (see below)
npm run dev                    # http://localhost:3000
```

Without Supabase variables the app runs in **demonstration mode**: public pages render, availability search shows
clearly labelled synthetic centres, and anything that needs a database (accounts, request submission, dashboards)
says so instead of pretending to work.

## Supabase setup

1. Create a Supabase project.
2. Apply the migrations in `supabase/migrations/` in order (SQL editor, or `supabase db push`).
3. *Optional, demo only:* run `supabase/seed.sql` for six synthetic centres (flagged `is_synthetic`). Synthetic centres are never contacted by matching.
4. Auth settings: set **Site URL** to your deployed URL and add `<site>/auth/callback` to the redirect allow-list. Email confirmation may stay on.
5. Realtime: the migration adds `notifications`, `blood_requests`, `request_matches` and `blood_inventory` to the `supabase_realtime` publication. Row Level Security governs what each client receives.
6. **Create the first administrator** (there is deliberately no sign-up path to admin). Register normally, then in the SQL editor:
   ```sql
   update public.profiles set role = 'admin' where id = '<user uuid>';
   ```
   Database triggers block any signed-in user from changing roles; this works because the SQL editor has no `auth.uid()`.

## Environment variables

See [.env.example](.env.example). `SUPABASE_SERVICE_ROLE_KEY` and `VAPID_PRIVATE_KEY` are server-only; never prefix
them with `NEXT_PUBLIC_`.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser and server Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only: request creation, matching, maintenance, admin metrics |
| `NEXT_PUBLIC_SITE_URL` | Auth redirects |
| `CRON_SECRET` | Authorises `/api/cron/maintenance` |
| `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_ATTRIBUTION` | Map tiles. Public OSM tiles are for light/demo use only; use a provider whose terms fit your traffic |
| `GEOCODE_URL`, `GEOCODE_API_KEY`, `GEOCODE_USER_AGENT` | Optional Nominatim-compatible address search. Unset = disabled; users can use device location or pick a city |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Optional Web Push |
| `FRESH_MINUTES`, `STALE_HOURS`, `EXCLUDE_HOURS`, `DONOR_COOLDOWN_DAYS` | Freshness and donor-interval policy |

## Scripts

| Script | Does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck`, `npm run lint` | Static checks |
| `npm run test:unit` | Domain logic (matching, freshness, state machine, validation) |
| `npm run test:integration` | Applies the real migrations to an in-process Postgres (PGlite) and tests RLS, RPCs, reservations |
| `npm run test:e2e` | Playwright against a production build (`npm run build` first) |
| `npm run check` | typecheck + lint + unit + integration |

Full-stack Playwright flows (`tests/e2e/workflow.spec.ts`) run only with `E2E_FULLSTACK=1` and Supabase credentials.

## Deploying to Vercel

1. Push the repository and import it in Vercel (framework preset: Next.js; no build overrides).
2. Add the environment variables above for Production (and Preview if wanted). Set `NEXT_PUBLIC_SITE_URL` to the production URL.
3. Deploy. HTTPS is automatic, which the service worker and geolocation require.
4. **Cron:** `vercel.json` schedules `/api/cron/maintenance` daily (compatible with the Hobby plan). It expires requests, times out stale matches, widens searches and sends pending push. On a Pro plan change the schedule to `*/5 * * * *`. Between runs, an open tracking page performs the same maintenance for its own request every 15 seconds, so open requests still progress.
5. Smoke test: open `/`, `/availability`, `/manifest.webmanifest`; sign up; confirm `/api/cron/maintenance` returns 401 without the secret.

The app builds and serves without any environment variables (demonstration mode), so a first deploy cannot fail for missing configuration.

## Documentation

- [docs/PLAN.md](docs/PLAN.md) — concept and milestones
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — architecture and request flow
- [docs/DATABASE.md](docs/DATABASE.md) — schema and access rules
- [docs/MATCHING.md](docs/MATCHING.md) — algorithm and assumptions
- [docs/SECURITY.md](docs/SECURITY.md) — threat model and safeguards
- [docs/TESTING.md](docs/TESTING.md) — tests, results and known limitations

## Known limitations

See [docs/TESTING.md](docs/TESTING.md#known-limitations). In short: server actions and the browser flows that need a live Supabase project (sign-up through facility confirmation) were not executed end to end; the database logic beneath them is covered by integration tests.
# RedLink
