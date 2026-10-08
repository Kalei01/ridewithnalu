# Service limits (proposal P-3)

Checked 2026-10-08 with web searches (the provider pages themselves could not be opened from the build session, so these are search-result summaries of the providers' own pages; re-confirm before relying on them). Nalu's actual plan with each provider is **unknown** from the code — the table shows the free-plan numbers and, where known, the paid ones. Run `bun scripts/usage-check.mts` for the current numbers.

| Service | Used for | Documented limit | Page | Usage readable by the check |
|---|---|---|---|---|
| Supabase | database, accounts, API | Free: 500 MB database, 5 GB egress, 50,000 monthly active users. Pro: 8 GB, 250 GB, 100,000 | https://supabase.com/pricing | Database size, accounts, API requests: yes (SUPABASE_ACCESS_TOKEN). Egress: no (dashboard only) |
| Cloudflare Workers | hosts ridenalu.com | Free: 100,000 requests/day (resets 00:00 UTC), 10 ms CPU. Paid: no request cap | https://developers.cloudflare.com/workers/platform/limits/ | Only with a new token (below) |
| TomTom | drive times, traffic, walking, geocoding | Free: 2,500 non-tile + 50,000 tile requests/day; pay-as-you-go beyond | https://developer.tomtom.com/pricing | No key-level usage API; Nalu keeps no call counter. Dashboard only |
| Mapbox | live navigation map | Free: 50,000 web map loads/month | https://www.mapbox.com/pricing | Dashboard only |
| Resend | account/alert email | Free: 3,000 emails/month, 100/day | https://resend.com/pricing | The sending key cannot read usage |
| Firebase messaging (FCM) | push notifications | No per-message charge documented; quota unknown | https://firebase.google.com/pricing | Nalu's own count of recent sends only (7 days kept) |
| OpenAI-compatible AI | Nalu's spoken lines (OPENAI_*, LOVABLE_API_KEY) | unknown | — | no |
| AirNow, HEA, HDOT, GA4, PostHog, Sentry | air quality, extras, analytics, errors | unknown / free tiers | — | no |

Thresholds: WATCH at 70% of a limit, ALERT at 90% or when a day's Supabase API requests are over 2x the previous average (and at least 1,000).

New read-only tokens for fuller coverage (add as environment secrets, never in chat):
- `CLOUDFLARE_API_TOKEN` — Cloudflare dashboard > My Profile > API Tokens > custom token, permission "Account Analytics: Read" only; and `CLOUDFLARE_ACCOUNT_ID` (an id, not a secret).
- TomTom, Mapbox, Resend: no usage-reading key exists; Josh checks each dashboard monthly, or Nalu adds its own call counter later (a product/database decision).
