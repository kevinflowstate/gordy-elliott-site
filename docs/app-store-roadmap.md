# SHIFT Coaching iOS Roadmap

## Current position - 20 July 2026

- App Store Connect record created as **SHIFT Coaching by Gordy** (`6792719833`).
- Registered bundle ID: `com.gordyelliott.shift` on Apple team `H4J3XX8R8M`.
- Build 1 uploaded successfully and available to the `SHIFT Internal` TestFlight group.
- Build 2 is the current hardening candidate. It includes registered signing metadata, portrait-only iPhone presentation, release preflight/archive tooling, native navigation haptics, public privacy/support pages, self-service account deletion, and hardened Terra webhook contracts.
- The web/PWA remains the source application. The iOS target is an additional signed client, not a replacement repository or separate product database.

## Product shape

SHIFT remains one coaching product across web, PWA and iOS. Clients join and pay on the web, then sign into the iOS app with the same account. The iOS app does not sell coaching subscriptions or present a public registration checkout.

The initial native shell uses the existing hosted portal so training, nutrition, messaging, cycle tracking and connected-health work stay in one codebase. This is foundation work, not the submission architecture on its own: App Store review requires the native app to provide meaningful app-specific value beyond presenting the website.

## Delivery order

### 1. Native foundation

- [x] Capacitor 8 iOS project on a clean branch from `origin/main`.
- [x] Registered bundle identifier and Apple signing team configured.
- [x] Native splash, offline state, safe-area handling, external-link handling and deep-link listener.
- [x] Simulator build and smoke test with DerivedData stored on the external Xcode volume.
- [x] Repeatable release preflight and archive command that stops before upload.

### 2. Account and navigation hardening

- [x] Sign-in-only first-run experience for existing SHIFT clients.
- [x] Supabase fixture login and session persistence verified in the hosted portal flow.
- [x] Custom-scheme deep-link handling and external browser hand-off.
- [x] In-app permanent account deletion and public privacy/support routes.
- [ ] Verify password reset and magic-link return on physical TestFlight devices.
- [ ] Add Universal Links after Gordy's final production domain is live.

### 3. Native value and notifications

- [x] App icon, launch assets, camera/photo permission copy and dependency privacy manifests.
- [x] Native haptic feedback on primary mobile navigation.
- [ ] APNs push registration and a server-side native-device token store.
- [ ] DM, coach nudge, task and training reminders routed to web push or APNs as appropriate.
- [ ] Native sharing where it improves an established client workflow.

### 4. Terra and connected health

- [x] Widget-session, connection, raw-event and normalized daily-summary groundwork.
- [x] Raw-body HMAC webhook verification, idempotency and multi-item payload normalization.
- [x] Production mock-data lockout and suggestion-only coaching safeguards.
- [ ] Add Terra production credentials/signing secret and complete provider sandbox testing.
- Garmin, Oura and other Terra web-widget connections remain available inside the app through secure browser hand-off.
- Synced summaries remain suggestion-only and never mutate training plans automatically.
- Apple Health is a later native SDK phase and is not required for the first Terra-enabled App Store build.

### 5. Submission readiness

- [x] Confirm bundle ID, Apple Developer team and App Store product name.
- [x] Create the App Store Connect record and internal TestFlight group.
- [x] Add deployable privacy/support URLs and an App Privacy data inventory.
- [ ] Complete App Store privacy answers, age rating, description, screenshots and review notes.
- [ ] Provide a dedicated review account with representative, non-personal client data.
- [ ] Test pause/freeze states, DM, training, nutrition, cycle tracking and Terra fallback on physical devices.
- [ ] Complete internal/external TestFlight, accessibility, crash review and final submission.

## Release gates

- No public purchase or sign-up flow in the iOS app.
- No Terra mock data or preview labels in production.
- No automatic programme changes based on wearable data.
- No medical diagnosis or treatment language.
- Production authentication callbacks and Universal Links must use Gordy's final domain.
- Native push requires Apple Developer capabilities and backend token routing before it is advertised.
- The remote portal shell must gain enough native value for App Review before submission.

## Inputs still required

- Gordy's final production domain and a monitored public support email/address.
- Terra production Dev ID, API key, webhook signing secret and confirmed launch providers.
- App Store description, keywords, category, age-rating answers, review contact and final screenshots.
- A dedicated App Review login and explicit confirmation that its sample data may be reviewed by Apple.
- Decision on whether native push is a version 1 submission gate or a post-launch update.
