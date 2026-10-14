# Hawaiʻi traffic sources — can Nalu use them? (research, Oct 14, 2026)

Research only; no app code changed. Question from Josh: is there a free "Traffic Management System" feed that makes Nalu's Drive time more reliable than TomTom?

## Short answer
**No free, usable travel-time feed exists.** The site Josh remembers is almost certainly **GoAkamai** (HDOT + City & County of Honolulu). HDOT **turned off its travel times, traffic flow map, incidents and alerts on Oct 1, 2021** (HDOT notice, posted Sept 30, 2021: "Changes coming to GoAkamai.org website"). It said those are "now readily available on free third-party applications", meaning Google, Apple, Waze and similar. Only **camera views** stayed on GoAkamai. So there is nothing on it to compare with TomTom, and it cannot explain the 41–43 vs 31–33 min gap.

Limits of this research: the sandbox could not reach goakamai.org, data.honolulu.gov, opendata.hawaii.gov or 511 hosts (blocked or no DNS), so I fetched no live samples. Facts below come from HDOT pages I could read (hidot.hawaii.gov) and search results. Nothing was scraped.

## Verdict per source
| Source | What it is | Verdict |
|---|---|---|
| **GoAkamai.org** (HDOT/City) | Was the travel-time site (73 radar stations plus plate-reader cameras, launched 2010). Since Oct 2021: **camera snapshots only** (about 200 cameras, refreshed about every 5 min per older notices). | **No** for times. Cameras: no (see terms). |
| **City Traffic Management Center (DTS)** | Control room: about 350 downtown signals, city cameras. Not a public data service; I found no feed or API. | **No** |
| **HDOT travel-time signs / Blyncsy** | Windward and H-1/H-201 sign messages once used GoAkamai data. HDOT links a Blyncsy "commuter dashboard" (pulse.blyncsy.com/commuter_dashboard/hidot) that its page labels **Big Island**, not Oʻahu. | **No** (wrong island, private vendor) |
| **Freeway Service Patrol** | Tow/assist trucks on Oʻahu freeways. Only hours notices found. No data. | **No** |
| **Zipper Lane / contraflow hours** | Published as a plain schedule: H-1 East zip lane 5:30–9 a.m.; Nimitz East 5:30–9; Kalanianaole West 5–8; Kahekili South 4:30–8:30; Farrington West 3:30–6:30 p.m. "depending on traffic" (hidot.hawaii.gov/highways/special-use-lanes/; the page's own date is inconsistent, so confirm). Holiday suspensions are announced as news posts and on @DOTHawaii. No live-status feed. | **Maybe**: as a hand-checked static schedule for explanatory context only. |
| **HDOT roadwork page and ArcGIS** | Already in Nalu (`hdot-lane-closures.functions.ts`). HDOT news posts (e.g. H-2 two-lane closure, Oct 5) feed it. | **Use** (already used). |
| **State GIS (geodata.hawaii.gov)** | Road geometry (HPMS roads), not live traffic. | **No** for traffic; maybe for geometry later. |
| **Honolulu open data (Socrata)** | About 74 datasets. Only a camera-locations file (as of 2015, no license shown). No live traffic. | **No** |
| **Hawaiʻi 511 (phone)** | Phone service launched 2013, tied to GoAkamai; travel times went away with it. No 511 web data or API found for Hawaiʻi. | **No** |

## Terms and access (what I could confirm)
- GoAkamai disclaimer (per search result): content belongs to HDOT and the City; **no publishing, display, distribution or commercial use without written permission.** Treat scraping its cameras as forbidden.
- State eHawaii terms: no access except through the interface provided, and no commercial use or resale of derived data, without a written agreement.
- HDOT GIS disclaimer: no accuracy or timeliness guarantee; commercial and attribution terms are not on the page (defers to the eHawaii terms).
- No documented API, key, or rate limit found for any Oʻahu traffic-time source.

## The TomTom vs Google/Apple gap
Not explained by any Hawaiʻi source. Oct 12 check already showed the normal route, no padding (see `docs/passdown/main.md`): TomTom's own estimate is higher. Google, Apple and Waze blend phone-probe data that Nalu cannot get from a public source. Realistic ways to narrow the gap are outside this research:
1. **Calibration log, no new provider:** save TomTom live and typical for 2–3 fixed corridors on weekdays (with Google/Apple readings Josh notes by hand) for two weeks, then see whether the error is steady (about −25%) or varies. A steady error could justify an honest "TomTom often runs long on this route" note. A varying one means do nothing.
2. **Second paid provider** (HERE, Google Routes): costs money, and CLOUD_CODE_CONTEXT says not to casually swap TomTom. Needs Josh. Not recommended until the log shows a pattern.

## How it would fit Nalu's model
Provider → evidence → verdict stays as is. Only two Hawaiʻi items fit as **supplemental evidence**, never replacing TomTom:
- **Zipper/contraflow schedule** (static table): a line such as "H-1 Zip Lane is open until 9 a.m." in Drive Details. Hand-written, with a "check HDOT" note, and holiday handling needed.
- **HDOT roadwork:** already live.

## Effort, risk, what needs Josh
- Zipper schedule context: about 0.5 Sonnet day (data file, one Drive Details line, tests). Risk: hours change or holidays make it wrong, so show it only as "usually".
- Calibration log: about 1 Sonnet day (a scheduled script writing to a small table, plus a notes sheet). Risk: low; adds storage.
- A request to HDOT/City for a data agreement: **needs Josh** (email or call HDOT Highways Traffic Branch; no cost known). Low odds; they shut the feeds off in 2021.
- Nothing here needs a key, sign-up or spending today.

## Recommendation
Do not build a Hawaiʻi traffic-time integration; there is none to build. Keep TomTom. Optionally, do the calibration log first and decide on the zipper schedule note afterward.

Sources: HDOT "Changes coming to GoAkamai.org website" (Sept 30, 2021); hidot.hawaii.gov/highways/ and /special-use-lanes/ and /gis-data-disclaimer/ (read Oct 14, 2026); GoAkamai disclaimer and eHawaii terms (via search results, not fetched directly); HDOT 2013–2018 releases on GoAkamai technology.
