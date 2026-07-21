# Build 2 Readiness Report

Date: 21 July 2026

## Verdict

Build 2 is ready for a controlled web deployment and then a signed archive. It is not ready for final App Store submission yet. Build 1 remains available in TestFlight, and no Build 2 archive has been uploaded.

Archive Build 2 only after this branch is merged, the web deployment is verified, and the physical-device TestFlight checklist is complete. The native app loads the hosted portal, so archiving before the matching web release would create misleading release evidence.

## Evidence completed

- Full portal verification passed: ESLint has zero errors, strict TypeScript passed and the production Next.js build rendered 122 routes.
- The iOS simulator target compiled successfully with Xcode 26.3.
- iOS release preflight passed for `com.gordyelliott.shift`, Apple team `H4J3XX8R8M`, version `1.0`, build `2`, HTTPS server configuration and the distribution signing identity.
- Terra signature, tamper/replay-tolerance and official array-payload normalization tests passed.
- Authenticated responsive QA passed 56 route/viewport checks at 320, 390, 430 and 1440 pixels without horizontal overflow, server errors, console errors or unexpected auth redirects.
- The App Store behavior gate passed 61 assertions covering public policy/support access, security headers, training hierarchy, DM/AI keyboard behavior, Daily Tracker history, consultation inputs, network tracking and authenticated APNs token registration/removal.
- Four independent code-review passes found and prompted fixes for token cleanup on sign-out, APNs build-environment routing, connection reuse/timeouts, app-topic scoping, duplicated contracts and fixture cleanliness.
- The production native-device migration is applied. RLS is enabled; `anon` and `authenticated` have no table privileges; `service_role` is the only browser-backend role with access.
- Privacy and support pages are public, while client account deletion is authenticated, confirmation-gated, admin-blocked and removes client-owned database records and private uploads.
- `npm audit` reports zero known vulnerabilities.

## Known non-blocking debt

- ESLint reports 45 pre-existing warnings and zero errors.
- Next.js warns that the `middleware` convention is deprecated in favour of `proxy`; changing the authentication boundary should be handled separately with dedicated regression coverage.
- Terra webhooks are batched to minimise response time, but production webhook latency and retry alerts still need monitoring once real traffic begins.
- Supabase's remaining security warning is the project-level leaked-password protection toggle. Existing RLS performance advisories need a separate policy-consolidation migration and are not a Build 2 behavior regression.

## Gates before submission

- Complete physical-device TestFlight runs on a small and current large iPhone, including offline, keyboard, camera/photo, backgrounding and session persistence tests.
- Review TestFlight crashes and Xcode Organizer validation, then capture screenshots from the approved candidate.
- Approve and enter the prepared App Store metadata, age rating and privacy questionnaire, then capture candidate screenshots.
- Enable leaked-password protection in Supabase Auth settings.
- Enable the production Push Notifications capability, configure APNs credentials and prove delivery on a physical TestFlight device.
- If Connected Apps ships in version 1, add Terra production credentials and signing secret, then pass Garmin, Oura and MyFitnessPal provider acceptance tests.
- Decide whether native APNs notifications are a version 1 requirement. Current browser/PWA notification delivery is not equivalent to native iOS push.

## Deliberately deferred

- Apple Health/HealthKit support.
- Universal Links until the final domain is available.
- Kahunas history import.
- Terra/Flo support unless confirmed in writing and proven with a provider-level test.
