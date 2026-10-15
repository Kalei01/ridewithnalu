# Application packets and drafts (NOTHING SENT OR SUBMITTED)

Prepared 2026-10-15. All wording uses only founder-verified facts. Fields marked [JOSH] are for Josh to fill in or confirm.

## Top 3 realistic opportunities
1. Supabase Startup Program (best match for the real need)
2. Cloudflare for Startups (already the host; no migration; needs a card, so it is blocked until Josh decides)
3. Google for Startups Cloud, Start tier (already in progress; modest and usable only on Google Cloud; low value)
Honest note: none is confirmed eligible. The real rank is 1, 2, then 3 only because #3 is already in motion.

## Shared packet text (reuse in forms)
- Description: Nalu is a commute decision tool for Oʻahu. It tells a rider whether to drive or take TheBus or Skyline rail today, and when to leave.
- Problem: Oʻahu commuters have to compare live traffic, bus and rail times, parking, roadwork and weather by hand across several apps.
- Stage and capabilities (live today at https://ridenalu.com, installable web app): drive (live traffic) vs Skyline vs TheBus comparison with a pick; park-and-ride; Arrive-by and Leave-now; HDOT roadwork; weather and air; live bus arrivals; leave-by push alerts; navigation map; public guide pages.
- Founder: Joshua Reverio, solo founder, Oʻahu, Hawaiʻi.
- Funding and incorporation: no outside funding; not incorporated; no prior startup credits [JOSH confirm].
- Traction: none stated. Do not add numbers unless Josh supplies verified ones.
- Infrastructure: Cloudflare Workers (Free), Supabase (Free: Postgres + auth), TomTom, Mapbox, Firebase push, Resend, PostHog/Sentry/GA4, an OpenAI-compatible AI API, Google sign-in.
- Links available: https://ridenalu.com; private GitHub repo (do not link).

## Packet 1: Supabase
Intended use of credits: move the main database from Free (500 MB, shared CPU, no backups) to a paid plan: backups, more RAM/CPU, so trip planning stops being slow at rush hour. Later, larger compute for a planned San Francisco Bay Area expansion (~390 MB of transit data).
Infra needs: Postgres + auth, already on Supabase. No migration.
Questions only Josh can answer: (a) does the form accept an unincorporated solo founder? (b) is a card required to activate the Team plan? (c) what happens when the free period ends, does it auto-bill? (d) what is the company/founding date to put on the form? [JOSH]
Accuracy checklist: no user counts; not incorporated stated plainly; no funding stated; project name/URL correct; no claim of Pro plan usage today.

## Packet 2: Cloudflare for Startups
Intended use: keep Nalu on Cloudflare as it grows past Free limits (Workers requests, possibly storage/KV/D1); no money available to pay for the paid plan today.
Infra needs: Workers + Email Routing already used.
Questions for Josh: (a) is Josh willing to put a card on the Cloudflare account (the program reportedly requires one)? He must decide; nothing will be done without approval. (b) Company name to give (Nalu, sole proprietor)? (c) Founding date? [JOSH]
Accuracy checklist: say Free plan today; no traffic numbers; no claim of an incorporated company.

## Packet 3: Google for Startups Cloud (Start)
Intended use: Google sign-in project is the only Google Cloud usage today; credits would only help if Nalu used Google Cloud (for example Maps/Cloud services). Do not claim a Google Cloud migration.
Questions: waiting on Google's reply about unincorporated eligibility. [JOSH] founding date; any paid Google Workspace on ridenalu.com in last 31 days?

## Draft inquiries (NOT SENT; for Josh to review and send himself)

### A. Supabase (NO DRAFT CREATED: no verified official address)
Run 2: no official startup-program email found (only security@supabase.io, a vulnerability-report address, not for this). Do not guess. Send via web form https://supabase.com/partners (per aggregators; could not open). Use this text in the form's free-text field or in Supabase support after logging in. Add: founding date [JOSH]; ask also about card and benefit; keep to 150 words.
To: (web form only)
Subject: Question: Startup Program eligibility for a solo, unincorporated founder
Body:
Hi, I'm Joshua Reverio, a solo founder in Oʻahu, Hawaiʻi, building Nalu (https://ridenalu.com), a working commute decision app for Oʻahu that compares driving, TheBus and Skyline rail. We run on the Supabase Free plan (Postgres and auth) and trip planning slows at rush hour; the biggest need is backups and more compute. I'm bootstrapped (no outside funding) and not incorporated. Does the Startup Program accept an unincorporated solo founder, and is a payment card required to activate the benefit? Thank you. Joshua Reverio

### B. Cloudflare (GMAIL DRAFT CREATED 2026-10-15, run 2; text below is the older version, the draft is the final one)
To: startups@cloudflare.com (quoted from Cloudflare's own startup page in search results; could not open the page directly)
Draft id: r-5158589797455345184 (message 1a13e4797561bd76)
Subject: Question: Startups program for an unincorporated solo founder
Body:
Hi, I'm Joshua Reverio, a solo founder in Oʻahu, Hawaiʻi. Nalu (https://ridenalu.com) is a live commute-decision web app hosted on Cloudflare Workers (Free plan) with Email Routing. I'm bootstrapped and not incorporated. Can a sole proprietor apply to Cloudflare for Startups, and must a payment method be on file to receive credits? Thank you. Joshua Reverio

### C. Google follow-up (DO NOT DRAFT YET; inquiry sent 2026-10-15 06:17 UTC, auto-ack promised reply in 5 business days; follow-up date 2026-10-22)
To: cloudstartupsupport@google.com
Subject: Follow-up: Start tier eligibility for solo founder (Nalu)
Body:
Hi, following up on my earlier question about whether a solo, unincorporated founder with a working product (https://ridenalu.com) qualifies for the Start tier. Could you confirm eligibility and next steps? Thank you. Joshua Reverio
