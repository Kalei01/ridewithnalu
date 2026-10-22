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

## 2026-10-19 (Mon) — structured-data date, backlog cleanup

**Evidence** (Search Console, 28 days to Oct 19): 668 impressions (449 on Oct 15), 6 clicks, position 11.7. Gate: RUN (impressions up 49% and 219; more new queries). /guides/skyline-park-and-ride 284 impr, 6 clicks (2.1% CTR, position 7.5). Airport guide 63 impr (position 22.6, driving-to-terminal queries); Kapolei 31 (position 14.9, up from 14); ʻEwa 14; /guides hub 16 (position 40.5). New queries are one-offs ("skyline parking" 8 impr at position 10.8, "skyline hours" 3 at 23, "kalihi transit center parking" 3). Nothing sits at position 5 to 20 with enough impressions to justify a title change, and the Oct 14 title/snippet changes plus the Oct 15 guide redesign are still inside the Nov 11 measurement window. Index status: 18 of 19 pages indexed; /disclaimer is still "Discovered - currently not indexed" (linked from every footer; nothing to do).

**Changed** (backlog item 7, narrowed)
- Every guide's schema.org WebPage said `dateModified: 2026-10-05`, though the guides changed on Oct 15. It now reads from one constant, `LAST_MODIFIED_ISO` (2026-10-15), next to the visible `LAST_UPDATED`. Bump both together when a guide's facts or content change.
- Not changed: the home page already carries WebSite, Organization and SoftwareApplication data (the app type Google recognises), so no second WebApplication block; FAQPage and BreadcrumbList already exist on guides. No FAQ/HowTo added.

**Backlog check:** answer-first (item 2) is delivered: the Oct 15 redesign gave the Kapolei, ʻEwa, Mililani, airport, UH Mānoa, late-night and comparison guides a "What to know" strip, and the Kapolei intro and takeaways already lead with the answer. Item 2 closed.

**Reviewers:** security-keys only (no UI, no transit facts changed).

**Rejected / not done:** rush-hour section (TomTom figures still unread at source); Pearl City and Pearl Harbor pages (no new demand); no titles or bodies changed.

**Backlog status:** 2 DONE, 7 DONE (narrowed), 5 blocked on TomTom source, 3 and 4 need demand, 6 DECISION. Next real step is the Nov 11 CTR read, factoring in the Oct 15 redesign.

## 2026-10-22 (Thu) — rush-hour section on /oahu-commute

**Evidence** (Search Console, 28 days to Oct 22): 828 impressions (668 on Oct 19), 6 clicks, position 11.4. Gate: RUN (new queries; impressions +24%, just under the 25% line). /guides/skyline-park-and-ride 331 impr, 6 clicks (1.8%, position 7.4). /guides/skyline-rail-guide 198 impr, 0 clicks, position 12.9 (was 9.2 on 90 impr; queries "skyline hours" 10 impr at 15.1, "rail hours" 5, "what time the light rail start running" 11, "what time the skytrain open" 12). Others: airport 64 (22.4), Mililani 47 (11.1), late-night 39 (6.8), Kapolei 38 (13.9), UH 28, ʻEwa 21, /guides hub 20 (43.1). Index: 18 of 19 indexed; /disclaimer still "Discovered - currently not indexed". Autocomplete from Oct 8 still shows "honolulu rush hour times".
- Rail guide position moved from 9.2 to 12.9 while impressions doubled. That fits more, broader queries, and the Oct 14 titles and Oct 15 redesign are inside the Nov 11 measurement window, so no titles or bodies were touched.

**Changed**
- New "How heavy is rush hour in Honolulu?" section on /oahu-commute (backlog item 5), answer first: rush hour adds about four to five minutes to a 10 km drive, and TomTom publishes no clock times. Figures read from tomtom.com/traffic-index/city/honolulu-hi/ in a rendered browser on Oct 22 (City view, which is the page's default): average 10 km trip 20 min 59 s; morning rush 25 min 6 s at 79.1% congestion; evening rush 26 min 19 s at 81.3%; 88 hours lost in rush hour, 1 hr 16 min more than 2024. The Metro view is lower (16 min 51 s morning, 18 min 38 s evening, 56 hours), and the section says so. No clock times and no promise about a rider's own route. Title, description and focus of /oahu-commute unchanged.
- Backlog correction: the earlier note blocking item 5 ("figures unreadable") is resolved by reading the rendered page. Note for next year: the same page also has a per-hour weekly grid that only shows values on hover; I did not use it.

**Reviewers:** transit-accuracy, mobile-design, security-keys (results below in the commit).

**Rejected / not done:** Pearl City and Pearl Harbor pages (no new demand); no hour-by-hour rush times (no citable source); no title changes before Nov 11.

**Backlog status:** 5 DONE (this run). 3, 4 need demand. 6 DECISION. Next real step is the Nov 11 CTR read, factoring in the Oct 15 redesign and this section.
