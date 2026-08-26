# App Store Release Audit

Date: 26 August 2026

Candidate: AT CAPACITY 1.0 (Build 10)

Verdict: **READY AFTER SPECIFIC PREREQUISITES**. The Gordy-owned binary is validated, processed, installed through TestFlight and fully prepared in App Store Connect. It must not be added for review until the final hosted-portal change is deployed and the exact Build 10 physical-device walkthrough is repeated.

## Exact candidate

- Source baseline before the final hosted-portal correction: `33879f92997a384886ee5c82c6f9ab102653771d` on `codex/gordy-apple-ownership`.
- Archive: `/Volumes/XCode/Storage-Quarantine-2026-07-15/AT-CAPACITY-Releases/AT-CAPACITY-1.0-10.xcarchive`.
- App Store Connect Apple ID: `6805066999`.
- Bundle ID: `com.gordyelliott.atcapacity`.
- Version/build: `1.0 (10)`.
- Apple team: `5NU9323724`.
- Device family: iPhone only.
- Production origin: `https://app.onlinegordy.com`.

## Confirmed Apple state

- Build 10 passed Xcode archive validation and Organizer's network-backed **Validate App**.
- Apple processed Build 10 successfully and the build has been installed through Gordy's TestFlight account.
- Build 10 is selected for App Store version 1.0.
- The version is still **Prepare for Submission**; **Add for Review has not been clicked**.
- Release is set to manual.
- The app is free, public and available in all 175 App Store countries/regions after release.
- Untested Apple Silicon Mac and Apple Vision Pro availability are disabled.
- Name, subtitle, categories, content-rights answer, 16+ age rating and non-medical-device declaration are saved.
- The privacy policy/choices URLs and a 14-data-type, identity-linked, no-tracking privacy label were published.
- Product copy, keywords, support/marketing URLs, review contact, verified fictional Demo Client login and reviewer notes are saved.
- Six 1284 x 2778 iPhone screenshots are attached in the intended order: Home, Training, active session, Daily Tracker, DM and Nutrition.
- Digital Services Act trader status is already configured for the app.

## Native product value and Guideline 4.2

The repeated workout workflow uses a SwiftUI-native runner with one-exercise-at-a-time logging, haptics, Apply Set 1 to All, rest timing, Up Next, overview/jump navigation, edit mode, local draft persistence and queued authenticated sync. The shell also supplies native splash/offline handling, APNs opt-in and deep links, camera/photo/microphone flows, Universal Links and secure provider return.

This is materially stronger than a repackaged website, but Apple retains discretion under Guideline 4.2 because the wider coaching interface is still served by the hosted portal. Review notes must remain factual and the physical reviewer simulation must demonstrate the native workout rather than merely describing it.

## Preflight correction found on 26 August

The unified Home refactor retained the calendar/wearable priority decision logic but stopped rendering its result. The release test correctly caught the missing “Today’s priority” card. The smallest restoration is now in the working tree and has passed metadata validation, TypeScript, all 210 release-contract tests, lint with zero errors, the production build and visual journey QA at 390 px, 430 px and 1440 px. It must still be deployed to the hosted portal and retested through Build 10 before submission.

## Remaining submission gates

1. Deploy the locally verified Home priority restoration, then confirm production and TestFlight show the same current Home experience.
2. Run `docs/testflight-checklist.md` and `docs/app-store-reviewer-walkthrough.md` on exact Build 10, including launch/session persistence, native workout save/edit/offline recovery, DM photo/voice, booking prompt, account deletion confirmation and error/empty states.
3. On physical devices, prove APNs receipt/deep-link opening; password-reset Universal Link; Google/Outlook and Terra native return; MyFitnessPal nutrition ingestion; Oura current-day freshness; and camera/photo/microphone permission handling.
4. Complete the accessibility matrix on a small and current large iPhone. Leave unsupported or unverified App Accessibility declarations unselected.
5. Review TestFlight crash feedback after the final walkthrough and obtain Gordy's approval of the finished product page and reviewer journey.

WHOOP and bloodwork are not version 1 submission blockers provided unavailable or deferred functionality is not advertised as live.

## Stop condition

Passing the gates above prepares the submission; it does not authorise it. Leave version 1.0 in **Prepare for Submission** and wait for Kevin's explicit instruction before **Add for Review**.
