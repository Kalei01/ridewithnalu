# Nalu SEO strategy: how ridenalu.com earns #1 (Oct 14, 2026)

Research only; no site code changed. Plain English. Goal from Josh: #1 on Google for what Oʻahu commuters really search. White-hat only.

## 1. Where we are (Search Console, Sept 17 to Oct 14, 2026; 90 days is identical)
- 374 impressions, 4 clicks, average position 10.3. The site is new; Google indexes it but barely knows it.
- One page carries it: /guides/skyline-park-and-ride (157 impressions, 4 clicks, position 7.0; "skyline parking lot" at 4.2 earned a click). That is the proof that sourced, specific pages can rank fast.
- Next: /guides/skyline-rail-guide 88 impressions at 9.2, 0 clicks (queries: skyline hours, schedule, fare, timetable at positions 7 to 10); /guides/honolulu-airport-without-driving 50 impressions at 20.5 (people mostly want terminal pickup, not our intent); late-night 19 at 6.3; Kapolei 13 at 16.4; Mililani 13 at 14.8; ʻEwa Beach 10 at 16.2.
- Position 7 to 10 with 0 clicks means the title and snippet are not winning, not that ranking is missing. Fixable cheaply.
- Search Console shows 0 clicks for anything about commute decisions ("kapolei to honolulu" 1 impression at 20). The decision queries are still unclaimed.

