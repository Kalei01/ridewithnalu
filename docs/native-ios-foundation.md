# Nalu iOS Native Foundation

This branch is the native iOS workstream for Nalu. The production web app remains on `main`.

## Architecture

- `main`: production/Lovable source of truth
- `capacitor-ios`: iOS native shell and native integrations
- The existing React/TanStack app remains the UI and business-logic layer.
- Live routing, traffic, roadwork, transit, weather, and Supabase-backed services remain server/web integrations unless a native bridge is specifically needed.

## Local setup

Capacitor 8 currently requires Node.js 22+ for development. iOS builds require macOS and Xcode.

After cloning this branch:

```bash
bun install
bunx cap add ios
bunx cap sync ios
bunx cap open ios
```

If using npm instead:

```bash
npm install
npx cap add ios
npx cap sync ios
npx cap open ios
```

Do not commit secrets or copy the web `.env` into the native project.

## First native test

1. Build the web app with `bun run build`.
2. Sync Capacitor.
3. Open the generated iOS project in Xcode.
4. Set the Apple Developer Team/signing identity in Xcode.
5. Run in an iPhone Simulator.
6. Run on the user's physical iPhone.
7. Regression-test Browse, saved places, Arrive By/Leave Now, Drive Details, live traffic, roadwork, transit, weather, maps, active trip, and parked-car state.

## Native work planned

- Native location permission bridge where it improves reliability.
- Push notification foundation.
- Secure native storage only where a native capability requires it.
- Apple Maps handoff/deep links.
- iOS-specific lifecycle/background behavior, subject to Apple's rules.
- Later: Siri/Shortcuts and Live Activities if the product requirements justify them.

## Security gate before TestFlight

The existing web routing path contains a hardcoded fallback TomTom credential. That credential must not be bundled into the iOS client. Keep routing credentials server-side and rotate/remove the fallback before production distribution.

## App identity

The current provisional bundle identifier is `com.nalu.honolulu`. Confirm the final Bundle ID in Apple Developer/App Store Connect before signing the production app.
