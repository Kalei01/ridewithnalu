# Split map: `src/routes/index.tsx` (Phase 3 of `fix-plan.md`)

Goal: get `src/routes/index.tsx` (5,987 lines at start, Oct 14 2026) under ~1,000 lines with **no behaviour change**: same rendering, text, logic and decisions. One area per commit, pure moves only (cut/paste plus imports and props).

## Shape of the file (at the start)
Everything lives in one component, `Index()` (line 391 to the end):
- lines 1–300: imports, lazy maps, head/meta in `Route`
- 391–3780: state, effects, queries and derived values (hooks, trip orchestration, verdict inputs) ≈ 3,400 lines
- 3780–4180: handlers and `setupDialog` (a JSX value used by every screen)
- 4181–4842: **Browse screen** (early `return` when `browseActive`)
- 4845–4872: trip-access question screen (tiny; leave in place)
- 4874–5987: **Commute screen** JSX (~1,100 lines)

## Method (so a follow-up session can continue)
`scripts/diag/split-extract.mjs` does each move mechanically with the TypeScript compiler:
- `statements` kind: whole statements inside an `if (...) { }` block become the body of a new component; the block becomes `return <Comp ... />`.
- `jsx` kind: sibling JSX children become `<Comp ... />`.
- Every variable the moved lines read from `Index()` becomes a prop **of the same name**, typed by the compiler. Imports used are copied; unused imports in `index.tsx` are removed afterwards.
- Run `node scripts/diag/split-extract.mjs <kind> <start> <end> <Name> <file> --dry` first: it lists props, imports and any module-level name that must be moved by hand.
- Per commit gate (under `set -e`): `bun run typecheck && bun run test && bun run build`, eslint on touched files, then reviewers (mobile-design for UI areas, transit-accuracy where commute wording/logic is touched, security-keys before push), live Kapolei check at 390×844.

Targets live in `src/components/commute/` (screens and sections). Hook areas (later) go to `src/features/commute/` as `use-*.ts`.

## Order (lowest risk first) and status
| # | Area | Lines (start) | Target file | Status |
|---|---|---|---|---|
| 1 | Browse screen | | `components/commute/BrowseScreen.tsx` | DONE (pushed) |
| 2 | Commute: Arrive By block | 4946–5136 | `components/commute/sections/…` | DONE |
| 3 | Commute: verdict block | 5151–5311 | same folder | DONE |
| 4 | Commute: trip commitment actions | 5396–5530 | same folder | DONE |
| 5 | Commute: map block | 5561–5733 | same folder | DONE |
| 6 | Commute: mode details section | 5736–5956 | same folder | DONE |
| 7 | Commute header/direction/offline strip and footer (small; still inline) | ~4180–4245, end of file | same folder | planned |
| 8 | `setupDialog` + handlers (3780–4180) | | `features/commute/` | planned |
| 9+ | Hook areas (rider GPS/live nav, live drive + reroute, weather, choices/verdict inputs, saved-places sync). Needs the tool's `hook` kind (returns the names used outside); decide per area. | 391–3780 | `features/commute/use-*.ts` | not started |

## Bugs / oddities spotted (not fixed, by rule)
- `Point` type in `lib/trip-direction.ts` is not exported, so `MapSection` spells it out inline (`{ lat: number | null; lon: number | null }`). Harmless; export it later.
- Section components take 20–40 props with long `import("…")` types (generated). Tidy by importing the real types when convenient.

## Progress log
- Oct 14: baseline clean on `origin/cloudflare` 12fd552 (typecheck, test, build). Map written.
- Oct 14: areas 1–6 moved (plus the verdict follow-up block, `VerdictFollowUpSection`, and `VerdictSection`): `index.tsx` 5,987 → ~4,490 lines. Each move verified identical to the original (whitespace-insensitive) by `scripts/diag/split-run.sh`; gate run per commit by `scripts/diag/split-commit.sh`. Reviewers (security-keys, transit-accuracy, mobile-design) clean.
- **Next session:** the ~3,400 lines of state/effects/derivations (lines ~391–3780) are the bulk. Add a `hook` kind to `split-extract.mjs` (range of declarations → `use-*.ts` returning the names used outside the range), then move rider GPS/live nav, live drive + reroute, weather, choices/verdict inputs, saved-places sync, one per commit. Then `setupDialog` and the handlers.
