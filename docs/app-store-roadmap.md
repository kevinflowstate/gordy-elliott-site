# AT CAPACITY iOS Roadmap

## Current position - 21 July 2026

- App Store Connect record exists as **SHIFT Coaching by Gordy** (`6792719833`) and must be renamed to **AT CAPACITY by Gordy** before the next submission.
- Registered bundle ID: `com.gordyelliott.shift` on Apple team `H4J3XX8R8M`.
- Build 1 uploaded successfully and available to the `SHIFT Internal` TestFlight group.
- Build 2 is the current hardening candidate. It includes portrait-only iPhone presentation, native navigation haptics, public privacy/support pages, self-service account deletion, hardened Terra contracts, and reviewed APNs registration/delivery groundwork.
- The production database now has a locked-down native device-token store. A live authenticated register/read/remove round trip passes without exposing tokens to browser roles.
- The App Store metadata, privacy answers, age-rating worksheet, review notes and screenshot plan are drafted and machine-checked. They still need to be entered in App Store Connect and confirmed by Gordy.
- The web/PWA remains the source application. The iOS target is an additional signed client, not a replacement repository or separate product database.

## Product shape

AT CAPACITY remains one coaching product across web, PWA and iOS. Clients join and pay on the web, then sign into the iOS app with the same account. The iOS app does not sell coaching subscriptions or present a public registration checkout.

The initial native shell uses the existing hosted portal so training, nutrition, messaging, cycle tracking and connected-health work stay in one codebase. This is foundation work, not the submission architecture on its own: App Store review requires the native app to provide meaningful app-specific value beyond presenting the website.

## Delivery order

### 1. Native foundation

- [x] Capacitor 8 iOS project on a clean branch from `origin/main`.
- [x] Registered bundle identifier and Apple signing team configured.
- [x] Native splash, offline state, safe-area handling, external-link handling and deep-link listener.
- [x] Simulator build and smoke test with DerivedData stored on the external Xcode volume.
- [x] Repeatable release preflight and archive command that stops before upload.

### 2. Account and navigation hardening

- [x] Sign-in-only first-run experience for existing clients.
- [x] Supabase fixture login and session persistence verified in the hosted portal flow.
- [x] Custom-scheme deep-link handling and external browser hand-off.
- [x] In-app permanent account deletion and public privacy/support routes.
- [ ] Verify password reset and magic-link return on physical TestFlight devices.
- [ ] Add Universal Links after Gordy's final production domain is live.

### 3. Native value and notifications

- [x] App icon, launch assets, camera/photo permission copy and dependency privacy manifests.
- [x] Native haptic feedback on primary mobile navigation.
- [x] APNs permission/registration bridge and a server-side native-device token store.
- [x] Existing DM, coach nudge, task and reminder notifications fan out to web push and native APNs.
- [x] Device tokens are removed on sign-out, scoped to the app topic and classified by sandbox/production build.
- [ ] Enable Push Notifications for the production App ID and add APNs key credentials to Vercel.
- [ ] Prove delivery and deep-link opening on a physical TestFlight device.
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
- [x] Draft and validate App Store privacy answers, age rating, description and review notes.
- [x] Provide a dedicated review account with representative, non-personal client data.
- [ ] Enter the approved metadata and privacy answers in App Store Connect.
- [ ] Capture final screenshots from the deployed, approved candidate.
- [ ] Test pause/freeze states, DM, training, nutrition, cycle tracking and Terra fallback on physical devices.
- [ ] Complete internal/external TestFlight, accessibility, crash review and final submission.

## Release gates

- No public purchase or sign-up flow in the iOS app.
- No Terra mock data or preview labels in production.
- No automatic programme changes based on wearable data.
- No medical diagnosis or treatment language.
- Production authentication callbacks and Universal Links must use Gordy's final domain.
- Native push requires the Apple capability, APNs key and a physical-device delivery pass before it is advertised as complete.
- The remote portal shell must gain enough native value for App Review before submission.

## Inputs still required

- Gordy's final production domain. The public Vercel URLs and Kevin's monitored support email are valid launch fallbacks.
- Terra production Dev ID, API key, webhook signing secret and confirmed launch providers.
- Gordy's approval of the drafted listing copy, content-rights answer and fictional review fixture.
- Apple Push Notifications capability plus APNs signing key details.
- Final candidate screenshots and completed physical-device TestFlight evidence.
- Supabase leaked-password protection enabled in the project dashboard.
