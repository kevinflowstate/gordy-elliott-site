# App Store Release Audit

Date: 18 August 2026

Candidate: AT CAPACITY 1.0 (Build 8)

Verdict: **NOT READY** for App Store submission. The candidate is code-complete, but its signed archive must be regenerated after the final protected-storage hardening, then uploaded to TestFlight and exercised on physical devices as exact Build 8. Version 1.0 must remain in **Prepare for Submission**.

## Exact candidate

- Source baseline: `origin/main` at `9298910` plus the native-workout candidate changes on `codex/native-workout-appstore-2026-08-18`.
- Archive destination: `/Volumes/XCode/Storage-Quarantine-2026-07-15/AT-CAPACITY-Releases/AT-CAPACITY-1.0-8.xcarchive`. A signed pre-hardening archive passed, but it is not the final candidate and must be replaced.
- Bundle ID: `com.gordyelliott.shift`.
- Version/build: `1.0 (8)`.
- Minimum iOS: 15.0.
- Device family: iPhone only.
- Production origin: `https://app.onlinegordy.com`.
- Apple team: `H4J3XX8R8M`.

Build 8 has not been uploaded or submitted during this preparation pass.

## New native product value

The repeated workout workflow now runs in a full-screen SwiftUI surface rather than hosted portal UI. It includes a session preview, one-exercise-at-a-time logging, set completion haptics, **Apply set 1 to all**, an in-workout rest timer, **Up next**, a full-session overview with jump navigation, final review, edit mode, atomic local draft persistence and offline-safe queued sync through the existing authenticated exercise-log API. Older iOS builds and ordinary web users retain the existing web runner as a fallback.

Simulator QA on an iPhone 17 Pro completed the native journey through start, entry, apply-to-all, set completion, rest timer, overview/jump, navigation and save. Force-terminating and relaunching restored the exact exercise, elapsed workout, values and completion state. This materially improves the Guideline 4.2 position; Apple acceptance still cannot be guaranteed.

## Passed evidence

- `npm run ios:preflight`: passed for Build 8 identity, signing team, production origin and Xcode 26.3.
- The pre-hardening Build 8 archive passed with `** ARCHIVE SUCCEEDED **`, Apple Distribution signing, the `AT CAPACITY App Store` profile and archive-time store validation.
- `codesign --verify --deep --strict` passed for that archive; its entitlements included production APNs, `applinks:app.onlinegordy.com`, beta reports and `get-task-allow = false`.
- The final protected-storage patch still needs a fresh compile and replacement archive because Xcode became blocked reading the external Xcode volume while the Mac was locked.
- `npm run test:release-contracts`: 199/199 passed, including the native workout payload and delayed-offline-sync contracts.
- Strict TypeScript: passed.
- ESLint: zero errors. The full project reports 45 existing warnings; focused lint over every touched TypeScript/TSX file reports none.
- Production Next.js build: passed with 144 routes. The only framework warning is the non-blocking Next.js middleware-convention deprecation.
- `npm audit --omit=dev`: zero known production dependency vulnerabilities.
- App Store metadata verifier passed the listing-length and iPhone-only constraints.
- The read-only production App Review fixture checker passed for `demo@flowstatesystems.ai`, including two sessions/ten exercises, nutrition, recent tracker history, check-ins and two-way DM data.
- Native simulator accessibility tree exposed named controls for session overview, exercise navigation, set fields, completion, review and save.

## Submission blockers

1. **The final Build 8 archive must be regenerated.** The existing archive predates the last protected-storage/save-failure hardening and must not be uploaded.
2. **Build 8 is not in TestFlight.** It therefore has no exact-build physical walkthrough, crash/launch record or reviewer simulation.
3. **The new native queue needs one real-device server corroboration.** Complete a workout offline, reconnect, verify the visible saved history and confirm the corresponding owned exercise-log record through the existing review fixture checks.
4. **Other physical-device journeys remain unproven on exact Build 8:** APNs receipt/deep-link opening; password-reset Universal Link; Google/Outlook and Terra native return; current-day Oura/MyFitnessPal ingestion; camera/photo; small/large iPhone accessibility.
5. **App Store Connect declarations remain a manual account-owner lane:** confirm DSA trader status, Accessibility declarations, final metadata, working review credential, selected build and crash data.
6. **Network-backed Organizer Validate App has not yet been run for final Build 8.** Apple server validation is required before upload/submission.
7. **Guideline 4.2 risk is reduced but not eliminated.** The workout runner is now unmistakably native and useful offline, while the rest of the coaching product remains a hosted Capacitor portal.

WHOOP is not a submission blocker provided it remains disabled and is not advertised in version 1 until Terra confirms TLS and end-to-end testing passes.

## Exact remaining sequence

1. Unlock the Mac, rerun the final compile, replace the signed Build 8 archive and verify its signature/entitlements.
2. Review and merge the Build 8 candidate; deploy the web bridge/fallback code to production. Do not submit the App Store version.
3. Run Xcode Organizer **Validate App** against the exact signed Build 8 archive.
4. Upload Build 8 to the internal TestFlight group only. Do not click **Add for Review**.
5. Execute `docs/testflight-checklist.md`, `docs/app-store-reviewer-walkthrough.md` and `docs/app-store-accessibility.md` on a small and current large iPhone, including native workout termination recovery and offline completion/sync.
6. Recheck the fictional review login and complete DSA/accessibility declarations and final listing approval in App Store Connect.
7. Reassess Guideline 4.2 using the exact TestFlight evidence.
8. Stop with version 1.0 in **Prepare for Submission** and wait for Kevin's explicit authorization before **Add for Review**.
