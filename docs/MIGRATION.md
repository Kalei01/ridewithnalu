# Moving Nalu off Lovable → Cloudflare + own Supabase

Living checklist for self-hosting. The app already builds for Cloudflare
(`bun run build` → `.output/`, Nitro preset `cloudflare-module`) and was verified
running under `wrangler dev`. Keep Lovable running until every box below is
checked on the new host.

## 1. Accounts to create (all free tiers)

- [ ] Cloudflare (hosting, scheduled jobs)
- [x] Supabase (database + sign-in): new project `nsoameosqsnumjivkmyv` (`https://nsoameosqsnumjivkmyv.supabase.co`). The old project `kkvpznrahtldzpqjvbhj` is Lovable-managed
- [ ] Firebase project with a service-account key (push notifications)
- [ ] Mapbox, PostHog: only if the current tokens come from Lovable-managed accounts
- [ ] OpenAI API key (Nalu AI), if not already set
- [ ] Google Cloud OAuth client (Google sign-in); Apple sign-in waits on the Apple Developer account

## 2. Server secrets (Cloudflare → Worker → Settings → Variables and Secrets)

| Name | Source | Notes |
|---|---|---|
| `TOMTOM_API_KEY` | TomTom developer dashboard | Drive ETAs, traffic, routing |
| `HEA_API_KEY` | TheBus HEA API | Live bus arrivals |
| `AIRNOW_API_KEY` | AirNow | Air quality |
| `OPENAI_API_KEY` | OpenAI | Nalu AI. `OPENAI_MODEL` optional (default `gpt-5-mini`) |
| `SUPABASE_URL` | Supabase → Project Settings → API | |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase → API keys | |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API keys | Server-only. Never expose to the browser |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase → Project settings → Service accounts → Generate key | Whole JSON file as one secret. Enables direct push (`src/lib/fcm-direct.server.ts`) |
| `LOVABLE_CRON_SECRET` | Generate a long random string | Name kept as-is; protects `/api/public/*` cron routes |

No longer needed once self-hosted: `LOVABLE_API_KEY`, `FIREBASE_MESSAGING_API_KEY`.

## 3. Build-time variables (Cloudflare build settings; baked into the browser bundle)

| Name | Notes |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` | Same project as above |
| `VITE_AUTH_PROVIDER=supabase` | Switches Google/Apple sign-in from Lovable's broker to Supabase (`src/lib/social-sign-in.ts`) |
| `VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN` | Public Mapbox token (name kept as-is) |
| `VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY`, `VITE_LOVABLE_CONNECTOR_POSTHOG_REGION` | Analytics |
| `VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_*` (4) | Web push: app id, project id, VAPID key, web API key |
| `VITE_GA4_MEASUREMENT_ID` | Optional Google Analytics |

## 4. Database

- [ ] Get Lovable's export of the current database (schema, data, auth users)
- [ ] Apply `drizzle/migrations/*` in order to the new project (recreates tables and trip-planner functions)
- [ ] Import user data: profiles, saved places, push subscriptions
- [ ] Run the GTFS import once (`POST /api/public/import-gtfs` with `Authorization: Bearer <LOVABLE_CRON_SECRET>`; it resumes across calls until done). Repeat whenever TheBus publishes a new feed
- [ ] Recreate any extensions/settings Lovable's handoff lists (pg_cron, pg_net, storage, edge functions)

## 5. Sign-in

- [ ] Supabase → Authentication → URL configuration: site URL + redirect URLs for the new domain
- [ ] Enable Google provider with your own OAuth client
- [ ] Enable Apple provider (after Apple Developer enrollment)
- [ ] Email templates, if customized in Lovable

## 6. Scheduled jobs (Cloudflare Cron Triggers or an external scheduler)

Defined in Lovable today, not in this repo. Fill in from Lovable's handoff:

| Job | Route | Schedule |
|---|---|---|
| Push dispatch | `/api/public/push-dispatch` | _from handoff_ |
| GTFS import | `/api/public/import-gtfs` | _from handoff_ |
| Database cleanup | `select public.nalu_maintenance()` via pg_cron (migration 0037 enables pg_cron but does not schedule it) | _from handoff_ |

Both expect `Authorization: Bearer <LOVABLE_CRON_SECRET>`.

## 7. Domain cutover

- [ ] Update `SITE_URL` in `src/lib/site.ts`
- [ ] Update `public/sitemap.xml` and `public/robots.txt`
- [ ] Add the new domain to Supabase redirect URLs and the Google OAuth client
- [ ] Verify on the new host: welcome, browse, commute, live drive, bus arrivals, rail, weather, HDOT roadwork, Nalu AI, sign-in, push, saved places
- [ ] Only then cancel Lovable