## 2. What Google says (and what that means for us)
- AI Overviews and AI Mode need no special markup; normal SEO fundamentals apply, and both "fan out" into several sub-searches, so pages answering a specific sub-question get picked up (Google Search Central, "AI features and your website", developers.google.com/search/docs/appearance/ai-features, read Oct 2026).
- Core updates (March and May 2026) and spam updates (March, August, September 2026) hit thin, templated and mass-produced pages hardest; sites adding original, sourced information did better (agency analyses: STM Agency, O'Brien Media, GSQI Aug 2026 case studies; third-party, not Google). Scaled content abuse is judged by intent, not by whether AI wrote it (Google spam policies, revised Aug 2026, via ppc.land summary).
- FAQ rich results were limited to government and health sites in 2023 and reportedly retired May 2026; HowTo rich results were removed in 2023 (Search Engine Journal; Seer Interactive; secondary, re-check on Google's docs). Our FAQ and HowTo JSON-LD is harmless but earns no rich result. Do not spend effort on more of it.
- Limit of this research: the search tool I had returns results, not Google rank positions. I could not read live Google rank order. Treat "who wins" below as the sources the search returned, then verify by hand.

## 3. Who we are up against
- **Rome2Rio** shows pages for Kapolei to Honolulu routes: generic, automated, one fixed estimate (about 27 min drive, "not traffic-adjusted"). Gap: no live traffic, no rush-hour reality, no Skyline-plus-bus logic.
- **Local news** (KITV 2023 test, KHON2, Hawaii News Now, Star-Advertiser) owns "is Skyline faster than driving". Gap: the KITV test is from 2023, before the 2025 extension, and never timed the drive. A current, honest comparison is open ground.
- **honolulu.gov/dts** owns "skyline stations and parking" and hours. We cannot beat the city on its own facts, but we can be clearer and answer more (which lot fills by 8 AM; hours plus what to do after it stops). Our park-and-ride guide already sits at 4 to 7.
- **Hawaii Magazine, The Oahuist** own guides ("Your Guide to Riding Honolulu's Skyline", "Kapolei commute guide: rail, H-1 and parking"). Gap: dated, editorial, not updated when stations open.
- **Transit app** is the city's official planner (the city retired DaBus; Spectrum News, Aug 2025). It plans trips but does not answer "should I drive today". Not a search competitor; it is a hand-off.
- **TomTom Traffic Index** owns Honolulu congestion statistics. Cite it; do not try to outrank it.

## 4. Target queries, ranked by value × winnability
Honest odds are for a brand-new domain with a few weeks of data. "#1" means first organic result on mobile in Honolulu.

| # | Query group | Value | Odds of #1 | Timeline | Move |
|---|---|---|---|---|---|
| 1 | skyline parking, park and ride (by station, Kapolei) | High, rising: lots fill by 8 AM (Hawaii News Now, May 2026) | Already 4 to 7. #1: about 40% | 1 to 3 months | Keep page current; add lot-full tips and real stall counts |
| 2 | skyline hours, schedule, fare, last train | High | #1 unlikely (city). Top 3: about 30% | 3 to 6 months | New /guides/skyline-fares-and-hours (item 9) plus rewrite the title and snippet of the rail guide |
| 3 | kapolei / ewa beach / mililani to honolulu (drive, train, bus, time) | Highest: the core Nalu user | #1 about 15% in 6 months; top 5 about 50% | 4 to 9 months | Make each trip guide the best current answer, sourced, updated monthly |
| 4 | honolulu rush hour times | Medium, steady | Top 5 about 35%; #1 about 10% | 3 to 6 months | Sourced section citing TomTom (item 5); only after the numbers are re-read |
| 5 | drive or skyline from kapolei (comparison) | Medium; low volume today, news owns it | #1 about 20% once a dated comparison exists | 6 to 12 months | One dated, sourced comparison inside the Kapolei page, not a new page |
| 6 | airport to waikiki without a car | Medium; tourists, crowded by blogs and the airport site | #1 under 10% | 9+ months | Improve the existing guide; do not chase |
| 7 | "nalu app", "ridenalu" (brand) | Small now | #1 about 95% | Weeks | Free; will happen once Google ties the name to the site |
| 8 | pearl city / aiea to downtown | Low | Top 5 about 40% | 6 months | Item 3, only with sourced station facts |

Plain outlook: brand and park-and-ride #1 within months is realistic. #1 for "kapolei to honolulu" is a 6 to 12 month goal that depends on links and on being the freshest, most honest answer, not a promise. Skip the claim "we will be #1 everywhere".

## 5. On-site plan
1. Stop the zero-click leaks: rewrite title and snippet only where impressions exist at position 3 to 12 (rail guide, park-and-ride, late-night). Keep ≤ 60 chars, add the question people type ("Skyline hours and last train"). Measure CTR change in 4 weeks.
2. Answer first: direct answer in the first two sentences, a short key-facts table, visible "Last updated" date. Already queued; run it as one guide per run.
3. Station names: change guides to "English (Hawaiian)" as in docs/product/direction.md. Searchers type "kapolei rail station parking" and "lelepaua skyline station", so both names must appear on the page.
4. Internal links: every trip guide links to the park-and-ride, hours and rail guides; the home page links to the six trip guides. Use descriptive anchor text, no sitewide keyword blocks.
5. Canonical, sitemap lastmod and llms.txt stay current. Only bump lastmod when a page really changed.
6. Add structured data we lack (Organization, WebApplication, Article dateModified; item 7). FAQ and HowTo: leave as is; add no more.

## 6. Content plan: few, excellent, sourced pages
- Rule: improve before adding. Freshness is the edge over magazines and blogs: every guide shows a "checked" date and cites honolulu.gov, thebus.org, HART or TomTom.
- Add at most these, one at a time: /guides/skyline-fares-and-hours (verify: trains every 10 min until 8:30 PM then every 15, daily to about 10:30 PM since Oct 16, 2025, per city notices; fare $3 with free transfers inside 2 hours, check the exact window), a Pearl City / ʻAiea page if autocomplete keeps showing demand, a Kailua / Kāneʻohe page only if Search Console shows demand.
- One original asset worth building once Phase 3 settles: a monthly "Kapolei to town: what the data shows" note using Nalu's own planner results for sample trips, clearly labelled as Nalu's estimates (original data is what Google and AI systems reward). Needs Josh's OK on method (see backlog item 6, TomTom terms).
- Do not publish: "best bus app" lists, Nalu vs Moovit/Transit pages, ZipperLane hours, live traffic or "accident today" pages, anything unverified.

## 7. Technical plan
- Phase 3 (the split of src/routes/index.tsx) first, then item 11: lazy-load the home map and trip widget, keep guides fully server-rendered, set image width and height, cache hashed assets for a year. Core Web Vitals are a tie-breaker, not a ranking jump; the gain is real users on phones at a bus stop.
- Keep a clean robots.txt, one canonical per page, HTTPS and HSTS (done), no JS-only content on guides.
- Add a monthly check: all sitemap URLs "indexed" (/disclaimer was unknown on Oct 8), no soft 404s, no accidental noindex.
- Do not create crawlable trip-planner URLs for every place pair. That is a doorway-page risk.

## 8. Authority and outreach plan (the part that moves rank 4 to 1)
Links and mentions from real Hawaiʻi sources are the biggest remaining lever; a page with more links tends to outrank peers (Ahrefs, 2023, correlation only), and links cannot rescue a thin page.
- Earn them with something useful: the current, honest, sourced Kapolei commute comparison is a story for local reporters (KITV, Hawaii News Now, KHON2, Star-Advertiser, Civil Beat, Hawaii Public Radio's The Conversation covered Skyline in Sept 2026). Josh's real story is the pitch: a local built it so his wife knows each morning whether to drive.
- Likely legitimate places (all are asks for Josh to make; agents never contact anyone): UH West Oʻahu and UH Mānoa commuter and transportation pages; the OahuMPO Citizen Advisory Committee (public, monthly) and its resources; Hawaiʻi Bicycling League and other transport groups; Kapolei and ʻEwa neighbourhood boards and community Facebook groups; employer commute pages (Kapolei Business Park employers); Hawaiʻi tech and startup directories; Product Hunt and AlternativeTo (one honest listing each).
- Reddit r/Honolulu and r/Hawaii: answer real questions helpfully, disclose that you built Nalu, link only when it answers the question, and follow each subreddit's self-promotion rules. A single disclosed answer is fine; repeated links are spam and get the account banned.
- A listings file with ready-to-paste text is already planned (docs/seo/listings.md).
- Google Business Profile: not eligible. Google's help page says online-only businesses with no physical location customers visit are not eligible. Do not invent an address or a "service area" to qualify; that gets profiles suspended.
- "Powered by Nalu" / embed: later. A small "Drive or Skyline?" widget for employers or UH with a visible link back is a good natural-link idea, but only after the core answer is fast and the rules for the embed link (a plain link, not a hidden one) are settled.

## 9. AI-answer plan (Google AI Overviews, ChatGPT, Perplexity)
- Pages that rank high in Google are cited more: in one large study (AirOps, 548,534 retrieved pages, reported by Search Engine Land, March 2026), #1 Google pages were cited 3.5× more than pages outside the top 20, but only 15% of retrieved pages were cited at all. Ranking comes first.
- What gets cited: answer-first passages, specific numbers with a named source, a visible date (vendor studies, so treat as directional). That is the same format as our on-site plan, so no separate trick is needed. No special schema or llms.txt is required for Google (Google AI features guidance); keep llms.txt as a harmless, accurate summary.
- Wrong answers are the real risk: Skyline hours, fares and station names have all changed in a year. Keep every fact dated and sourced so assistants quote the right one.
- Measure monthly with docs/seo/ai-visibility.md (10 fixed questions). Josh logs it in 5 minutes; a wrong answer about our topics becomes the next fix.
- Google reportedly added AI-search reporting to Search Console in mid-2026 (secondary sources). Check whether it appears for ridenalu.com.

## 10. What NOT to do, and why
- Buying links, link swaps, "guest post" packages, private blog networks: Google's link-spam policy; the penalty can remove the whole site.
- Mass or near-duplicate pages (one per neighbourhood, per station pair, per street): scaled content abuse and doorway pages; the Aug and Sept 2026 spam updates hit exactly this, sometimes domain-wide.
- AI-written filler, scraped timetables or news text: same policy; and copied official data adds no information gain.
- Fake or incentivised reviews, fake testimonials, fake author bios: policy violation and a trust loss that is hard to repair. The About page says only what Josh said.
- Hidden text, keyword stuffing, cloaking, showing Googlebot a different page: manual action.
- A fake address for Google Business Profile: suspension.
- Chasing "Skyline vs driving" as a keyword page: earlier audits found no search demand; put the comparison inside the Kapolei guide.
- Changing titles and URLs repeatedly: resets what Google learned. One change, then wait 4 weeks.

## 11. How we measure
- Weekly (routine): `bun scripts/gsc-report.mts` totals, the 10 target queries' position and clicks, CTR on pages at positions 3 to 12, and the indexed count from `INSPECT=1`.
- Milestones: by Dec 2026 expect 1,000+ impressions a month and 20+ clicks; by Mar 2027, top 5 for "skyline parking" and "skyline hours", and first Kapolei-to-town impressions at positions under 10. If impressions are flat after two months of fixes, the problem is authority, not content: push outreach.
- Monthly: AI visibility log; competitors' dates (is the KITV or Oahuist page still older than ours?).
- Log everything in docs/seo/search-review-log.md; never report a result before the data supports it.

## 12. What only Josh can do
1. Outreach in your name: send the pitch to 3 to 5 local sources (a reporter, UH West Oʻahu, one neighbourhood board). I will draft each message; you send it. About 30 minutes each, once.
2. Submit the one-time listings (AlternativeTo, Product Hunt, one or two Hawaiʻi directories) from docs/seo/listings.md. Use your real accounts.
3. Reddit: if you want, answer two or three real r/Honolulu questions yourself, saying you built Nalu. Do not use alt accounts.
4. Monthly 5-minute AI check from docs/seo/ai-visibility.md.
5. Search Console: confirm the new AI performance report appears for ridenalu.com (screenshot to the lead session); nothing else needs requesting, Google crawls on its own.
6. Decide backlog item 6 (first-party drive-time sampling): approve or reject. It is the one source of original data that could earn links, and it needs a TomTom terms check.
7. Money: none required. Optional later: Google Ads is allowed without a Business Profile, but it is not SEO; do not spend until the planner is fast.
