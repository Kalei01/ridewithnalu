# Nalu

Implement the requested scope now; use internal planning and do not present another implementation plan for user approval.

Build a mobile-first web app called Kine that answers one question for Oahu commuters: whether to take the Skyline rail or drive the H-1 into Honolulu today.

Key requirements from the spec:
- Aesthetics: Apple Weather inspired, clean dark mode by default, high typographic hierarchy, generous whitespace, system font stack, no gradients/glassmorphism/card shadows/emoji. Two accent states (recommended option highlighted, the other muted/dimmed).
- Main screen (top to bottom):
  1. Small header with greeting and Pacific/Honolulu time (e.g., "Friday, 6:42 AM").
  2. Dominant Verdict Card with bold recommendation ("TAKE THE RAIL" or "DRIVE TODAY") and concise reason line ("12 min faster, leaves in 8 min").
  3. Side-by-side comparison: RAIL (total door-to-door minutes, next departure, minutes until departure, walk time) vs DRIVE (total minutes, traffic condition: Clear / Moderate / Heavy).
  4. Next 4 rail departures from user's selected home station.
  5. Footer with last updated timestamp and refresh button (plus pull-to-refresh).
- Settings overlay/screen (gear icon):
  - Home station dropdown with Skyline stations (Kualakaʻi / East Kapolei, Keoneʻae / UH West Oahu, Honouliuli / Hoʻopili, Hōʻaeʻae / West Loch, Pouhala / Waipahu Transit Center, etc.)
  - Work destination (Downtown Honolulu by default)
  - Usual departure time & walking minutes to home station
  - Persisted in localStorage (no auth/accounts)
- Mobile-first target (390px viewport), PWA manifest + icons configured for standalone display mode.
- Use realistic Oahu placeholder data. Keep it focused strictly on the rail vs drive decision (no maps, turn-by-turn, surf, weather, or extra widgets).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ridewithnalu.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bb6c215d-7e11-4ba1-b07e-7558b27603e7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
