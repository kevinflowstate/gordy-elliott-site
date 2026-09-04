# App Review Walkthrough and Guideline 4.2 Evidence

This is the exact reviewer simulation for the final TestFlight candidate. It contains no credentials. Store the verified fictional Demo Client credential only in App Store Connect.

## Preflight

- Install AT CAPACITY 1.0 (10) from TestFlight, not a local or development build.
- Start from a terminated app with network access.
- Confirm the fictional Demo Client signs in and contains only representative non-personal data.
- Confirm the version remains **Prepare for Submission** while this walkthrough is executed.

## 10–15 minute reviewer journey

1. **Launch and sign in**
   - Confirm the AT CAPACITY splash fits the device and no browser chrome appears.
   - Sign in with the App Store Connect review account.
   - Confirm notification permission is not requested until the reviewer chooses Enable.

2. **Dashboard and coaching context**
   - Review current tasks, the coaching dashboard and today's coaching priority.
   - Confirm capacity language is suggestive and does not diagnose or automatically alter a programme.

3. **Training**
   - Open Training and choose the next assigned session.
   - Start the native session, open **Session overview**, inspect what is coming next and jump to another exercise.
   - Log set values, use **Apply set 1 to all**, move between exercises and finish the session.
   - Reopen the completed session and confirm the saved values can be reviewed/edited.

4. **Daily coaching workflows**
   - Save a Daily Tracker entry and reopen it.
   - Open Nutrition and inspect the assigned plan.
   - Open DM and review the fictional two-way coach conversation.
   - Open Progress/Strength Progress and inspect the configured main-lift history.

5. **Health & Capacity**
   - Open Health & Capacity and confirm the data-consent explanation appears only until accepted.
   - Inspect the provider-specific cards and confirm the review account contains no stuck pending or error connection.
   - Oura data may show readiness, activity, sleep or HRV independently; nutrition must not appear missing merely because Oura does not provide food tracking.
   - Do not promise MyFitnessPal availability until the outstanding provider retest passes.

6. **Settings and privacy**
   - Open Settings, privacy and support.
   - Confirm Delete account is available after sign-in and requires explicit confirmation; do not delete the shared fixture.
   - Sign out and confirm protected content is no longer visible.

## Native behaviour evidence

Capture a short recording or screenshots for each passed behaviour:

- Native AT CAPACITY launch and status-bar treatment.
- Native SwiftUI workout execution, haptics, rest timer and local draft recovery after termination.
- Haptic feedback on marked primary interactions.
- Native camera/photo permission sheets from a progress-photo flow.
- External Terra/OAuth provider hand-off in a secure browser and return through the installed app's deep link.
- Native APNs permission after explicit opt-in, notification receipt and deep-link opening.
- Custom-scheme or verified app URL opening the intended in-app route while rejecting unrelated routes/origins.
- Offline recovery screen and successful retry without browser chrome.
- Session persistence across termination and relaunch, plus queued completion after losing connectivity.

Do not claim a behaviour in review notes until it passes on exact TestFlight Build 10.

## Guideline 4.2 position

The strongest truthful case is that AT CAPACITY is an authenticated coaching product with interactive training logging, progress tracking, private coach messaging, connected-health ingestion and native device integrations. It is not a marketing site, catalogue or collection of links.

The risk is reduced, not eliminated: Capacitor still loads the hosted portal for the wider coaching product, but the app's most repeated client workflow is now a SwiftUI-native, offline-capable workout runner with local persistence, haptics and queued authenticated sync. Reviewer notes cannot guarantee Apple acceptance, so the exact TestFlight evidence must show this is a functional native capability rather than cosmetic chrome.

## Prepared review-note appendix

Copy this appendix into App Store Connect only after every named item has passed:

> AT CAPACITY uses a SwiftUI-native workout runner with local draft persistence, haptic set completion, rest timing, session overview/jump navigation and offline-safe queued sync. The wider iOS app provides explicit APNs opt-in and notification deep links, camera/photo access, secure external provider authorisation and return, safe Universal Links and offline recovery. The signed-in product is an interactive coaching service: reviewers can log and edit a prescribed workout, complete a Daily Tracker entry, review progress, use private coach messaging and inspect connected-health summaries. Connected signals are informational only and never diagnose conditions or alter a programme automatically.

## Stop condition

Passing this walkthrough prepares the submission; it does not authorise it. Leave **Add for Review** untouched until Kevin gives separate instruction.
