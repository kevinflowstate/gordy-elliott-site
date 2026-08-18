# App Store Release Audit

Date: 17 August 2026

Candidate: AT CAPACITY 1.0 (Build 7)

Verdict: **NOT READY** for App Store submission. The code, signed archive, Apple validation and browser-level release contracts are in strong condition, but exact-build TestFlight and physical-device evidence are still required. Version 1.0 must remain in **Prepare for Submission**.

## Exact candidate

- Source baseline: `origin/main` at `2d1c197` plus the preparation-only changes recorded in this audit branch.
- Signed archive: `/Volumes/XCode/Storage-Quarantine-2026-07-15/AT-CAPACITY-Releases/AT-CAPACITY-1.0-7.xcarchive`.
- Bundle ID: `com.gordyelliott.shift`.
- Version/build: `1.0 (7)`.
- Minimum iOS: 15.0.
- Device family: iPhone only.
- Production origin: `https://app.onlinegordy.com`.
- Apple team: `H4J3XX8R8M`.

Xcode confirmed that Build 6 has already been uploaded to App Store Connect. Build 7 is the next valid source/Xcode candidate and has not been uploaded or submitted during this preparation pass. The App Store Connect browser session had expired, so Build 6's TestFlight group/status and the version attachment still need a live dashboard check.

## Passed evidence

- `npm run ios:preflight`: passed for Build 7 identity, signing team, production origin and Xcode 26.3.
- `npm run ios:build`: passed for the generic simulator.
- `npm run ios:archive`: passed; `** ARCHIVE SUCCEEDED **` with an Apple Distribution signature and the `AT CAPACITY App Store` profile.
- Xcode's archive-time store validation (`builtin-validationUtility -validate-for-store`) passed.
- Xcode Organizer's network-backed **Validate App** passed for exact Build 7 with no errors.
- `codesign --verify --deep --strict`: passed for the archived app.
- Archived entitlements: production APNs, `applinks:app.onlinegordy.com`, beta reports enabled and `get-task-allow = false`.
- Archived bundle: `1.0 (7)`, `com.gordyelliott.shift`, iPhone-only; only the expected Capacitor and Cordova frameworks are embedded and both privacy manifests are present.
- Embedded native shell is byte-for-byte identical to the prepared source shell.
- `npm run test:release-contracts`: 193/193 passed.
- Focused Composio, Terra and Universal Link suites: 10/10, 24/24 and 6/6 passed.
- Strict TypeScript and ESLint with zero errors: passed.
- Production Next.js build: passed with 144 routes. The only framework warning is the non-blocking Next.js middleware-convention deprecation.
- `npm audit --omit=dev`: zero known production dependency vulnerabilities after pinning patched Nano ID and PostCSS versions.
- App Store metadata verifier: passed the listing-length and iPhone-only constraints.
- Authenticated production reviewer contract: 84 assertions passed across sign-in, training selection/editing, tracker, nutrition, DM, AI, settings, native push APIs, public policies, offline shell and accessibility affordances.
- Responsive browser QA passed for workout, connected health, MyFitnessPal, strength progress and Gordy-feedback journeys at small/large iPhone and desktop widths, including key empty and error states.
- The isolated fictional App Review fixture now passes its production checker with representative training, nutrition, workout history, tracker entries, check-ins and two-way DM data. Its provisioning command is explicitly guarded and fixed to `demo@flowstatesystems.ai`.

## Live integration evidence

Read-only production inspection on 17 August found:

- Wearables: four stored connections across Oura, MyFitnessPal and Garmin; three connected and one error. Twenty-four normalized summaries exist, with sleep in 21, HRV in 20, readiness in 24 and nutrition in two. The newest summary is dated 15 August, so a fresh physical-device sync must still be demonstrated.
- Calendar: Google and Outlook both show connected; 68 events are stored (14 Google and 54 Outlook), with upcoming events through 24 August.
- Push: one active production APNs device record exists. This proves registration, not notification delivery or deep-link opening.
- Production Supabase migration history matches the repository through `20260817113000`.

Terra production is prepared with Garmin, Oura, Fitbit and MyFitnessPal plus the production webhook destination. WHOOP remains disabled pending Terra's TLS/domain approval. Production Terra credentials are stored in Vercel's Production environment, but no deployment was triggered; the next deployment is the cutover point and will require provider reconnection/smoke testing.

## Submission blockers

1. **Build 7 is not in TestFlight.** It therefore has no exact-build physical walkthrough, crash/launch record or reviewer simulation.
2. **Physical-device journeys remain unproven on Build 7:** APNs receipt and deep-link opening; password reset and Universal Link return; Google/Outlook native OAuth return; MyFitnessPal nutrition ingestion; Oura current-day freshness; camera/photo; offline/recovery; small/large iPhone accessibility.
3. **App Store Connect declarations are unverified:** DSA trader status, Accessibility declarations, final metadata/review credential/build attachment and crash data need an authenticated account-owner pass.
4. **Guideline 4.2 risk remains.** The app has real native push, haptics, Universal Links, camera/photo, OAuth hand-off and offline behaviour, but most product UI is still a hosted portal. Apple acceptance cannot be guaranteed by automated checks.

WHOOP is not a submission blocker provided it remains disabled and is not advertised in version 1.

## Exact remaining sequence

1. Commit and merge only the reviewed preparation changes; deploy the Terra production environment cutover separately with a rollback-ready Vercel deployment.
2. Smoke-test production sign-in, Oura, MyFitnessPal, Google and Outlook after that deployment. Confirm current-day data and disconnect/reconnect behaviour. Keep WHOOP disabled.
3. Upload Build 7 to the internal TestFlight group only. Do not click **Add for Review**.
4. Execute `docs/testflight-checklist.md`, `docs/app-store-reviewer-walkthrough.md` and `docs/app-store-accessibility.md` on a small and current large iPhone. Record APNs, provider return, offline, camera/photo and crash evidence.
5. Recheck the fictional review login and complete DSA/accessibility declarations and final listing approval in App Store Connect.
6. Reassess Guideline 4.2 using the exact TestFlight evidence.
7. Stop with version 1.0 in **Prepare for Submission** and wait for Kevin's explicit authorization before **Add for Review**.
