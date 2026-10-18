# Passdown — Lead (NALU MAIN): judgment, lessons, how to lead
Last updated: 2026-10-18. Kept by the main session; refreshed in the lead checks (Sun and Wed). ≤ 60 lines.

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

## Succession (when to hand the lead to a fresh Opus session)
Hand over when any holds: this session's context is over ~650k tokens (check get_session → context_usage); it was compacted and lost track of open threads; or a wake costs noticeably more than the work it does. Procedure: (1) update main.md + this file so they are complete; (2) create_session — model claude-opus-5-5, effort medium, title "NALU — MAIN COMMAND (n)", repo Kalei01/ridewithnalu, branch cloudflare — with a brief: "You are NALU MAIN; read CLAUDE.md, docs/passdown/main.md and lead.md first; Josh's rules there"; (3) re-create every routine/reminder bound to this session (list_triggers: the lead checks and any pending send_later) on the new session, then disable the old ones; (4) note the handover in main.md and tell Josh in 2 lines which session to use. Planned: evaluate at Tuesday's Phase 2 wake (context ~480k on Oct 11).

## Lead checks (brief)
**Sunday 11:31 AM HST (after the Weekly Review)** and **Wednesday 1:59 PM HST (after the Premium review)**. Gate: skip if nothing changed since the last check (no new code commits, reports, alerts or finished sessions). Otherwise ≤ 12 tool calls on Sunday, ≤ 8 on Wednesday: read this week's report, every passdown's "Recent runs", alerts; decide: (a) adjust run gates or briefs where data shows waste or misses; (b) add a lesson here when something went wrong or right; (c) queue the next build per the fix plan; (d) tell Josh only §4 items. No builds in this session.

## Lessons log (newest first, keep ≤ 10; older ones fold into the rules above)
- 2026-10-18 · Hold navigation/commute pushes until reviewers clear, even when the stop hook nags: on the Oct 16 nav fixes transit-accuracy caught 2 Highs (dropped ramp direction, opposite-carriageway accidents) and then a regression in the fix itself. Re-review every fix commit on commute logic.
- 2026-10-18 · Anything that writes the rider's setup must never touch saved Home/Work (Browse "Start from here" overwrote Home — caught in review, feature disabled). Brief builders: one-off trip state ≠ saved places.
- 2026-10-18 · Builders must lint/format only the files they edit (one ran prettier over src/components: 37 files). Put it in every brief.
- 2026-10-18 · Batch reviewer findings into one fix brief per phase; preview routes (noindex) let big UI work ship safely in phases.
- 2026-10-14: The commute-page restyle went straight live, and Josh disliked it: full-screen rain, a double top inset, lag, and a missing live traffic bar. For main-screen visual changes, always do a preview link first, then Josh approves, then switch. "Keep every function" must be checked with a before/after diff of what riders see.
- 2026-10-13: When another session fires the inbox routine, it runs in a fresh session with NO repo, even though the routine is bound to this session. Its prompt now clones the repo itself. Reports land in docs/passdown/inbox.md; read it at every wake. Every brief must give the agent everything it needs.
- 2026-10-11: Routine sessions have no send_message (only fire_trigger), so agents report to the lead via the inbox trigger trig_018dVqisHDihRPYq9mBE1qtP. That rule is in CLAUDE.md, added by Josh.
- 2026-10-11: Changing another routine's prompt or another agent's instructions is blocked from this session (cross-session prompt edits and the safety classifier). Josh does it himself in that routine's session, or in the repo. Don't keep retrying it.
- 2026-10-11: The GitHub web agent rewrote unrelated CLAUDE.md lines twice. After any instruction-file change made outside this session, diff it against the parent commit.
- 2026-10-11: Gates + adaptive cadence added; prompts need Josh in each routine session.
