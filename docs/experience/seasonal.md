# Seasonal touches

Owner's request (Josh, Oct 7 2026): the design agents should notice the time of year and "redecorate" Nalu for holidays and local seasons — colors, small motifs and wording — while keeping the original design, running autonomously. Read with `.claude/agents/nalu-premium-experience.md` → "Seasonal touches".

## Principles

- **The original design stays.** A season is a thin, dated layer on top; when no season is active, Nalu looks exactly as it does today. Every season switches itself on and off by date (Hawaiʻi time), so nothing depends on an agent remembering to undo it.
- **The answer stays first.** Seasonal touches never appear in or above the verdict, never change the colors that carry meaning (Drive / Skyline / Bus rows, Nalu's pick, warnings, freshness/confidence, live/delayed states), and never move or hide commute information.
- **Tasteful, local, light.** Accent color, one small motif, one short greeting line in Nalu's voice — not a costume. Professional, natural local voice; correct ʻokina and kahakō; no tourist Hawaiian, no stereotypes, no brand or commercial tie-ins.
- **Useful beats cute.** The best seasonal line is practical and sourced: holiday bus schedules, event closures, fireworks traffic. Decorative greetings need no source; any fact (dates, closures, schedules) needs an official source in a `// Sources (checked <date>)` comment, or it is left out.
- **Cheap and accessible.** Inline SVG motifs under ~3 KB, no new libraries, no images over the network, no layout shift, AA contrast in light and dark, no animation under `prefers-reduced-motion` (and only subtle, short motion otherwise). Riders can turn it off: Settings → "Seasonal touches" (on by default, remembered on the device).

## Framework (one-time build) — TODO, APPROVED Oct 7 2026 by Josh

Build once, then every season is a data-only change:
- `src/lib/seasons.ts`: a list of seasons `{ id, name, start, end (inclusive HST dates), accent tokens, motif (inline SVG), greetings[], note? (sourced practical line) }` and `activeSeason(now)` using the existing Honolulu date helpers (`src/lib/service-day.ts` / `honoluluDateKey`). Unit tests: boundaries in HST, year rollover (Dec 31 → Jan 1), no overlaps, nothing active outside ranges.
- Apply with a `data-season` attribute and CSS variables for accents only, with a reduced-motion block; one greeting line in an existing low-priority spot (e.g. the Browse header or welcome), never on the trip verdict.
- The Settings switch above.
- Start with the next real season (Halloween, Oct 24–31) so it can be seen working; if the build can't finish safely before then, ship the framework with no active season.
- Too large for one Wednesday run or needs deep changes in `src/routes/index.tsx` → mark NEEDS OPUS SESSION here with the reason.

## Season calendar (verify dates every year from an official source; skip anything unsourced)

| Season | Typical window | Notes |
|---|---|---|
| New Year | Dec 31 – Jan 1 | Hauʻoli Makahiki Hou; fireworks traffic only if sourced |
| Lunar New Year | varies | Chinatown events; closures only if sourced |
| Valentine's Day | Feb 14 | light touch only |
| Prince Kūhiō Day | Mar 26 | respectful, state holiday; TheBus holiday schedule if published |
| Lei Day | May 1 | |
| Memorial Day | last Monday of May | respectful; holiday bus schedule if published |
| Kamehameha Day | Jun 11 | respectful; parade closures if sourced |
| Independence Day | Jul 4 | fireworks traffic if sourced |
| Aloha Festivals | September | dates and closures if sourced |
| Halloween | Oct 24 – 31 | |
| Veterans Day | Nov 11 | respectful; holiday bus schedule if published |
| Thanksgiving | 4th Thursday of Nov | holiday bus schedule if published |
| Honolulu City Lights | December (opening date varies) | Honolulu Hale; closures if sourced |
| Honolulu Marathon | 2nd Sunday of Dec | link `/guides/honolulu-marathon-traffic-2026` (update yearly) |
| Christmas | Dec 18 – 25 | Mele Kalikimaka; holiday bus schedule if published |

Skip: Statehood Day (a contested day for many Native Hawaiians), anything commercial or brand-related, anything we can't do respectfully.

## Season log (newest first)

_None yet._
