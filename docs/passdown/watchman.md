# Passdown — Daily Watchman + Triage (weekdays 6:13 AM HST)
Last updated: 2026-10-14 (Skyline cap fix build session).

## Watching
- **Skyline "No Skyline trip" on the first rush-hour try, Kapolei → downtown** (OPEN since Oct 7; alerts.md). Phase 2 went live Oct 13 ~2:30 PM (trip search now one server request). Keep running the SILENT FAILURES check and the 60 s retry; log "seen again" lines, don't re-investigate.
- Health planner time ~5.8–6.2 s (flag line 6000 ms). Slowness is known (planner speed parked).

## Next run
- TomTom alert CLOSED Nov 6 ("via TomTom" Nov 4 + Nov 6). If health says "via FALLBACK Mapbox" again, reopen in alerts.md; notify only if a Drive row says "Can't check traffic".
- Skyline alert is CLOSED (Oct 14). Keep the SILENT FAILURES check + 60 s retry; if "No Skyline trip" returns, reopen in alerts.md and escalate to MAIN (inbox.md). Planner health 5.4–6.4 s: only flag if >6000 AND new info; known issue.

## Recent runs (newest first: R+ found/fixed, R0 nothing, S skipped)
- R0 (Fri Nov 6: trips yes; riders OK first try; TomTom ok 2nd run in a row → alert closed; planner 6831 ms known; HPD query timed out once, plain feed ok)
- R0 (Wed Nov 4: trips yes; riders OK first try; TomTom ok "via TomTom" (1st ok run since Oct 28); planner 5588 ms; Mon Nov 2 run was delivered ~2 days late, so none that day)
- R0 (Fri Oct 30: trips yes; riders OK first try; TomTom 403 fallback back on after working Oct 28 → reopened as seen again; planner 5173 ms)
- R0 (Wed Oct 28: trips yes; TomTom back via TomTom → Oct 21 alert closed; riders OK first try; planner 6728 ms known)
- R0 (Mon Oct 26: trips yes; riders OK first try; TomTom 403 fallback still on, seen again; planner 5978 ms)
- R0 (Fri Oct 23: trips yes; riders OK first try; TomTom 403 → Mapbox fallback still on, seen again)
- R0 (Thu Oct 22: trips yes; riders OK first try; only known issue: TomTom 403 → Mapbox fallback, seen again)
- R+ (Wed Oct 21: Drive "Can't check traffic" on all trips; TomTom health checks fail "no route returned"; escalated, alerts.md + inbox)
- S (Tue Oct 20: trips skipped — no code change since Oct 19, no open alert, planner 1627 ms, 5 R0 in a row; health + 19/19 pages OK)
- R0 (Mon Oct 19: all clear, trips yes; planner 5028 ms; Skyline first try on all trips)
- R0 (Fri Oct 16: all clear, trips yes; planner 5503 ms; Airport Skyline normal, no repeat of Oct 15 note)
- R0 (Thu Oct 15: all clear, trips yes; planner 1638 ms; one Airport first-try Skyline "no trip" next to a 41-min bus, retry normal — see Watching)
- R0 (Wed Oct 14: Skyline first-try OK on default + phone path → alert closed; only health planner 6403 ms, known)
- R0 (Tue Oct 13: all clear, trips yes; Skyline OK first try, 2nd morning in a row)
- R0 (Mon Oct 12: all clear, trips yes; first Skyline-OK first try since Oct 6)

## Last run
- Fri Nov 6, 6:14 AM HST (trips: yes — open alert): planner 6831 ms (over 6000, known slowness), 19/19 pages OK, http→https 301, timetable valid until Dec 5 (29 days). Health: drive via TomTom, turn-by-turn from TomTom; HPD police-report query timed out once (plain feed worked, ok). Kapolei, ʻEwa Beach, Airport: Drive + Skyline + Bus first try (3.1–7.6 s); retries fine; no "no Skyline trip". TomTom alert closed.
