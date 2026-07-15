# SHIFT Coaching iOS Roadmap

## Product shape

SHIFT remains one coaching product across web, PWA and iOS. Clients join and pay on the web, then sign into the iOS app with the same account. The iOS app does not sell coaching subscriptions or present a public registration checkout.

The initial native shell uses the existing hosted portal so training, nutrition, messaging, cycle tracking and connected-health work stay in one codebase. This is foundation work, not the submission architecture on its own: App Store review requires the native app to provide meaningful app-specific value beyond presenting the website.

## Delivery order

### 1. Native foundation

- Capacitor 8 iOS project on a clean branch from `origin/main`.
- Provisional bundle identifier `com.gordyelliott.shift` until Apple Developer registration.
- Native splash, offline state, safe-area handling, external-link handling and deep-link listener.
- Simulator build and smoke test with DerivedData stored on the external XCode volume.

### 2. Account and navigation hardening

- Sign-in-only first-run experience for existing SHIFT clients.
- Verify Supabase login, password reset, magic-link callbacks and session persistence inside WKWebView.
- Universal Links for approved production domains.
- Native back/navigation behaviour and external OAuth hand-off.

### 3. Native value and notifications

- APNs push registration and a server-side native-device token store.
- DM, coach nudge, task and training reminders routed to web push or APNs as appropriate.
- App icon, launch assets, permission copy and privacy manifest.
- Haptics and native sharing where they improve established workflows.

### 4. Terra and connected health

- Complete Terra production credentials, webhook validation and provider testing.
- Garmin, Oura and other Terra web-widget connections remain available inside the app through secure browser hand-off.
- Synced summaries remain suggestion-only and never mutate training plans automatically.
- Apple Health is a later native SDK phase and is not required for the first Terra-enabled App Store build.

### 5. Submission readiness

- Confirm the final bundle ID, Apple Developer team, app name and production domain.
- Create the App Store Connect record, privacy answers, age rating and support/privacy URLs.
- Provide a review account with representative client data.
- Test account pause/freeze states, DM, training, nutrition, cycle tracking and Terra fallback behaviour.
- TestFlight internal testing, external beta, accessibility pass, crash review and final submission.

## Release gates

- No public purchase or sign-up flow in the iOS app.
- No Terra mock data or preview labels in production.
- No automatic programme changes based on wearable data.
- No medical diagnosis or treatment language.
- Production authentication callbacks and Universal Links must use Gordy's final domain.
- Native push requires Apple Developer capabilities and backend token routing before it is advertised.
- The remote portal shell must gain enough native value for App Review before submission.

## Inputs still required

- Gordy's Apple Developer organisation/team details.
- Final app name and bundle identifier approval.
- Production domain and privacy/support URLs.
- Terra production credentials and confirmed providers.
- App Store description, screenshots and review contact details.
