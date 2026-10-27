# Security and privacy

## Threats and safeguards

| Threat | Safeguard |
| --- | --- |
| Self-granted admin | Role/status columns are not updatable by users (column grants + trigger); sign-up metadata can only select `donor` or `staff`; admin is set by SQL only. Tested |
| Donor edits inventory / another facility's data | No direct write grants on inventory, centres or requests; RPCs call `staff_centre()` which requires active staff of a **verified** facility and use that facility's id, never a browser-supplied one. Tested |
| Reading others' requests or donor data | RLS: requests visible only to requester, matched facility staff and admin; donor profiles only to the owner and admin; contact revealed to a donor only after they accept. Tested |
| Request tampering or enumeration | Tracking uses a 192-bit random token; only its SHA-256 is stored; tracking pages send `no-referrer` and `noindex`. Anyone holding the link can view or cancel, which the UI states |
| Overselling stock | Row-locked reservations, `reserved <= units` check, release on cancel/expire/fulfil |
| Duplicate responses / submissions | Unique constraints on matches; status guard in RPCs; idempotency key per submission |
| Abuse and spam | DB-backed rate limits (per client, per phone, per action); facility "report concern" flow; admin suspension (also bans the auth user) |
| Stale data presented as current | Freshness policy enforced in shared code; label and timestamp on every figure; offline cache never stores data |
| Secret exposure | Service key and VAPID private key only in server modules (`server-only`); `.env*` ignored; nothing sensitive in `NEXT_PUBLIC_*` |
| Leaky errors | Database messages are mapped through an allow-list; everything else returns a generic message |
| Clickjacking, sniffing | `X-Frame-Options`, `X-Content-Type-Options`, HSTS, Referrer-Policy, Permissions-Policy headers; `poweredByHeader` off |
| Open redirect | `next` parameters accepted only if they are same-origin relative paths |
| Cron abuse | Constant-time compare against `CRON_SECRET`; fails closed if unset |

## Privacy

- No medical history is collected. Notes warn against patient identifiers.
- Donor location is rounded to about 1 km before storage and is never public; donors see only approximate distances.
- Donors opt in explicitly with a recorded timestamp and can pause or withdraw at any time. Deleting an account removes the profile and notifications; submitted requests are kept unlinked; audit entries are retained.
- Contact details are shared only with matched facilities and with donors who accept.

## Known gaps

- The privacy notice is a design statement, not reviewed legal text.
- Rate limiting is per client IP hash and per phone; a determined distributed attacker is out of scope.
- No CAPTCHA. Add one (for example Turnstile) in front of request submission if public abuse appears.
- No independent penetration test has been performed.
- Facility verification is a manual administrator judgement; the app records it but cannot validate a licence number against a registry.
