# Passdown — Daily Watchman + Triage (weekdays 6:13 AM HST)
Last updated: 2026-10-14 (Skyline cap fix build session).

## Watching
- **Skyline "No Skyline trip" on the first rush-hour try, Kapolei → downtown** (OPEN since Oct 7; alerts.md). Phase 2 went live Oct 13 ~2:30 PM (trip search now one server request). Keep running the SILENT FAILURES check and the 60 s retry; log "seen again" lines, don't re-investigate.
- Health planner time ~5.8–6.2 s (flag line 6000 ms). Slowness is known (planner speed parked).

## Next run
- OPEN alert Oct 21: TomTom drive lookup failing (alerts.md). Re-check health "drive times (TomTom)" first; when it is ok again, confirm Drive row + ʻEwa Skyline on a trip run and close the alert.
- Skyline alert is CLOSED (Oct 14). Keep the SILENT FAILURES check + 60 s retry; if "No Skyline trip" returns, reopen in alerts.md and escalate to MAIN (inbox.md). Planner health 5.4–6.4 s: only flag if >6000 AND new info; known issue.

## Recent runs (newest first: R+ found/fixed, R0 nothing, S skipped)
- R+ (Wed Oct 21: Drive "Can't check traffic" on all trips; TomTom health checks fail "no route returned"; escalated, alerts.md + inbox)
- S (Tue Oct 20: trips skipped — no code change since Oct 19, no open alert, planner 1627 ms, 5 R0 in a row; health + 19/19 pages OK)
- R0 (Mon Oct 19: all clear, trips yes; planner 5028 ms; Skyline first try on all trips)
- R0 (Fri Oct 16: all clear, trips yes; planner 5503 ms; Airport Skyline normal, no repeat of Oct 15 note)
- R0 (Thu Oct 15: all clear, trips yes; planner 1638 ms; one Airport first-try Skyline "no trip" next to a 41-min bus, retry normal — see Watching)
- R0 (Wed Oct 14: Skyline first-try OK on default + phone path → alert closed; only health planner 6403 ms, known)
- R0 (Tue Oct 13: all clear, trips yes; Skyline OK first try, 2nd morning in a row)
- R0 (Mon Oct 12: all clear, trips yes; first Skyline-OK first try since Oct 6)

## Last run
- Wed Oct 21, 6:15 AM HST (trips: yes — code changes since last run): planner 5275 ms, 19/19 pages OK, http→https 301. FAILED: TomTom drive + turn-by-turn health checks ("no route returned"); Drive "Can't check traffic right now" on Kapolei/ʻEwa/Airport; ʻEwa Skyline "Can't check Skyline right now". Escalated (🔴), Josh notified.
