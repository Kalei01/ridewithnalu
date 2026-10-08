# Nalu search backlog

The `nalu-seo` agent's to-do list (moved here from the search routine's prompt on Oct 7, 2026, so it can be updated in the repo). The agent works top-down, updates statuses here, and records each run in `docs/seo/search-review-log.md`.

Status words: TODO, IN PROGRESS, DONE (date, commit), DECISION (needs the owner), SKIP.

## Audit findings (Oct 5, 2026) — what people search
- Route + modifier: "kapolei to honolulu drive time / train / commute", "bus from kapolei to honolulu", "traffic from ewa beach to honolulu", "pearl city to downtown honolulu train/bus".
- Rush-hour timing: "rush hour times in honolulu", "when does rush hour start/end in honolulu", "honolulu peak traffic times".
- Skyline station parking by station.
- Comparison phrasing ("is skyline faster than driving", "skyline vs driving") is NOT searched (results are Nissan cars) — don't target it as a keyword.
- Live "traffic now / accident today" is served by Maps and traffic cams — skip.

## Done
- DONE Oct 5: introduction served at "/" (no redirect); guide buttons open the planner pre-filled; park-and-ride count corrected to four; /guides/skyline-park-and-ride.
- DONE Oct 6 (human-led): "Popular commutes" links from "/" and /oahu-commute to the six trip guides; /oahu-commute retitled "Oʻahu Commute: When Driving, TheBus or Skyline Wins" with og:image; shared trip links preview as "Drive, TheBus or Skyline to <place>?"; ETA shares carry ?ref=eta; http:// → https:// redirect and one-month HSTS.
- DONE Oct 6 (search agent, e402e0d): 1. Kapolei and ʻEwa guides use the searched wording with a sourced drive-vs-train rule; 2. technical leftovers — /install title and og:image, canonicals on /privacy, /terms, /disclaimer, footer links to /guides and /roadwork.

## Next (only with evidence re-checked)
3. TODO Pearl City / ʻAiea to town guide (Kalauao, Waiawa, Hālawa stations) — one page, only if sourced facts are solid.
4. TODO Commuting to Pearl Harbor–Hickam (Makalapa station) — one page, sourced.
5. TODO "Honolulu rush hour": /oahu-commute's focus was set Oct 6 (choosing drive vs TheBus vs Skyline) — don't change its title or focus without Search Console evidence. A sourced rush-hour section on it is fine; it may cite TomTom's published Honolulu figures (2025: 50.5% congestion, 88 hours lost, 10 km in 25:06 morning / 26:19 evening rush) with attribution; no hour-by-hour start/end times without a citable source.
6. DECISION First-party drive-time sampling to answer "when to leave" — needs the owner's approval and a TomTom terms check. Never build it unasked.

## Later
- "Is Skyline running today" (only with an official live alerts feed).
- HART Dillingham closures on /roadwork.

## Skip
Comparison-keyword pages, live traffic pages, ZipperLane hours (unverified), best-bus-app page, windward highway choice.

## Standing date checks
- November 2026: update /guides/honolulu-marathon-traffic-2026 when official 2026 closures are published.
- After Dec 5, 2026: TheBus GTFS feed (valid Sept 28–Dec 5) expires; re-check guide facts and LAST_UPDATED.

## Queued Oct 8 (owner) — start only after the current build queue finishes (planner speed 2, then P-3/4/5; check docs/experience/backlog.md and docs/maintenance/alerts.md)
- TODO Answer-first format on the existing guides: the direct answer in the first two sentences, a short "Key takeaways" table, and a visible "Last updated" date. No new pages; keep each page's focus and sources.
- TODO Apply the writing rules in `.claude/agents/nalu-seo.md` when touching any guide (no filler intros, no generic AI phrasing, no em dashes).
- TODO Each run, read `docs/seo/ai-visibility.md`: if Josh logged that an assistant gave a wrong or missing answer about Nalu's topics, treat it as evidence for the next improvement.

## Trust & authority pages — APPROVED Oct 8 (owner: "done professional and full, not half-assed") — build after the business-tools session finishes
Built by a dedicated session (not the routine), one page at a time, full quality bar: premium design, Nalu voice, phone-first, structured data, internal links, mobile-design + transit-accuracy + security-keys reviews, live check.
1. **About page** (`/about`) — Josh's story, told warmly and simply. ONLY these facts (never invent more: no wife's name, no neighborhood, no job, no dates, no quotes he didn't say): his name is Josh; he's local to Oʻahu; he built Nalu mostly for his wife, so she'd know each morning whether to drive, take TheBus or ride Skyline, and when to leave. What Nalu promises (from the product rules): the core answer stays free; it decides and hands off to Google/Apple Maps; real data, never invented times; built and tested on Oʻahu for Oʻahu. Mahalo / local voice without tourist Hawaiian. Contact: the in-app "Tell Nalu something" box (from P-4). JSON-LD: AboutPage + Organization (founder: Person "Josh"), linked from the footer and the intro page.
2. **How Nalu decides** (`/how-nalu-decides`) — the methodology and data sources, accurate to the code (read `src/lib/intelligence/*`, `src/lib/transit-plan.ts`, CLOUD_CODE_CONTEXT.md; transit-accuracy must approve every claim): live drive time (TomTom), TheBus/Skyline timetable (GTFS, valid-through date), park-and-ride and drop-off, walking limits, Arrive by / Leave now, traffic and HDOT closures, weather, freshness/confidence labels, what Nalu doesn't do (no parking estimates, not a navigation app), how often data refreshes, and how to report a wrong answer. Plain English, a simple diagram, FAQ with FAQPage schema, links to official sources.
3. **Footer/E-E-A-T polish** — About, How Nalu decides, Privacy, Terms, Disclaimer and contact in a consistent footer on every public page; Organization `sameAs` only for profiles that really exist (ask none; omit if none); visible "Last updated" on these pages.
4. **Listings for Josh (one-time, he submits)** — `docs/seo/listings.md`: 5–10 real, currently-accepting places to be listed (verify each page exists and how to submit: e.g. UH Mānoa commuter/transportation resources, AlternativeTo, community or employer commute pages, Hawaiʻi tech/startup directories; no paid or link-scheme sites), each with the submission URL and ready-to-paste text (short and long description, category, one sentence on what's different). No posting by agents.

## Owner items to remind (drop when the owner confirms done)
(Oct 7: the owner won't request indexing manually; Google will crawl on its own. Report index status, but don't remind him to request indexing.)
Cloudflare WAF rate limit on /_serverFn/ (~300 req/min/IP); check Supabase backups; AirNow API key likely wrong.
