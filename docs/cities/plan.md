# Nalu in more cities — plan (decided Oct 8, 2026)

Owner: Josh. Status: **waiting** (no budget yet; Opus build work waits for usage limits). Nothing here is built.

## Decisions
- **Brand:** stays "Nalu". Bay Area version shown as **"Nalu · Bay Area"** (short label "SF"); web pages under ridenalu.com/bay. Never "San Fran".
- **Code layout:** one repo, one engine, one folder per city ("city pack": `cities/oahu/`, `cities/bay-area/`) holding that city's data sources, transit systems, wording, guides and closure feeds. No separate repos.
- **Data:** each city gets its own database. Bay Area transit comes from 511 SF Bay (one free key, `BAY511_API_KEY`, already added to the Claude environment and Cloudflare). Size measured: ~390 MB for the 8 main agencies (`docs/cities/bay-area-data.md`).
- **Order:** finish Oʻahu fixes first (the false "no Skyline trip" at rush hour; trip speed) → turn Oʻahu into the first city pack with no rider-visible change (side-by-side proof) → add the Bay Area.

## Budget (Supabase, owner checked Oct 8)
- Nalu runs on the **Free plan**: shared CPU, 500 MB RAM, 500 MB database cap, 5 GB egress/month, **no backups**.
- Pro is $25/month (first project included; daily backups for 7 days; Oʻahu would move to Micro, 1 GB). Bay Area database on Small ≈ +$15/month → ~$40/month total. **Deferred by the owner** — no spending until he says so.
- While on Free: the Bay Area can be built and tested on a second free project with only Muni, BART and Caltrain (~1.37M stop_times, roughly Oʻahu's size). Free projects pause after inactivity, so this is for testing, not launch.

## Risks to keep in view while on Free
- No backups of rider data (accounts, saved places, feedback). Before launching anywhere new, revisit Pro or a free backup alternative.
- Egress: 5 GB/month. The Sunday cost check (P-3) alerts at 70%.
