# Testing

Results below are from a run on 2026-10-26 on Windows with Node 22. Re-run them yourself; do not rely on this page as proof.

| Check | Command | Result |
| --- | --- | --- |
| Type check | `npm run typecheck` | passes, no errors |
| Lint | `npm run lint` | passes, no errors or warnings |
| Unit tests | `npm run test:unit` | 33 tests pass (domain rules, matching vs nearest-first baseline, freshness, state machine, validation, tokens, availability search) |
| Integration tests | `npm run test:integration` | 31 tests pass against the real migrations in PGlite |
| Production build | `npm run build` | succeeds |
| Playwright | `npm run test:e2e` | 44 pass, 5 skipped (full-stack workflow needs Supabase) |

Static JavaScript emitted by the build totals roughly 1.4 MB across all route chunks (uncompressed, includes Leaflet and Motion). Per-page transfer size and Core Web Vitals were **not** measured.

## What is covered

**Unit** — blood compatibility filter, haversine and direction, freshness boundaries and policy fallbacks, every request-state transition, expiry, radius widening, request/donor/inventory validation, tracking tokens, matching filters with exclusion reasons, ranking, rationale totals, determinism, donor/centre separation, and the stale-but-near versus fresh-but-farther comparison with the nearest-first baseline.

**Integration (real SQL, RLS enforced by switching roles)** — sign-up role mapping, blocked role/status changes, anonymous and cross-user denial on every private table, hidden columns, no direct writes, request visibility by role, notification isolation, internal functions not callable by browser roles, inventory permissions and audit trail, confirmation-timestamp rules, negative/reserved stock refusal, duplicate and cross-user donor responses, expired requests, contact reveal after acceptance, donor acceptance not confirming availability, reservation/overselling guard, fulfilment, cancellation releasing stock, state machine parity with TypeScript for all pairs, verified donation recording, append-only audit, rate limit window, synthetic seed.

**Playwright (production build, demonstration mode)** — every public route renders; no horizontal overflow at 320, 375, 768, 1024 and 1440 px on all public routes; mobile bottom navigation and desktop navigation; skip link and visible focus; synthetic labelling and no stale-as-confirmed in search; search form validation and map view; the full request wizard validation through the review step; all protected routes redirect visitors to sign-in; open-redirect refusal; cron/tracking/geocode API behaviour; security headers; manifest, icons and service-worker scope; offline banner; labelled form errors; reduced-motion; screenshots at 375 and 1280 px were reviewed by eye.

## Known limitations

- **Not executed against a live Supabase project:** the server actions (Supabase client calls, cookie sessions, `auth.admin` calls, matching-service queries through PostgREST, push delivery) and the browser flows built on them. `tests/e2e/workflow.spec.ts` is written for sign-up → donor availability → facility verification and stock → request → donor and facility response → tracking → role rejection, but it has **never been run**; expect to fix small issues the first time.
- PGlite is single-connection, so the "concurrent" reservation test serialises operations. It verifies the guard logic and invariants, not true multi-connection contention; row locks are standard Postgres but were not stress-tested.
- The PGlite harness stubs `auth.uid()` and roles; Supabase's real GoTrue and PostgREST layers are not exercised.
- Realtime subscriptions, Web Push and geocoding require external services and were not exercised.
- Keyboard and contrast checks were limited to automated focus/label assertions and visual inspection; no full accessibility audit (axe, screen reader) was run.
- Reduced-motion is verified for CSS transitions; Motion animations use `useReducedMotion` but were not observed in a browser with the preference set.
- Mobile layout was checked in desktop Chromium at narrow widths, not on physical devices; the PWA install prompt and service-worker offline fallback were not tested on a device.
- Playwright workers are capped at 4; the overflow tests are slow and can time out when the machine is heavily loaded.
- No load or performance testing.
