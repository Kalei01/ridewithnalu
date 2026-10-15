# Nalu search backlog

**Josh's rule (Oct 13):** organic only. No pitching, outreach, listings, directory submissions or Reddit posts; never ask Josh to do them. Grow from the site itself.

The `nalu-seo` agent's to-do list (moved here from the search routine's prompt on Oct 7, 2026, so it can be updated in the repo). The agent works top-down, updates statuses here, and records each run in `docs/seo/search-review-log.md`.

Status words: TODO, IN PROGRESS, DONE (date, commit), DECISION (needs the owner), SKIP.

## RUN ORDER (Oct 14, 2026; from docs/seo/strategy.md). The Mon/Thu routine works top-down, 1-2 items per run
Statuses stay on the numbered items below; this list only sets the order.
1. DONE Oct 14 (titles/snippets on the three pages; re-measure CTR Nov 11). Item 8, narrowed: rewrite the title and snippet of /guides/skyline-rail-guide (88 impressions, position 9, 0 clicks: skyline hours, schedule, fare), then /guides/skyline-park-and-ride (157 impressions, 4 clicks, position 7) and /guides/late-night-commuting (19, position 6). One change per page, then wait 4 weeks and compare CTR.
2. IN PROGRESS (station names DONE Oct 15 on all guides; answer-first DONE on Kapolei Oct 15, next ʻEwa, Mililani, airport, UH, one per run). Queued Oct 8: answer-first format plus a visible "Last updated" date, one guide per run, starting with skyline-park-and-ride, skyline-rail-guide, kapolei-to-downtown. Add the station-name update (English first, Hawaiian second) in the same edit.
3. SKIP Oct 14 (rail guide already covers it; duplicate intent). Item 9: /guides/skyline-fares-and-hours (official sources only; verify the transfer window and hours first).
4. Item 7: Organization, WebApplication and Article dateModified structured data. No new FAQ or HowTo (Google no longer shows them).
5. Item 5: rush-hour section with TomTom figures, once the numbers are re-read at the source.
6. Item 3, then 10: only if autocomplete or Search Console still shows demand.
7. Item 11: homepage speed, after Phase 3.
Not in the routine's hands: trust pages (separate session), item 6 (listings and outreach dropped: organic only).
Each run: check the 10 target queries in strategy.md section 4 with `bun scripts/gsc-report.mts`, record positions in the log.

## Josh asks (short; details in docs/seo/strategy.md section 12)
- Monthly: the 5-minute AI check in docs/seo/ai-visibility.md.
- Check Search Console for the new AI performance report on ridenalu.com.
- Decide item 6 (first-party drive-time sampling).
- Google Business Profile: not eligible (online-only); don't create one with a made-up address.

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
3. TODO (Oct 8: autocomplete shows "pearl city to downtown honolulu"; still needs sourced station facts) Pearl City / ʻAiea to town guide (Kalauao, Waiawa, Hālawa stations) — one page, only if sourced facts are solid.
4. TODO (Oct 8: no autocomplete demand for "pearl harbor hickam skyline" or "aiea to downtown honolulu"; lowest priority) Commuting to Pearl Harbor–Hickam (Makalapa station) — one page, sourced.
5. TODO (Oct 8: autocomplete shows "honolulu rush hour times"; blocked until the TomTom figures below are re-read on tomtom.com/traffic-index/city/honolulu-hi/, which loads them with scripts and could not be fetched as text) "Honolulu rush hour": /oahu-commute's focus was set Oct 6 (choosing drive vs TheBus vs Skyline) — don't change its title or focus without Search Console evidence. A sourced rush-hour section on it is fine; it may cite TomTom's published Honolulu figures (2025: 50.5% congestion, 88 hours lost, 10 km in 25:06 morning / 26:19 evening rush) with attribution; no hour-by-hour start/end times without a citable source.
6. DECISION First-party drive-time sampling to answer "when to leave" — needs the owner's approval and a TomTom terms check. Never build it unasked.

## Josh's SEO pass (Oct 13, 2026; trimmed by NALU MAIN, approved by Josh). Start after Phase 2; 1–2 items per run, top-down
7. TODO Missing structured data only: Organization + WebApplication (free, PWA, Add to Home Screen) on / and /install; Article with dateModified from the page's "Last updated" on guides. FAQ/HowTo/Breadcrumb/WebSite already exist in src/components/guides/guide-head.ts; reuse them and don't duplicate. Validate the JSON-LD.
8. TODO Titles and descriptions: rewrite only pages where Search Console shows impressions with low CTR. Location keyword first, ≤ 60 chars incl. " | Nalu", descriptions 140–160 chars. Leave /oahu-commute's title alone (rule 5 above).
9. TODO New page: /guides/skyline-fares-and-hours (hours, frequency, fares, first/last trains), official sources only (DTS/HART/TheBus), month/year labelled. Check the transfer window (believed 2.5 h, not 2) and which stations are open now. Publish nothing unverified.
10. TODO New page, only if Search Console or autocomplete shows demand: /guides/kailua-kaneohe-to-honolulu (bus routes; Pali vs Likelike vs H-3; no rail). Sourced.
11. WAITS for Phase 3's split of src/routes/index.tsx (Oct 14; was Phase 2). Speed: lazy-load the homepage map/trip widget so it doesn't block LCP; guides fully server-rendered; image width/height/alt; cache headers (immutable hashed assets, short TTL /roadwork). Measure before/after (LCP, CLS, TBT). Run the mobile-design and nalu-performance reviewers.
SKIP from that prompt: an "airport to Waikīkī" page (duplicates /guides/honolulu-airport-without-driving; improve that page instead if data shows demand); a "Nalu vs Moovit vs Transit" title (comparison phrasing isn't searched); Waikīkī car-free, HOLO card, Ko Olina and Hawaiʻi Kai pages for now (no evidence yet; never batch pages); publishing [VERIFY] facts.

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
4. SKIP (Josh, Oct 13: organic only, no listings or submissions).

## Owner items to remind (drop when the owner confirms done)
(Oct 7: the owner won't request indexing manually; Google will crawl on its own. Report index status, but don't remind him to request indexing.)
Cloudflare WAF rate limit on /_serverFn/ (~300 req/min/IP); AirNow API key likely wrong. (Supabase backups: checked Oct 8 — Free plan has none; Pro deferred for budget, see docs/cities/plan.md. Do not remind.)

- **Skyline station names on guide/SEO pages** (from the station-names build, Oct 11, 2026): the app now shows "English name" with the Hawaiian name under it (table in docs/product/direction.md). Update the public guide pages to use the same names and spelling. Not done by the build session; SEO owns these pages.
