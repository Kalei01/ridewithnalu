# Product proposals

Monthly ideas from the Sunday Weekly Review (first Sunday of each month), per "Product opportunities" in `.claude/agents/nalu-lead.md`. Each is a product decision for Josh. Reply in the **NALU — Weekly Review** session with "approve P-<n>" or "decline P-<n> (reason)". Approved items go to the build backlog and are built by the Wednesday premium review (or the search agent); declined ones are never proposed again; unanswered ones expire after 60 days.

Statuses: PROPOSED · APPROVED · DECLINED · EXPIRED · DONE

```
### P-<n> — <short title> (<YYYY-MM-DD>) — PROPOSED
- Rider problem:
- Evidence:
- Proposal (add / improve / remove):
- Riders gain:
- Risk to the commute decision:
- Effort: S / M / L · Builder: premium agent (Sonnet) / needs Opus session
```

---

### P-5 — Weekly business snapshot (2026-10-08) — DONE 2026-10-08 (commit 0308e15 P-4; 3f63d99 P-3, P-5)
- Proposal (add): a "BUSINESS SNAPSHOT" section in the Sunday Weekly Review report and its phone notification headline: weekly users vs last week, where they came from (link tags), the P-1 funnel, costs and usage vs each service's limit (P-3), and what riders said (P-4).
- Effort: S · Builder: Sonnet (playbook + report format only).

### P-4 — In-app feedback (2026-10-08) — DONE 2026-10-08 (commit 0308e15 P-4; 3f63d99 P-3, P-5)
- Proposal (add): a small "Tell Nalu something" option (one text box, optional category: wrong answer / idea / other) reachable from Settings and the trip screen, with the trip context attached only if the rider agrees; no account needed; rate-limited; stored in a new table (standing database authorization: additive, locked down, reviewed). The Sunday review reads new feedback; anything urgent (a wrong answer) goes to the Watchman's triage list.
- Risk: spam/abuse (rate limit, length cap, no links rendered back); privacy wording updated.
- Effort: S–M · Builder: Sonnet.

### P-3 — Cost and limit guard (2026-10-08) — DONE 2026-10-08 (commit 0308e15 P-4; 3f63d99 P-3, P-5)
- Proposal (add): a weekly check of usage against each paid/free limit — TomTom, Supabase (database size, egress, function calls), Cloudflare Workers requests, Mapbox map loads, Resend email, Firebase messaging — with a phone alert at ~70% of any limit or an unusual jump. Use each provider's usage API where reachable with existing credentials; where a provider needs a new read-only token, list exactly which one for Josh to add as an environment secret (never in chat), and fall back to Nalu's own request counts meanwhile.
- Effort: M · Builder: Sonnet; runs inside the Daily Watchman (Mondays) or the Sunday review, no new schedule.

### P-2 — Guide pages with personality and interaction (2026-10-08) — APPROVED 2026-10-08 (all items)
- Rider problem: the SEO guide pages are plain text; nothing invites a visitor to try Nalu or shows what it does (Josh, Oct 8).
- Evidence: owner review; the funnel (P-1) will show how many guide visitors try a trip.
- Proposal (improve, keep the text for search engines and add on top):
  1. "Right now" card on each trip guide: today's live Drive / Skyline / Bus times for that commute, refreshed at most every 10 minutes and cached server-side (no extra load per visitor); the page still renders full text without it.
  2. Mini "Try this trip" panel: Leave now / Arrive by and a time picker that opens the planner pre-filled.
  3. Small map (the existing map component) of the route, stations and park-and-ride lots; tap a station for its parking and trains.
  4. "Nalu's take" box in Nalu's voice (sourced, no invented numbers) and FAQ accordions (also eligible for search FAQ results).
  5. Visual polish: cards instead of long paragraphs, a simple route diagram (H-1 vs rail), icons; seasonal touches apply here too.
  Later, only with data: a time-of-day chart of drive vs Skyline (needs first-party drive-time sampling, still an owner decision).
- Riders gain: see the answer and try Nalu in one tap instead of reading.
- Risk to the commute decision: none to the engine; live cards must say when they were updated and never show a stale time as current.
- Effort: M · Builder: premium agent (Sonnet) for 2, 4, 5; 1 and 3 likely an Opus session (server caching, map on public pages).

### P-1 — Measure the visitor funnel (2026-10-08) — APPROVED 2026-10-08
- Rider problem: we can't see where visitors drop off between arriving and getting value.
- Evidence: today only app opens, trip question answered/skipped, trip started and link source are counted.
- Proposal (add): anonymous step counts, no personal data: landed (intro / guide / shared link) → tried a trip → answer shown (and how long it took) → tapped Open in Maps → came back within 7 days; installs and sign-ups vs visits. The Sunday review reports the weekly funnel.
- Riders gain: indirectly — fixes go where people actually drop off (e.g. slow answers like Oct 7's 14 s).
- Risk to the commute decision: none; privacy policy wording must match what is counted.
- Effort: S–M · Builder: premium agent (Sonnet), with a security-keys review.
