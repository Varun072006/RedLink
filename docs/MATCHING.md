# Matching

Implemented in `src/lib/domain/matching.ts` (pure, deterministic) and orchestrated by `src/lib/server/matching-service.ts`.

## Principles

- Facilities and donors are **separate candidate categories**. A donor is never counted as stock and the two lists are never merged in one ranking.
- Compatibility rules in `src/lib/domain/blood.ts` are **preliminary filters only**. Platelets are not filtered by group (ranking prefers the exact group). The rules are isolated in one module so a clinical reviewer can replace them. Final compatibility, eligibility, testing and crossmatching belong to qualified professionals.
- Nothing is fabricated: no candidate appears unless the data supports it.

## Steps

1. Validate the request (Zod at the boundary).
2. Load candidates inside a bounding box of the search radius: verified, non-synthetic centres with their inventory; opted-in, available donors.
3. Filter. **Centres:** unverified, outside radius, already contacted, no compatible stock, or stock confirmed longer ago than `EXCLUDE_HOURS` (or never) are excluded with a recorded reason. **Donors:** no consent, not available, group fails the filter, within `DONOR_COOLDOWN_DAYS` of last donation, outside radius, already contacted.
4. Distance: haversine, approximate; donor locations are stored at about 1 km resolution.
5. Score (points shown to staff as the rationale):

| Factor | Centre | Donor |
| --- | --- | --- |
| Freshness of confirmation | confirmed 50, aging 30, stale 10 | n/a |
| Stock | enough units 20, partial 8 | n/a |
| Willingness | n/a | 20 (self-reported) |
| Proximity | up to 30, linear to the radius | up to 30 |
| Exact group | +5 | +5 |

   Ties break by distance, then id. Weights live in `DEFAULT_MATCH_CONFIG`.
6. Persist matches with their rationale; notify top 5 facilities and top 10 donors (consenting users only, via in-app and optional push).
7. Record responses: donor `accepted/declined`; facility `confirmed/unavailable`; unanswered matches `timeout`.
8. **Fallback:** if nothing is pending after a window that depends on urgency (15 min / 1 h / 6 h), the radius widens 10 → 25 → 50 → 100 km and matching reruns, skipping candidates already contacted. With no sources at the maximum radius and nothing live, the request closes as `unresolved`.
9. Requests expire at 6 h / 24 h / 72 h by urgency; reservations are released on close.

## Freshness policy

`confirmed` ≤ `FRESH_MINUTES` (240); `aging` ≤ `STALE_HOURS` (24); `stale` ≤ `EXCLUDE_HOURS` (72); beyond that excluded. Only `confirmed` may be described as confirmed stock. Adjusting stock does not refresh the timestamp; counting (`set_inventory`), "confirm all" and `centre_respond(confirm)` do.

## Baseline comparison

`nearestFirstBaseline` ranks verified in-radius centres purely by distance. The test "ranks a fresh well-stocked centre above a nearer stale one, unlike nearest-first" shows the case where the baseline would send a requester to a facility whose single listed unit was last confirmed 40 hours ago, while the engine prefers a slightly farther facility with fresh, sufficient stock. This is a constructed scenario that demonstrates the intended behaviour; it is not a measured performance claim.
