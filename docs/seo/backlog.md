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

## Owner items to remind (drop when the owner confirms done)
Request indexing in Search Console for any page Google lists as unknown or not indexed; Cloudflare WAF rate limit on /_serverFn/ (~300 req/min/IP); check Supabase backups; AirNow API key likely wrong.
