# AT CAPACITY iOS Roadmap

## Current position - 6 August 2026

- App Store Connect record `6792719833` is named **AT CAPACITY by Gordy**.
- Registered bundle ID: `com.gordyelliott.shift` on Apple team `H4J3XX8R8M`. Bundle IDs cannot be changed after registration; the `shift` segment is a permanent historical artefact and does not appear to clients.
- Build 1 uploaded successfully and available to the `SHIFT Internal` TestFlight group (historical group name; rename alongside the record if desired).
- Build 2 was the hardening candidate for the 21 July audit. Validated production-signed Build 4 is attached to version 1.0 in App Store Connect. Build 5 is the frozen pre-submission validation candidate recorded in `config/app-identity.json` and the Xcode project; it has not been submitted for review.
- Build 5 archived successfully on 6 August, passed the local signature, entitlement, privacy-manifest and embedded-shell checks, passed Organizer validation and completed Apple processing. It is available to the `SHIFT Internal` TestFlight group as Ready to Submit.
- The production database now has a locked-down native device-token store. A live authenticated register/read/remove round trip passes without exposing tokens to browser roles.
- The App Store metadata, privacy answers, 16+ age override, review notes, current screenshots and Build 4 were reconciled against the live App Store Connect draft on 6 August. The version remains in Prepare for Submission and has not been added for review.
- Google OAuth verification for the optional Founder Google Calendar connection remains under review. Apple preparation continues independently; Google approval is a final calendar smoke-test gate, not the start of App Store preparation.
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
- [ ] Add Universal Links for `app.onlinegordy.com`.

### 3. Native value and notifications

- [x] App icon, launch assets, camera/photo permission copy and dependency privacy manifests.
- [x] Native haptic feedback on primary mobile navigation.
- [x] APNs permission/registration bridge and a server-side native-device token store.
- [x] Existing DM, coach nudge, task and reminder notifications fan out to web push and native APNs.
- [x] Device tokens are removed on sign-out, scoped to the app topic and classified by sandbox/production build.
- [x] Enable Push Notifications for the production App ID, regenerate the App Store profile and add APNs credentials to Vercel.
- [ ] Prove delivery and deep-link opening on a physical TestFlight device.
- [ ] Native sharing where it improves an established client workflow.

### 4. Terra and connected health

- [x] Widget-session, connection, raw-event and normalized daily-summary groundwork.
- [x] Raw-body HMAC webhook verification, idempotency and multi-item payload normalization.
- [x] Production mock-data lockout and suggestion-only coaching safeguards.
- [x] Add Terra production credentials/signing secret and activate the production connection flow.
- [x] Prove Oura connection, native return and recovery/readiness ingestion with a real TestFlight account.
- [ ] Retest MyFitnessPal after Terra's observed upstream login timeout and record a successful nutrition sync.
- Garmin, Oura and other Terra web-widget connections remain available inside the app through secure browser hand-off.
- Synced summaries remain suggestion-only and never mutate training plans automatically.
- Apple Health is a later native SDK phase and is not required for the first Terra-enabled App Store build.

### 5. Submission readiness

- [x] Confirm bundle ID, Apple Developer team and App Store product name.
- [x] Create the App Store Connect record and internal TestFlight group.
- [x] Add deployable privacy/support URLs and an App Privacy data inventory.
- [x] Draft and validate App Store privacy answers, age rating, description and review notes.
- [x] Provide a dedicated review account with representative, non-personal client data.
- [x] Reconcile the approved metadata, privacy answers and review notes against the live App Store Connect record.
- [x] Replace the 21 July screenshot set with captures from the deployed Health & Capacity and workout candidate.
- [x] Enable Supabase leaked-password protection and clear the live security-advisor warning.
- [x] Prepare the App Accessibility evidence matrix and reviewer/Guideline 4.2 walkthrough.
- [ ] Restore the fictional Demo Client review credential and prove a clean production sign-in.
- [x] Validate, upload and process Build 5 in TestFlight without adding version 1.0 for review.
- [ ] Test pause/freeze states, DM, training, nutrition, cycle tracking and Terra fallback on physical devices.
- [ ] Complete internal/external TestFlight, accessibility, crash review and final submission.

## Release gates

- No public purchase or sign-up flow in the iOS app.
- No Terra mock data or preview labels in production.
- No automatic programme changes based on wearable data.
- No medical diagnosis or treatment language.
- Production authentication callbacks and Universal Links must use `app.onlinegordy.com`.
- Native push requires the Apple capability, APNs key and a physical-device delivery pass before it is advertised as complete.
- The remote portal shell must gain enough native value for App Review before submission.

## Inputs still required

- Universal Links and authentication callback validation on the live `app.onlinegordy.com` domain.
- A successful MyFitnessPal provider retest and the final list of connected-health providers advertised at launch.
- Gordy's approval of the drafted listing copy, content-rights answer and fictional review fixture.
- A verified Demo Client password held only in App Store Connect.
- The account owner's Digital Services Act trader/non-trader decision and any legally required contact details.
- Completed physical-device TestFlight, APNs, accessibility and crash evidence for Build 5.
