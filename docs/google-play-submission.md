# Google Play submission preparation

Prepared 6 October 2026 for `com.gordyelliott.atcapacity`, Android version 1.0.0 / code 1. This is a draft for the console, not a submitted declaration. Reconcile against the installed release and the actual questions before saving final answers.

## Listing

- App name: **AT CAPACITY** (11/30 characters).
- Short description: **Your coaching, training, progress and AI support in one place.** (62/80 characters).
- Category: Health & Fitness. App, not game. No ads in the authenticated app.
- Full description: use the copy in `android-release.md`; it describes Gordy's coaching plus supporting AI and optional connections. Do not promise every provider is available, automatic schedule editing, medical outcomes or full offline training.
- Privacy: `https://app.onlinegordy.com/privacy`.
- Support: `https://app.onlinegordy.com/support`.
- Account deletion: `https://app.onlinegordy.com/account-deletion`.
- Support email: `kevin@flowstatesystems.ai`, matching the published support/deletion routes. Developer public contact details must match Gordy's verified Play account.
- Screenshots must come from an installed Android build and a fictional populated client. Do not submit iPhone frames as Android screenshots. Capture dashboard, grouped workout, progress, private messaging and AI support. Feature graphic: 1024×500; icon: 512×512. Avoid claiming a store release while preparing the listing.

## App access and review notes

Access is restricted to existing coaching clients. Provide the existing fictional App Review fixture's email/password privately in Play Console. Do not commit credentials or use a real client's account. Verify password sign-in independently; temporary QA magic-link authentication does not prove the reviewer password works. Review notes should explain: no in-app purchase or subscription checkout; account provided by Gordy; optional notification/microphone/provider permissions; where grouped workouts, AI reply reporting, settings and deletion are located. An Android physical-device walkthrough remains outstanding.

## Data Safety working inventory

The app collects account-linked data for app functionality and, where relevant, coaching personalisation. This inventory is conservative; optional means users can decline that feature, not that the data category should be omitted.

| Google category | What AT CAPACITY handles | Required / optional; purpose |
| --- | --- | --- |
| Personal info: name, email, user IDs | Account/profile identity, login, coaching access | Required; functionality, account management |
| Personal info: phone number and other info | Optional consultation phone, goals and profile/consultation answers including date of birth | Optional fields; functionality, personalisation |
| Health and fitness: health info | Injuries, wellbeing, sleep/recovery/heart-rate summaries, optional cycle information and health consultation answers | Depends on fields/connections; functionality, personalisation |
| Health and fitness: fitness info | Plans, exercise logs, activity, nutrition tracking, body measurements and connected provider summaries | Core logs and optional integrations; functionality, personalisation |
| Messages: other in-app messages | Private coach/client DMs and AI exchanges | Optional use; functionality, personalisation |
| Photos and videos | Optional profile/progress/check-in/DM photos and support screenshots | Optional; functionality |
| Audio: voice or sound recordings | User-triggered private DM voice notes | Optional; functionality |
| Files and docs | User-submitted documents where the available flow uploads them | Optional; functionality; confirm actual Android flow |
| Calendar | Read-only Google/Outlook calendar connection and bounded event summaries | Optional connection; functionality, personalisation |
| App activity: app interactions and other user-generated content | Completion/adherence, check-ins, tracker notes, consultations, support reports and selected reported AI responses | Feature-dependent; functionality, personalisation; support/security as applicable |
| Device or other IDs | FCM token and Firebase installation ID; notification device registration | Messaging integration; functionality. FCM auto-initialisation can create an installation ID before notification permission is granted. Do not claim all identifier collection is opt-in. |
| App info and performance: diagnostics | Client-submitted platform/version details and server reliability/error information | Feature-dependent; functionality, fraud prevention/security where applicable; no Crashlytics SDK |

Collected versus shared must be evaluated under Google's definitions. Transfers to contracted service providers may qualify for the service-provider exception to “shared”; confirm processor terms/purposes before selecting final answers. Providers include Supabase, Vercel, Resend, AI/embedding providers, Terra, Composio and FCM. Do not describe sensitive coaching context as ephemeral: relevant app records are stored. Calendar data is not sent to AI providers in the inspected source.

Current source has no location permission, address-book access, advertising ID, in-app payment collection or Firebase Analytics/Crashlytics integration. FCM includes Firebase Installations, which generates an installation identifier; no Analytics SDK does not mean no data collection. Verify actual resolved Android dependencies and runtime traffic before final declarations. Optional BigQuery delivery export is not configured by this app.

Data is sent over HTTPS; the Android shell blocks cleartext traffic. In-app account deletion is in Settings, with an ownership-verified support fallback on the public deletion page. See the live privacy policy for retention; do not invent a universal deletion deadline. Support investigation/legal records can have separate retention.

## Other console forms

- Health apps declaration: disclose fitness/coaching and relevant nutrition/activity functions. No medical diagnosis/treatment claims or Health Connect access in this build.
- Generative AI: disclose the AI feature accurately; each assistant reply has a user-facing reporting route into private support.
- Ads: no ads in the authenticated/native app; marketing-site tracking is outside the app flow.
- Target audience/content rating: answer the actual questionnaire from the adult coaching service, private messaging and AI features. Confirm Gordy's intended age audience before final audience selection; do not infer “children” from the minimum allowed fixture age. Do not guess a content rating.
- If this is a personal developer account created after 13 November 2023, Google requires a closed test with at least 12 testers opted in continuously for 14 days before applying for production access. Verify account type in Play; organisation accounts have different eligibility. Internal testing does not satisfy that closed-test requirement.

## Release and test sequence

1. Gordy completes owner identity/phone verification and any device verification shown by Play.
2. Securely back up the existing private upload signing files. Keep the key; later updates depend on it.
3. Install the signed QA APK on a dedicated Android device, or upload the AAB to internal testing once allowed. AAB files are not directly installable.
4. Verify actual password login/setup links, grouped workouts/timers/video/logging, voice/photo DMs, keyboard/back navigation, offline reconnection and optional provider connections. Use fictional content; do not alter real client plans for QA.
5. Test notification permission denial/grant, foreground/background receipt, notification tap route, logout and account switching. Provider dry-run success alone is insufficient.
6. After Play App Signing enrolment, retrieve the **app-signing** certificate SHA256. Add it to production `ANDROID_APP_LINKS_SHA256_FINGERPRINTS` and verify HTTPS app links on a Play-installed build. The upload certificate is separate. A manually installed QA APK can use its own upload certificate for test-device association, without claiming Play association is complete.
7. Prepare real screenshots, reconcile the forms above and verify reviewer password access; run internal/pre-launch checks. Complete closed testing if the account requires it, then apply for production access and submit.

## Official references

- [Data Safety definitions](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Firebase Android disclosure, including FCM and Installations](https://firebase.google.com/docs/android/play-data-disclosure)
- [Listing assets](https://support.google.com/googleplay/android-developer/answer/9866151)
- [Account deletion](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Health apps](https://support.google.com/googleplay/android-developer/answer/14738291)
- [Generative AI content policy](https://support.google.com/googleplay/android-developer/answer/13985936)
- [Personal-account testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)
