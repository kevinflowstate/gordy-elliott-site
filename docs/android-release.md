# AT CAPACITY Android release

Package: `com.gordyelliott.atcapacity`. Initial Android version: `1.0.0` / code `1`, independently versioned from iOS. Server: `https://app.onlinegordy.com`.

## Build storage

Run from the external worktree `/Users/kevinharkin/Codex-Worktrees/gordy-android-release` (resolves onto CodexDev). `scripts/android-environment.mjs` validates the disk and places all heavy storage there; it never repurposes HOME or changes global shell settings.

| Content | Location |
| --- | --- |
| Android SDK | `/Volumes/CodexDev/Developer-Tools/Android/sdk` |
| JDK21 | `/Volumes/CodexDev/Developer-Tools/Java/temurin-21` |
| Gradle and downloaded wrapper | `/Volumes/CodexDev/Developer-Caches/gradle` |
| npm | `/Volumes/CodexDev/Developer-Caches/npm` |
| Android settings, emulator and AVD | `Developer-Caches/android-user`, `android-emulator`, `android-avd` on CodexDev |
| Temporary build/download files | `/Volumes/CodexDev/Developer-Caches/android-tmp` |
| APK, AAB, intermediate build output | Worktree `android/app/build` on CodexDev |
| Private upload signing | `/Volumes/CodexDev/Projects/AT-CAPACITY-Releases/android/signing` |

Two Gradle workers, 1536 MB heap and no persistent daemon keep resource use bounded. Builds fail if the disk is unavailable instead of falling back to the internal drive. Small OS credential or adb settings may remain on the Mac. No launchd paths have moved.

## Commands

- `npm run android:tools -- --accept-license`: install checksum-verified Google command-line tools and SDK36 after explicit licence approval.
- `npm run android:assets`: generate Android sizes from the existing ATC brand icon.
- `npm run android:sync`: prepare the HTTPS production shell and copy native assets/plugins.
- `npm run android:build`: compile the debug APK (Firebase may be absent; such a build does not prove push works).
- `npm run android:lint`: Android lint.
- `npm run android:key`: generate a private upload key once; existing files are never overwritten. Back up the keystore and signing configuration securely before release.
- `npm run android:bundle`: validate Firebase/signing, sync and generate the signed release AAB.
- `npm run test:android`: Android token, payload, certificate, privacy/reporting, migration/RLS and provider-selection contracts.

Install SDK command-line tools, platform36 and build tools36 on CodexDev after authorised SDK licence acceptance. The current JDK21 link reuses the existing external Temurin21 runtime from `antigravity-extensions/redhat.java-1.54.0-darwin-arm64/jre/21.0.10-macosx-aarch64`; if that extension is removed, replace the link with a maintained external JDK21 installation. No full Android Studio installation is needed for CLI compilation.

## Required Firebase configuration

Use a Gordy-owned Firebase project. Do not repurpose an unrelated client project or enable billing for messaging.

1. Register Android package `com.gordyelliott.atcapacity` in that project.
2. Download `google-services.json` and keep it outside Git. Set `ANDROID_GOOGLE_SERVICES_FILE` to the file; sync copies it to ignored `android/app/google-services.json`.
3. Configure production `FCM_SERVICE_ACCOUNT_JSON` with a service account authorised to send FCM for that same project. This is server-only and must never appear in the app bundle, public environment variables, logs or Git.
4. Apply `20261006120000_android_push_devices.sql` before deploying Android registration/delivery code. It preserves service-role-only access and existing APNs upsert compatibility.
5. Native delivery routes iOS records through APNs and Android records through FCM. Web fallback remains after no native delivery; credential/payload/project failures do not disable valid devices.
6. Test permission denial, permission grant, foreground/background delivery, notification tap, sign-out and account switching using a dedicated fixture. FCM defaults to the `coaching_updates` channel with the ATC notification icon. No Firebase Analytics SDK is added.

Release builds fail closed without Firebase and upload signing, including when Gradle is invoked directly. Debug compilation without Firebase is only scaffold verification.

## Links and platform behaviour

Android HTTPS intent filters cover login, onboarding callback/confirmation and portal URLs. `atcapacity://` uses the existing bounded route resolver. Support reporting stays inside the WebView; AI replies include a reporting action that carries only the selected response in a short-lived, tab-local draft, never in a URL or analytics payload.

After Play App Signing is enabled, obtain **the app-signing certificate SHA256** from Play Console. Configure `ANDROID_APP_LINKS_SHA256_FINGERPRINTS` (comma separated if multiple certificates) and deploy `/.well-known/assetlinks.json`. The upload certificate alone does not verify Play-installed apps. Validate Android's domain verification and actual emailed recovery links before release.

Android initially uses the existing grouped web workout; it does not claim the Swift runner is ported. Test supersets, AMRAP/EMOM timers, logging, interruption/restore and exercise video opening on Android. Hardware back navigates within the app and minimises at the portal/login root. Offline cold launch uses the bundled reconnection page; full offline workouts are not promised.

## Draft Play listing

Title: **AT CAPACITY**

Short description: **Your coaching, training, progress and AI support in one place.**

Full description:

AT CAPACITY brings Gordy Elliott's coaching into one app for his existing clients.

Access your personalised training plan, follow exercise instructions and available demonstration videos, and record your sessions. Keep nutrition targets, daily tracking, progress and coaching messages together. AT CAPACITY AI provides additional support with your plan and next steps, alongside Gordy's coaching. Optional supported wearable and calendar connections help bring relevant activity, recovery and schedule information into your coaching experience.

An existing coaching account is required. Available features depend on your programme. This is a fitness and coaching service, not a medical or emergency service.

Store URLs after deploying this branch: privacy `https://app.onlinegordy.com/privacy`; support `https://app.onlinegordy.com/support`; account deletion `https://app.onlinegordy.com/account-deletion`.

Do not copy the Apple privacy questionnaire blindly. Prepare Play Data Safety from the current inventory, including account/contact information, coaching/health records, messages, optional attachments/photos, calendar data, wearable data and device notification identifiers. Match collection/sharing purposes, encryption, deletion and provider statements to the deployed Android build. Complete Health apps, content rating, target audience, ads and app-access declarations; supply the verified dedicated fictional reviewer account privately.

Useful requirements: [target API](https://support.google.com/googleplay/android-developer/answer/11926878), [health declaration](https://support.google.com/googleplay/android-developer/answer/14738291), [AI reporting](https://support.google.com/googleplay/android-developer/answer/13985936), [deletion](https://support.google.com/googleplay/android-developer/answer/13327111).

## Submission gates

- Gordy completes owner-only identity/phone/website verification so Create app unlocks.
- SDK licence and external build tools installed; debug APK and Android lint pass.
- Firebase client/server project configured; migration and backend deployment verified.
- Signed AAB inspected; Play signing certificate associated with the production domain.
- Installed Android walkthrough: login/setup, training groups/timers/video, nutrition, AI/reporting, coach messages/upload, optional integration authorisation, keyboard/back, offline page, notification lifecycle and deletion instructions.
- Physical Android phone smoke test; emulator alone does not prove real-device push/background behaviour.
- Real Android screenshots/feature graphic prepared; truthful forms and working reviewer login checked.
- Upload to Play internal testing, examine automated/pre-launch findings, then submit after owner verification and release checks are satisfied.
