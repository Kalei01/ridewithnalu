# Nalu search review log

Newest entry last. Each run of the twice-weekly search review appends one entry.

## 2026-10-06 (Tue) — first logged run

**Evidence**
- Search Console (sc-domain:ridenalu.com), 28 and 90 days: 0 clicks, 0 impressions, no queries or pages. Data only exists for Oct 3 and Oct 5 (both zero). Too early to judge anything from search data.
- Sitemap: 19 URLs submitted, no errors; Search Console reports 0 "indexed" in the sitemap summary, but URL inspection shows 13 of 19 URLs as "Submitted and indexed".
- URL inspection not yet indexed: /install (unknown to Google), /roadwork, /guides, /guides/uh-manoa-without-parking, /disclaimer (all "Discovered - currently not indexed").
- Autocomplete, Google results, Supabase and official-source checks were not run this time; with zero search data they would not change the choice of work. Nothing was extrapolated.

**Changed (backlog items 1 and 2)**
- Kapolei and ʻEwa guides: headings now use the searched wording ("Kapolei to Honolulu drive time on H-1", "…by train and bus", "ʻEwa Beach to Honolulu drive time", "…by train: bus to Skyline", "Drive or train? / Drive, bus or train? How to choose your commute"). Added a short rule of thumb to each, built only from timetable figures already on the page (train + A Line about 55–60 min on board from East Kapolei; 91 and E scheduled about 1 hr to 1 hr 20 min). No new times invented. Titles and descriptions unchanged.
- /install: title shortened to "Install Nalu on iPhone or Android | Nalu" (was 61 chars), og:image and twitter card added.
- Footer shared by public pages (LegalFooter) now links to /guides and /roadwork as well as /oahu-commute.
- Canonical links added to /privacy, /terms and /disclaimer.
- Sitemap lastmod bumped for /install and the two guides.
- Fixed a sideways scroll on phones (page 402 px wide on a 390 px screen) on the ʻEwa guide: the bus timetable stretched the page layout. Guide layout grids now cap at the screen width. Found by the mobile-design reviewer; present before this run.
- Reviewer notes: transit-accuracy flagged that the first draft of the Kapolei rule compared door-to-door drive time with on-board time only; reworded to include the wait and walk. security-keys: no findings.

