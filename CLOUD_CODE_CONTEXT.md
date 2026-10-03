# Nalu — Cloud Code Context

> This file is developer context, not application logic. Read it before making substantial changes.
> Keep this document concise and update it only when the project's architecture or product intent materially changes.

## What Nalu is

Nalu is an Oʻahu commute decision engine, not a Google/Apple Maps replacement.

The core question is:
**“Should I drive or take transit/rail today, and when should I leave?”**

The product should reduce commute decision-making, not overwhelm the commuter with map-like information. The value is the quality and honesty of the decision.

Long term, the reasoning engine should be portable (“Powered by Nalu”) so presentation, geography, and providers can expand beyond Oʻahu without rebuilding the decision logic.

## Core reasoning model

Preferred flow:

**provider data → normalized evidence → canonical trip/route model → freshness/confidence → central verdict → UI**

Do not create separate competing decision brains for different screens.

The central verdict should be based on real evidence and explicit rules, not guessed travel times or arbitrary heuristics. When evidence is weak or unavailable, communicate uncertainty rather than inventing an answer.

Current Nalu 3.0 direction:
- Intelligence Core
- drive vs transit/rail decisioning
- provider-neutral evidence normalization
- canonical trip/route representation
- trip-estimate adaptation
- freshness and confidence
- central Verdict Engine
- quality workflow: tests → typecheck → build

Arrive By and Leave Now should converge on the same universal decision contract. Specialized flows such as Beat the Rush, rescue/fallback behavior, and navigation controls can remain specialized where their purpose requires it, but they should not silently develop a second decision system.

## Transit reasoning

Transit means more than Skyline alone.

A useful Oʻahu commute may be:
- bus
- rail
- bus + rail
- walking + transit
- drive to a station + rail
- drive-only when transit is not practical

Do not report “no rail/transit trip” merely because a direct rail option is unavailable if a valid bus + rail or other supported combination exists.

Use real GTFS identifiers and explicit direction/context rather than relying on stop-name matching or hardcoded station assumptions.

Walking time, transfers, waiting, departure timing, and weather exposure can materially affect the decision.

Never replace real transit evidence with a fixed “about 10 minutes” style placeholder when live/scheduled data is available.

## Drive / traffic reasoning

TomTom remains an important live routing/traffic provider. Preserve the full ETA pipeline and do not casually substitute another provider.

Important distinctions:
- live traffic travel time is different from planned roadwork
- incidents are different from scheduled closures
- future-departure/Arrive By estimates must be labeled honestly
- freshness matters
- provider failures should degrade gracefully rather than crash the whole UI
- API keys/secrets stay server-side
- deduplicate/cache requests where appropriate

User-facing route language should sound local to Oʻahu:
- “H-1 westbound — Aiea → Pearl City”
- not awkward route-code language such as “HI-764/H1-764”

HDOT roadwork is supplemental context. It should help explain a commute, especially in Drive Details, without duplicating the same traffic information across multiple cards.

## Geographic correctness

Exact saved places are important.

Keep:
- exact Home/Work/custom destination coordinates
- transit-access information separate from the saved place itself
- explicit Home → Work / Work → Home direction
- exact search/map coordinates rather than guessed markers
- safe persistence and migration of saved places

Do not silently replace an exact saved location with a nearby station or approximate location just because it makes a calculation easier.

## UX/product principle

Nalu should feel like a trusted commute assistant, not a dashboard.

The app can contain sophisticated reasoning underneath while presenting a simple answer:
- what to take
- why
- how long
- when to leave
- what important condition could change the decision

Do not remove useful information merely to make the UI shorter. Simplify wording and hierarchy before removing service value.

Avoid duplicate cards that repeat the same fact. Prefer one strong piece of information with supporting detail beneath it.

ETA formatting should be human-readable and consistent (for example, “1 hr 1 min,” not “61 min” when an hour is involved).

Weather, incidents, roadwork, and other context should affect or explain a commute decision when materially relevant—not become unrelated widgets.

## Nalu personality

Nalu has a light local-friend personality, but it remains a professional commute assistant.

Personality should:
- sound natural and locally familiar
- be concise
- add warmth/humor when useful
- never obscure the actual commute answer
- never invent facts
- never make the user decode what Nalu means

Personality is presentation layered on top of the reasoning engine. It must not become another decision engine.

Keep the vocabulary/content organized so it can grow substantially without scattering strings throughout unrelated logic.

## Reliability / engineering rules

Preserve working functionality before refactoring.

For meaningful changes:
1. understand the existing flow
2. make the smallest coherent change
3. test the affected behavior
4. run the project quality gate: tests → typecheck → build
5. inspect failures instead of declaring success
6. verify the user-facing flow when practical

Do not “fix” a failure by weakening/removing tests or hiding errors.

Server-function failures should degrade gracefully where the user can continue safely. A temporary search/API failure should not blank the entire application or trigger an unnecessary full-screen error boundary.

Avoid large speculative cleanups. Nalu has accumulated real product behavior; preserve it unless there is a concrete reason to change it.

## Cloud Code working agreement

Cloud Code should treat this file as project context, not as a prompt to blindly implement every statement.

Before changing a subsystem:
- read this file
- inspect the current implementation
- identify the existing source of truth
- preserve existing contracts unless there is a documented reason to change them

When a newer user instruction conflicts with an older note, the newer explicit instruction wins.

When adding architecture, prefer clear boundaries and portable TypeScript business logic over UI-specific logic.

Do not hardcode product assumptions into providers when they belong in the decision layer.

## Important current areas

Key areas to inspect before changing related behavior:
- `src/routes/index.tsx` — primary commute UI/orchestration; keep presentation separate from reasoning where possible
- `src/lib/*drive*` — drive estimates, traffic interpretation, and formatting
- `src/lib/*bus*` — live bus arrivals and transit matching
- `src/lib/hdot-lane-closures.functions.ts` — supplemental HDOT scheduled roadwork context
- `src/lib/*verdict*` / decision modules — central decision logic; find the current source of truth rather than creating another one
- `src/components/commute/*` — commute presentation components
- tests adjacent to the above modules — behavioral contracts and regression protection

## Do not lose these product constraints

- Nalu is an Oʻahu commute decision product, not a general map replacement.
- Real evidence beats guesses.
- Transit includes bus + rail combinations, not rail-only.
- Drive and transit comparisons must be apples-to-apples where possible.
- Freshness and confidence must be visible in the reasoning, without cluttering the UI.
- Preserve service value while simplifying presentation.
- Local Oʻahu language matters.
- Mobile-first remains important.
- Architecture should remain portable for future “Powered by Nalu” expansion.
- Changes should be compatible with the current TanStack Start/React architecture and should not introduce unnecessary platform-specific assumptions.
