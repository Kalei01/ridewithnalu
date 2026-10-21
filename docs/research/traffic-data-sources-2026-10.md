# Traffic data sources for Nalu (drive times + incidents), Oct 2026

Research date: 2026-10-21. Read-only research for NALU MAIN.

**Method and limits (read first).** WebSearch only. Direct fetches of official pages (mapbox.com, developers.google.com, here.com, data.honolulu.gov) were blocked from this sandbox (DNS/proxy 403), so most prices below come from search summaries of official pages or third-party pricing sites. Every figure is tagged: **[official-snippet]** = search result quoted an official vendor page; **[3rd-party]** = blog/aggregator; **[UNVERIFIED]** = conflicting or missing. Josh or a session with open web access must confirm the pricing pages before any contract or card is entered. Nothing here is invented; gaps are listed.

## 1. Hawaii / Honolulu public feeds

| Source | What | Format / refresh | Fields | Auth / terms | Verdict |
|---|---|---|---|---|---|
| **Honolulu Open Data "Traffic Incidents"** (dataset ykb6-n5th) https://data.honolulu.gov/Public-Safety/Traffic-Incidents/ykb6-n5th | HPD traffic updates, "last 24 hours" | Socrata dataset; OData endpoint offered; Socrata JSON/CSV endpoints are standard but I could not hit them (403 in sandbox). Listing says updated every 5 minutes; page showed updated 2026-10-20 | Date, Time, Type, Address, Location, Area (6 fields). No lane or severity field | No key needed for basic Socrata reads (standard Socrata behaviour, not confirmed on this portal). Portal terms (dated 03/01/2015): https://data.honolulu.gov/terms-of-use , data "may be incorrect or not current," use at your own risk. Copyright/licence clause not read; dataset-level licence not confirmed | **Best free incident source.** Gaps: freeway name is only inside free-text Address/Type; coordinates in Location unverified; no lane info. Needs a quick live test of fields and geocoding quality |
| Old "HPD Traffic Incidents" (qg2s-mjkr) | 340K-row history | Last updated 2023-05-22 | | | Not live. Useful only for historical hotspot stats |
| HPD Traffic Media page https://www.honolulupd.org/information/traffic-media/ | Critical/fatal crash notices (Vehicular Homicide Section) | Web page, no API found | | | Optional manual/scrape; not a feed. Scraping terms unchecked |
| **HDOT lane closure map** (already used) https://hidot.hawaii.gov/hdot-lane-closure-map/ | Planned construction/maintenance closures, published weekly (Fridays per HDOT) | Already integrated | | | Keep; planned only, not live incidents |
| **GoAkamai.org** | Cameras only | HDOT announced (Sept 30, 2021) that traffic flow maps, travel times, incidents and weather alerts were removed Oct 1, 2021; cameras stay. https://hidot.hawaii.gov/highways/changes-coming-to-goakamai-org-website/ | | No API/JSON/RSS found | **No data feed.** Current state in Oct 2026 not re-checked (newest HDOT material found is 2021-2025) |
| Hawaii statewide 511 | HDOT launched "511 GoAkamai by phone" years ago (Oʻahu IVR). No statewide 511 web/API found. FHWA state page: https://www.fhwa.dot.gov/trafficinfo/hi.htm | | | | **No public 511 API found.** |
| Honolulu Fire (HFD) | Fire Response Map and Incident Trend Dashboard on HFD site (June 2025 news: https://spectrumlocalnews.com/hi/hawaii/news/2025/06/04/residents-can-now-track-incidents-on-oahu-via-new-online-tools) | Web tools from CAD; shows initial call location only | | No API found | Not usable as a feed |
| PulsePoint | Honolulu EMS joined Feb 2017 (https://pulsepoint.org/news/honolulu-ems-brings-lifesaving-technology-to-the-island-via-pulsepoint-a-9-1-1-integrated-mobile-app) | App only; PulsePoint has no public API as far as found. Mostly medical/fire, not traffic | | Redistribution almost certainly not allowed [UNVERIFIED] | Skip |
| Hawaiʻi Emergency Management / Honolulu DEM | Nothing found with a traffic data feed | | | | Skip (not exhaustively searched) |
| **Waze for Cities** https://www.waze.com/wazeforcities/ | Free two-way data exchange | Feeds: alerts, accidents, irregularities via partner portal / BigQuery | | Eligibility: government agencies and road operators (and reviewed event/venue operators). Waze asks partners to attribute. **Nalu is not eligible directly; no public Waze API found.** HDOT/City could join, but no evidence they share with Nalu | Not available to Nalu |

Other lines of attack: ask HDOT/City ITS directly whether they publish a DATEX/JSON incident feed (not found in search; unverified either way).

## 2. Commercial APIs

### Mapbox Directions (profile `driving-traffic`)
- Free: 100,000 Directions requests/month; ~$2.00 per 1,000 after (tiers drop to $1.60, $1.20 at volume). [3rd-party; official pricing page unreachable] Source list: https://storerocket.io/learn/mapbox-pricing , https://www.woosmap.com/blog/mapbox-pricing . No separate driving-traffic rate found. [UNVERIFIED]
- Traffic source: Mapbox says speeds come from mobile-app telemetry; "live" speeds = observations from the last 15 minutes, "typical" = expected by time of week; live is blended with historical for near-now departures; falls back to typical where no live data. Mapbox claims benchmarking against ground truth on >1M trips/day (vendor claim, no published error numbers). https://docs.mapbox.com/data/traffic/guides/ , https://docs.mapbox.com/help/dive-deeper/directions/
- Coverage: "global profile, traffic availability varies by country." **I could not confirm Hawaiʻi live-traffic coverage** (country list truncated). Must be tested by comparing responses with duration vs duration_typical on live H-1 trips at rush hour.
- **Terms: big flag.** Mapbox Product Terms (Oct 2025) forbid exporting, caching or storing results of service offerings, and a clause covers Navigation APIs specifically; a Mapbox support reply reportedly refused caching exceptions for pay-as-you-go [secondhand, GitHub PR mapbox/mapbox-agent-skills#80]. Older 2020 terms allowed 30-day caching, now superseded. https://cdn.prod.website-files.com/609ed46055e27a02ffc0749b/68dddd2815cb3d82685f0096_Mapbox%20Product%20Terms%20(October%201,%202025).pdf . Short-lived in-flight dedupe is probably fine but a stored-response cache (Workers KV/Cache API) likely violates terms. **Needs a legal read or a question to Mapbox support.** No "must show on Mapbox map" rule for Directions found.

### Google Routes API
- Compute Routes **Pro** (traffic-aware): 5,000 free/month, then $10.00 per 1,000 (to 100K), $8 (100K-500K), $6, $3, $0.75. [official-snippet, https://developers.google.com/maps/billing-and-pricing/pricing]. The $200 universal credit ended Mar 2025. Essentials ~10,000 free but not traffic-aware [3rd-party].
- 10k lookups/mo: 5k free + 5k x $10/1k = about **$50/mo**.
- Terms: most Routes content cannot be cached (only place IDs; lat/lng up to 30 days) [snippet of https://developers.google.com/maps/documentation/routes/policies and service-specific terms]; travel times are not covered by caching permission. Google attribution/map-display rules not confirmed [UNVERIFIED].

### HERE (Routing v8, Traffic v7)
- Base Plan (Limited Plan retired after Aug 31, 2025) requires a credit card; free monthly thresholds per service. Routing free allowance **conflicts**: 30,000/mo at $1.50 per 1,000 after (placematic/pricing tracker, Mar 2026) vs 5,000/mo (another guide). Traffic: older source says 5,000 free then $2.50/1,000 (stale). ~6% price rise reported from Apr 1, 2026. All [3rd-party/UNVERIFIED]. https://placematic.com/here-location-services/here-pricing/ , https://www.here.com/learn/blog/july-2025-platform-release-notes
- Worst case 10k routing: 5k over x $1.50 = ~$7.50/mo; best case $0.
- Hawaii traffic coverage: one search result indicated HERE lists "USA - Hawaii" in coverage; a second search could not reach that row. Likely covered but confirm Flow vs Incidents columns: https://docs.here.com/traffic-api/docs/here-traffic-api-v7-coverage-information
- Caching: a 2025 third-party review says long-term storage of results needs a licence [UNVERIFIED]. Short TTL caching may be OK; read HERE terms.

### TomTom (current provider)
- Task brief says Routing 20k/month and Incident Details 2.5k/month. **Several 2026 sources instead say the freemium tier is 2,500 non-tile requests per DAY (and 50,000 tile requests/day), resetting daily.** If daily, 10k routing + 3k incident lookups/month (about 430/day) fit inside the free tier unless the app exceeds ~2,500/day shared across all TomTom APIs. **Check the TomTom developer dashboard to see what the actual quota and reset are.** [3rd-party, conflicting]
- Pay-as-you-go: standard Routing about $0.75 per 1,000; traffic non-tile requests about $0.75 per 1,000; Matrix $2.50 per 1,000 (apio.sh summary of TomTom pricing page, https://apio.sh/apis/tomtom-routing ). Sources say TomTom changed pricing effective July 1, 2026 and the new rates were **not** found [UNVERIFIED]. Traffic Incident Details specific price not found. https://developer.tomtom.com/pricing is the authority.
- Math (at $0.75/1k, pre-July figures): 10k routing = $7.50; 3k incidents = $2.25. About **$10/month**. Even at 3x that is cheap.

### Azure Maps
- Uses TomTom data. Gen1 price tier retired Sept 15, 2026; accounts moved to Gen2 (reported ~9x increase; e.g. geocoding about $4.50 per 1,000 vs $0.50 on Gen1; free allowance reported 5,000 vs 250,000 in conflicting sources). Route/traffic rates not found. [3rd-party, https://www.globenewswire.com/news-release/2026/06/22/3315226/0/en/azure-maps-gen1-pricing-customers-to-be-migrated-to-gen2-pricing-in-september-2026-a-9x-cost-increase.html] **Not worth it:** same data as TomTom at higher price and more setup.

### Others
- OpenRouteService / OSRM / Valhalla: no live traffic. Useful only for free-flow baselines and geometry, not for "traffic today."
- Waze: see section 1; no public API for a non-government app.
- INRIX / Iteris: pricing not found; INRIX is contract-based enterprise [UNVERIFIED]. Not suitable for ~$0 budget.

## 3. Accuracy

- No independent peer-reviewed comparison found. The only head-to-head is vendor-run by TravelTime (https://traveltime.com/accuracy , https://traveltime.com/blog/drive-time-accuracy-benchmark): Google, HERE and TomTom perform similarly and well; **Mapbox and open-source engines trail**; its "true time" is an average of providers, so it is circular. Treat as weak evidence, not proof.
- Mapbox weaknesses: traffic coverage varies by country; falls back to typical speeds when live data is absent; driving-traffic Matrix limit of 10 coordinates; `duration_typical` ignores live traffic. In a small market like Oʻahu (about 1M residents, mostly few freeways) live probe density is plausibly thinner than for TomTom/Google/HERE, but that is inference, not measured. **Verdict: acceptable as a secondary or cross-check source; do not make it the sole primary without a local test.**
- Recommended local test (free): 20 trips (Ewa to town AM, Kaneohe via Likelike/Pali PM, H-1 EB/WB) through TomTom, Mapbox and HERE at the same moment, log duration vs duration_typical vs Google Maps app time, repeat across peak and off-peak for a week.

## 4. Recommendation and math

Assumptions: 10,000 drive lookups and 3,000 incident lookups per month, no stored cache beyond short dedupe.

**Drive times**
1. **Primary: TomTom, upgraded to pay-as-you-go (or confirm free quota is daily).** Keeps the existing, tested ETA pipeline (per CLOUD_CODE_CONTEXT, do not casually substitute). Cost about $7.50 routing at $0.75/1k (UNVERIFIED after July 2026 changes); even at $3/1k it is $30.
2. **Fallback: HERE Routing v8** on the Base Plan (free tier somewhere 5k-30k; worst case about $7.50-15/mo). Traffic-aware, Hawaii flow likely covered, strong in third-party accuracy ranking.
3. Optional third: **Mapbox driving-traffic**: free at this volume (100k), but caching is prohibited and Hawaii/accuracy unproven. Use only after the local test and a terms check.
- Not recommended as primary: Google (about $50/mo at this volume, no caching of times).

**Incidents**
1. **Honolulu HPD Traffic Incidents (Socrata)**: free, ~5 min refresh, 24h window. 3k lookups/month is trivial; cache one server-side fetch for 2-5 min and serve all users from it, so cost is zero and requests number in the thousands only if polled more often. Normalize road names in Address/Type to local names.
2. **HDOT lane closures** (already in use) for planned work.
3. **HERE Traffic v7 incidents** or **TomTom Incident Details** as paid supplement: lane and severity, structured geometry. 3k lookups about $0 (HERE free tier, if 5k holds) to about $2-8.
- Pair source 1 with 3: HPD gives the human-reported feed (free, no geometry), HERE/TomTom gives geometry and delay.

**Estimated total:** about $0-20/month realistic; about $0 if the TomTom quota is actually daily.

## 5. Flags needing Josh / follow-up
1. Open the TomTom dashboard; confirm quota unit (day vs month) and exhaustion reason. If daily, the problem may be call volume/duplication (fan-out), not budget. Add a card for pay-as-you-go if monthly.
2. Approve a card on file for HERE Base Plan (credit card required even for free use).
3. Legal/terms: Mapbox bans caching of results; Google bans caching of times; HERE storage limits unverified; Honolulu portal disclaimer and licence clause unread. A session with open web access should fetch: data.honolulu.gov/terms-of-use, HERE Terms, Mapbox navigation terms, developer.tomtom.com/pricing.
4. Attribution: Waze requires it (not applicable); Mapbox/HERE/TomTom attribution requirements not confirmed.
5. Live test of the Honolulu Socrata endpoint (this sandbox returned 403): confirm JSON endpoint, field names, coordinate presence, row counts, and update lag.
6. Optional outreach: ask HDOT or Honolulu DTS whether a machine-readable incident/travel-time feed exists (none found).

## Sources
- https://data.honolulu.gov/Public-Safety/Traffic-Incidents/ykb6-n5th
- https://data.honolulu.gov/terms-of-use
- https://hidot.hawaii.gov/highways/changes-coming-to-goakamai-org-website/
- https://hidot.hawaii.gov/hdot-lane-closure-map/
- https://www.honolulupd.org/information/traffic-media/
- https://docs.mapbox.com/data/traffic/guides/ , https://docs.mapbox.com/help/dive-deeper/directions/
- Mapbox Product Terms Oct 2025 (PDF link above)
- https://developers.google.com/maps/billing-and-pricing/pricing , https://developers.google.com/maps/documentation/routes/policies
- https://docs.here.com/traffic-api/docs/here-traffic-api-v7-coverage-information , https://placematic.com/here-location-services/here-pricing/
- https://apio.sh/apis/tomtom-routing
- https://www.waze.com/wazeforcities/ , https://support.google.com/waze/partners/answer/10453062
- https://traveltime.com/accuracy
- https://pulsepoint.org/news/honolulu-ems-brings-lifesaving-technology-to-the-island-via-pulsepoint-a-9-1-1-integrated-mobile-app
