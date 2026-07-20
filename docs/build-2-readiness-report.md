# Build 2 Readiness Report

Date: 20 July 2026

## Verdict

Build 2 is ready for pull-request review and a controlled web deployment. It is not ready for App Store submission yet. Build 1 remains untouched in TestFlight, and no Build 2 archive has been uploaded.

Archive Build 2 only after this branch is merged, the web deployment is verified, and the physical-device TestFlight checklist is complete. The native app loads the hosted portal, so archiving before the matching web release would create misleading release evidence.

## Evidence completed

- Full portal verification passed: ESLint has zero errors, the production Next.js build completed, TypeScript passed, 121 routes rendered, and the SHIFT AI input contract passed.
- The iOS simulator target compiled successfully with Xcode 26.3.
- iOS release preflight passed for `com.gordyelliott.shift`, Apple team `H4J3XX8R8M`, version `1.0`, build `2`, HTTPS server configuration and the distribution signing identity.
- Terra signature, tamper/replay-tolerance and official array-payload normalization tests passed.
- Authenticated responsive QA passed 56 route/viewport checks at 320, 390, 430 and 1440 pixels without horizontal overflow, server errors, console errors or unexpected auth redirects.
- Privacy and support pages are public, while client account deletion is authenticated, confirmation-gated, admin-blocked and removes client-owned database records and private uploads.
- `npm audit` reports zero known vulnerabilities.

## Known non-blocking debt

- ESLint reports 45 pre-existing warnings and zero errors.
- Next.js warns that the `middleware` convention is deprecated in favour of `proxy`; changing the authentication boundary should be handled separately with dedicated regression coverage.
- Terra webhooks are batched to minimise response time, but production webhook latency and retry alerts still need monitoring once real traffic begins.

## Gates before submission

- Complete physical-device TestFlight runs on a small and current large iPhone, including offline, keyboard, camera/photo, backgrounding and session persistence tests.
- Review TestFlight crashes and Xcode Organizer validation, then capture screenshots from the approved candidate.
- Add Gordy's final domain and a monitored public support/privacy contact.
- Complete App Store metadata, age rating, privacy questionnaire, review notes and dedicated representative reviewer credentials.
- If Connected Apps ships in version 1, add Terra production credentials and signing secret, then pass Garmin, Oura and MyFitnessPal provider acceptance tests.
- Decide whether native APNs notifications are a version 1 requirement. Current browser/PWA notification delivery is not equivalent to native iOS push.

## Deliberately deferred

- Apple Health/HealthKit support.
- Universal Links until the final domain is available.
- Kahunas history import.
- Terra/Flo support unless confirmed in writing and proven with a provider-level test.
