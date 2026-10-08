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
