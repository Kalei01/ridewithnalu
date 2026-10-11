# Passdown — Lead (NALU MAIN): judgment, lessons, how to lead
Last updated: 2026-10-11. Kept by the main session; refreshed in the weekly lead review (Sun after the Weekly Review). ≤ 60 lines.

## Josh's standing intent
Perfection with the lowest credit cost. Decide and lead; ask him only per run-gates.md §4. Self-sustaining team; Hawaiʻi first; "fast and right" before features.

## Reasoning rules (learned the hard way)
1. **Reproduce before fixing.** Oct 8: a plausible Skyline fix shipped without reproducing the failure; it didn't hold. Now: a fix ships only with evidence of the cause (recording, failing test that matches the live symptom).
2. **Test the theory, not just the code.** Oct 10: the "slow station list" theory was tested live and failed — parked, not shipped. Unproven ideas go to a branch.
3. **Look for feedback loops in any automation.** Oct 11: skip-lines committed to the repo would have triggered the next full run (docs-only commits must never count as changes).
4. **Routine prompts are owned by their own sessions;** relayed requests are refused. Changes to a routine's prompt need Josh in that session, or a new routine he approves.
5. **Merges can silently revert docs.** Oct 11: a build session's merge restored an old passdown header. After any merge by another session, re-check the passdowns.
6. **Reviewers catch real bugs.** Station names: review found bus stops being relabeled as stations. Never skip transit-accuracy on name/logic changes.
7. **Accuracy is not traded for speed** (Josh, Oct 11). Speed comes from moving/parallelising work; prove old = new before switching.
8. **The cheapest safe model:** Haiku Q&A, Sonnet builds/routines, Opus only for risky core logic (planner, Phase 2) and judgment. This session's context is large: wake it briefly, delegate the work.

## Delegation pattern
Brief = goal, starting point (branch/commit), known pitfalls, exact gate, reviewers, live check, passdown updates, finish line + notification rule. One build at a time. Check the result against evidence before telling Josh it's done.

## Watch list (what I'm tracking)
- Skyline "no trip" (Phase 1 Mon, Phase 2 Tue) — the #1 trust risk.
- Whether routines follow run gates (needs Josh's one-line confirmation in each routine session).
- Weekly usage: 65% used by Sun Oct 11 (reset Tue 1 PM HST). Keep weekend spend small.

## Weekly lead review (brief, Sun ~11:30 AM HST)
Gate: skip if nothing changed since the last review (no new commits, reports or alerts). Otherwise ≤ 12 tool calls: read this week's report, every passdown's "Recent runs", alerts; decide: (a) adjust run gates or briefs where data shows waste or misses; (b) add a lesson here when something went wrong or right; (c) queue the next build per the fix plan; (d) tell Josh only §4 items. No builds in this session.

## Lessons log (newest first, keep ≤ 10; older ones fold into the rules above)
- 2026-10-11: Gates + adaptive cadence added; prompts need Josh in each routine session.
