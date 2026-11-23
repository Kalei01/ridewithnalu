# Passdown — SEO Discovery (Mon/Thu 5:58 AM HST)
Last updated: 2026-10-11 (main session, seeded). Keep ≤ 60 lines; see README.md. Gate and cadence: `docs/agents/run-gates.md`.

## Current focus
- Oct 14: strategy written, docs/seo/strategy.md; run order is the RUN ORDER section of backlog.md. Evidence: 374 impressions, 4 clicks, pos 10.3; skyline-park-and-ride is the winner (157 impr, pos 7). Research only, no code changed.
- Backlog: `docs/seo/backlog.md`; log: `docs/seo/search-review-log.md`.
- Evidence so far (Oct 8): 18 impressions, 0 clicks, 18/19 pages indexed (/disclaimer unknown). Too thin to act on.
- Rush-hour section is live on /oahu-commute (Oct 22, TomTom 2025 City view).

## Waiting / follow-ups
- Oct 15 (NALU MAIN): guide redesign FINISHED and live (28ed3f4); guide bodies are editable again. Titles, descriptions, FAQ, JSON-LD and section ids unchanged. Reuse the shared pieces in src/components/guides/GuideBlocks.tsx (StatTiles, OptionCards, GuideMap, GuideDetails, FactList, CompareCards) and GuideLayout's `strip` prop for answer-first work. Nov 11 CTR/position read must factor in the Oct 15 redesign. Answer-first still to do: ʻEwa, Mililani, airport, UH.
- Oct 15 (MAIN): ALL guides + hub redesigned and LIVE (last 28ed3f4); guide bodies open for edits again; reuse GuideBlocks.tsx pieces. Earlier: both Skyline guides redesigned and LIVE (parking 954df78, rail 281036d): map, lot/area cards, What-to-know strip; titles, descriptions, FAQ and section ids unchanged. Note this when reading the Nov 11 CTR/position check.
- Oct 14: titles/snippets and station names shipped for rail, parking, late-night guides. Next: station names on remaining guides; recheck rail table at 390px; compare CTR Nov 11.
- Skyline station names changed in the app (English first, Hawaiian second; table in `docs/product/direction.md`). Update guide pages to match once the app change is live — check main.md.
- Marathon guide (race Dec 13): Nov 23 added the City's permit preview (honolulu.gov/dts/2026-events/, status "submitted", roads close ~2:30 AM, reopen ~4:00 PM). Weekly until the marathon's own 2026 advisory appears: replace the preview with its times and closures, re-read the City entry (status may become approved). honolulumarathon.org is blocked from the cloud environment (403); use web search and the City page.
- After Dec 5: TheBus feed expires; re-check guide facts, LAST_UPDATED and LAST_MODIFIED_ISO (feed refresh is MAIN's: see inbox).
- Trust & authority pages are built by a separate Opus session (Tue Oct 13); don't duplicate.

- App station names live since e3a3638; guides can now be updated (English name first, Hawaiian second; table in docs/product/direction.md).

## Recent runs (newest first: R+ found/fixed, R0 nothing, S skipped)
- R+ (Nov 23)
- R0 (Nov 16)
- S (Nov 2, Nov 9: not run, session idle)
- R0 (Oct 26)
- R+ (Oct 22)
- R+ (Oct 19)
- R+ (Oct 15)
- R0 (Oct 8)

## Last run
- Mon Nov 23: RUN OK. 2,834 impressions, 26 clicks; rail guide position 12.2 to 9.6, 8 clicks. Marathon guide now carries the City's 2026 permit details (submitted, approximate). Next: marathon advisory each Monday until posted; Dec 5 feed re-check; CTR read in December.