**Sources** (as recorded in each page's own "Sources (checked …)" comment): TheBus GTFS timetable valid Sept 28 to Dec 5, 2026; thebus.org; City and County of Honolulu Skyline pages.

**Rejected / not done**
- Backlog 3–5 not started: nothing in the evidence yet justifies a new page; /oahu-commute focus left as set on Oct 6.
- Backlog 6 (first-party drive-time sampling): needs the owner's approval and a TomTom terms check; not built.

**Backlog status**
- 1 done. 2 done.
- NEXT 3 (Pearl City / ʻAiea), 4 (Pearl Harbor–Hickam), 5 (rush-hour section on /oahu-commute): open.
- Standing: November 2026 marathon closures update; after Dec 5, 2026 re-check TheBus facts and LAST_UPDATED.

## 2026-10-08 (Thu) — review only, no page changes

**Evidence**
- Search Console, 28 and 90 days (same totals): 0 clicks, 18 impressions, average position 14.7. Impressions by page: /guides/skyline-rail-guide 12 (position 12.3), /guides/honolulu-airport-without-driving 4 (position 25.8), /guides/kapolei-to-downtown 1 (position 9), the old http:// homepage 1. Queries (1 impression each): "skyline timetable" (position 10), "skyline transit honolulu" (48), "car to hnl terminal 1" (34), "car to hnl terminal 2" (28), "hnl terminal 1 pickup" (29), "escort" (4). Far too little to act on. The airport queries are about driving to the terminals, a different intent from the guide, at positions 28 to 34, so nothing to chase.
- Index status: 18 of 19 sitemap URLs are "Submitted and indexed" (up from 13 on Oct 6). Only /disclaimer is still unknown to Google. It is linked from every footer; the next crawl should find it.
- Google autocomplete: "honolulu rush hour times" and "honolulu rush hour traffic times" are suggested (demand for backlog item 5). "pearl city to downtown honolulu" is suggested (item 3). "aiea to downtown honolulu" and "pearl harbor hickam skyline" return no suggestions (weak demand for item 4). "skyline rail schedule", "skyline rail hours" and "skyline rail schedule today" are suggested; the existing Skyline guide already covers hours.
- Not run: Google results pages, Supabase, other official sources. With 18 impressions they would not change the choice below.

**Changed:** nothing on the site. Docs only.

**Why nothing changed**
- The trip and Skyline guides were edited today by the premium agent (07b055b, 004f6b6, d3d4e0d), so the 14-day rule applies; the answer-first format queued Oct 8 should wait until that polish is finished and the build queue is clear (planner speed 2 is not yet applied to production; honest-loading batch still in progress).
- Item 5 (rush hour): the demand is real, but TomTom's Honolulu page loads its numbers with scripts, and my fetch could not confirm the backlog's figures (50.5% congestion, 88 hours, 25:06 and 26:19 for 10 km). Not published until someone can read them on the page.
- Item 3 (Pearl City / ʻAiea): some demand, but needs sourced station facts first. Item 4 (Pearl Harbor–Hickam): no autocomplete demand, so lowered.

**Backlog status:** 3 TODO (some demand), 4 TODO (weak demand), 5 TODO (blocked on verifying TomTom figures), 6 DECISION. Oct 8 queue items and trust pages unchanged. docs/seo/ai-visibility.md has no entries yet, so no assistant-answer evidence this run.

## 2026-10-14 (Wed) — strategy session, on-site items built by the SEO session

**Evidence** (Search Console, 28 and 90 days): 374 impressions, 4 clicks, position 10.3. /guides/skyline-park-and-ride 157 impr (4 clicks, pos 7.0); /guides/skyline-rail-guide 88 (pos 9.2, 0 clicks; queries skyline hours, schedule, fare, timetable); late-night 19 (pos 6.3). Strategy and sources: docs/seo/strategy.md.

**Changed** (guides.ts, two guide pages, sitemap lastmod)
- Rail guide title "Skyline Hours, Schedule and Fares (2026) | Nalu" (47 chars) with an answer-first description (daily about 4 AM to 10:30 PM, every 10 min until 8:30 PM, $3 HOLO). Park-and-ride title "Skyline Parking: 4 Free Park-and-Ride Lots | Nalu", description names the lot that fills by 8 AM. Late-night title now mentions the last Skyline train. Measure CTR again about Nov 11; change nothing sooner.
- Station names on the rail and park-and-ride guides now read English first, Hawaiian second, per docs/product/direction.md ("Ahua" spelled as in that table). The rail station table dropped its Parking column (folded into connections) so it fits phone width better.

**Not built:** the planned /guides/skyline-fares-and-hours. The rail guide already answers hours, fares and last trains; a second page would compete with it for the same searches. Improved the existing page instead.

**Reviewers:** security-keys no findings; transit-accuracy no critical or high (prose name order fixed); mobile-design flagged the wide station table (narrowed, not re-screenshotted because the local check failed) and a hydration warning seen against a stale dev server.

**Still open:** other guides (Kapolei, ʻEwa, Mililani, airport, UH) and guides.ts line 88 still use the old name order and "Āhua"; src/lib/commute-formatting.test.ts expects the old order. Rail table width needs a phone recheck.

## 2026-10-15 (Thu) — station names on the other guides, answer-first Kapolei guide

**Evidence** (Search Console, 28 days to Oct 15): 449 impressions (18 on Oct 8), 5 clicks, position 10.5. Gate: RUN (impressions up well over 25% and 20; many new queries). Pages: /guides/skyline-park-and-ride 200 impr, 5 clicks (2.5% CTR, position 7.0); /guides/skyline-rail-guide 90 (position 9.2, 0 clicks); /guides/honolulu-airport-without-driving 62 (position 22.4, queries are about driving to the terminals); late-night 19 (position 6.3); mililani 17; kapolei 14 (position 16.2); ʻEwa 12; UH 12. Queries are mostly Skyline parking and hours, plus airport pickup/drop-off. Index status: all pages seen in the report are indexed; no change to chase. The titles/snippets changed on Oct 14 are too new to judge; CTR is compared again about Nov 11 and nothing was changed on those pages' titles this run.

**Changed** (backlog 2: station names, answer-first)
- Station names now read English first, Hawaiian second, per docs/product/direction.md, on the Kapolei, ʻEwa, Mililani, airport, UH Mānoa, late-night and Skyline guides, the station list on /oahu-commute, and the descriptions in guides.ts. Short Hawaiian-only mentions were rewritten to the English name. Source stop names quoted from TheBus ("Lelepaua Airport Station") and street/gate names (Kualakaʻi Parkway, Hālawa Gate) were left alone. The park-and-ride guide still names its four lots by their Hawaiian station names in headings and table rows on purpose: it is the page earning clicks, so only the sentences that already carried English names were touched.
- Kapolei guide: the first two sentences now give the answer with the timetable figures already on the page (about 32 minutes to Lagoon Drive plus a bus, 55 to 60 minutes on board), and a four-row "Key takeaways" table was added (drive, Skyline plus A Line, CountryExpress C, park-and-ride). No new figures.
- Sitemap lastmod set to Oct 15 for the pages touched.

**Sources:** TheBus GTFS timetable valid Sept 28 to Dec 5, 2026 and the other sources recorded in each page's own comment; station table in docs/product/direction.md.

**Rejected / not done:** Rush-hour section (TomTom figures still unread at source). Pearl City and Pearl Harbor pages (no new demand evidence). Article/Organization structured data (item 7) left for the next run so each run stays at one or two items. No titles changed on the Oct 14 pages.

**Backlog status:** station names DONE on all guides except the lot names on the park-and-ride page (deliberate). Answer-first: Kapolei DONE; next ʻEwa, then Mililani, airport, UH. Item 7 next. Item 5 still blocked.
