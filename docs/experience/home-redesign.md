# Home page redesign ("/"), approved by Josh on Oct 13, 2026

Josh's words: the home page is boring, reads like a brochure, carries too much information, and the Oʻahu map "looks like a five-year-old drew it". First impressions are everything, and it must make people want to use Nalu. He wants motion, pizzazz and enticement.

## Build
1. **The app first.** A big "Where to?" box at the top. Under it, one-tap destination chips (Downtown, Airport, Waikīkī, Ala Moana, UH Mānoa). Each chip opens the real planner, pre-filled. This works for tourists as well as commuters; no forced saved commute.
2. **A professional live island.** An accurate Oʻahu built from real coastline data (simplified GeoJSON/TopoJSON baked into a static SVG at build time, or a styled Mapbox static image with SVG overlays). Dark and glowing.
   - The Skyline line and its stations come from the real GTFS shapes and stops. Trains glide along at their scheduled positions, labelled "as scheduled".
   - H-1 is tinted by live traffic from one cached server check (≤ 2 min old, as today). Hide the tint if the check fails; never fake it.
   - Replaces the M2 welcome scene.
3. **"Right now on Oʻahu" strip.** A small live ticker: the H-1 delay vs usual, the next Skyline departure from a major station, and showers near a named area. Real data only, so hide any item without evidence. Refreshes quietly.
4. **The race demo instead of the static example.** Tap "Kapolei → town" (or a chip) and watch car, Skyline and bus markers race along their real routes on the map, finishing at today's real times from one planner call (cached). If live data is unavailable, show the honest last-known example, labelled with its date and time.
5. **About 2 screens long.** "How it works" becomes 3 swipeable cards, each with a tiny animation. Features become short swipeable cards. FAQ and Popular commutes become accordions using `<details>`, so the text stays in the HTML for Google.
6. **A look of its own.** A subtle animated wave motif behind the hero ("nalu" = wave), refined type scale and spacing, consistent icons. A friendly time-of-day line ("Pau hana traffic building on H-1 — Skyline's looking good"), built from real conditions only (nalu-voice vocabulary; never invent).

## Rules
- Build behind a preview: `/?home=new`, or a separate route, first. Josh approves it on his phone BEFORE it replaces "/". After approval, switch "/" over in one commit and keep the old page reachable for one week.
- SEO: keep one h1 with the primary keyword, the title/meta/canonical/JSON-LD, the FAQ text and the internal links to the guides. Content must stay server-rendered.
- Speed: no LCP/CLS regression on mobile. Measure before and after. Lazy-load the map and the race below the hero. Total added JS ≤ 60 KB gzip; no heavy animation libraries.
- prefers-reduced-motion: static map, no race animation (show the final times), no wave motion.
- Real data only (CLOUD_CODE_CONTEXT). Never delay the "Where to?" box. Josh's Oct 14 rules: no walking or parking estimates, no auto-opening a saved commute.
- Reviewers: mobile-design (390×844, light and dark), nalu-performance, transit-accuracy (the race and ticker numbers) and security-keys. Full gate under set -e. Fix forward.
- Record progress in docs/passdown/premium.md ("Home redesign: next step …") so another session can continue.
