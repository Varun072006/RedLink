# REDLINK implementation plan

## Concept: the Confirmation Clock

Most blood-finder apps list a number and imply it is current. REDLINK's differentiator is that **every availability claim carries its age and its source**:

| Source | Meaning | Can display as "confirmed stock"? |
| --- | --- | --- |
| Verified centre, confirmed within policy window | Staff of a verified facility confirmed units at time T | Yes, with timestamp |
| Verified centre, confirmation older than window | Previously confirmed, now stale | No. Shown as "Stale, call to confirm" |
| Unverified centre | Listed, not verified | No |
| Donor willingness | A consenting donor said yes | Never. A separate category |

The policy window is configuration, not a hard-coded value. Donor acceptance and facility confirmation are distinct workflow states.

Name: **REDLINK**. No existing app of that name turned up in a web search on 2026-10-26; this is not a trademark clearance.

## Architecture

- Next.js App Router (TypeScript) on Vercel; server actions / route handlers for all privileged writes.
- Supabase Postgres + Auth + Realtime; RLS on every exposed table; service key server-only.
- Pure-TypeScript domain modules (`src/lib/domain/*`) for matching, freshness, request state machine and distance, so they are unit-testable without a database.
- PWA: manifest plus a service worker that caches only static shell assets, never API or private data.

## Risks

- Supabase project credentials are not available: implement against the client boundary, document setup, and run integration tests against a local Supabase instance if Docker is available.
- Clinical safety: compatibility rules are preliminary filters only, flagged for review by qualified professionals.
- Geocoding and tiles: no unlimited use of public OSM services; provider configured through env.
- Scope: milestones are ordered so each leaves a working app.

## Milestones

- [x] M1 Repo scaffold, design tokens, app shell, landing/about/privacy/404
- [x] M2 Migrations, Auth, RLS, roles, protected routes
- [x] M3 Donor profile and availability, facility registration and verification
- [x] M4 Inventory with audit trail, request wizard and lifecycle
- [x] M5 Matching engine, freshness policy, fallback
- [x] M6 Realtime, notifications, map search, PWA
- [x] M7 Integration and Playwright tests, accessibility, security review
- [x] M8 Deployment config, docs (live deployment and live-Supabase verification are the owner's remaining steps)

All required routes are implemented. Extra route: `/admin/users` (account suspension and abuse reports), `/offline`, `/auth/update-password`.
