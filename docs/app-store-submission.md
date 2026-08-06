# App Store Submission Sheet

This is the operational index for submission. Use the linked worksheets as the canonical values rather than duplicating answers in App Store Connect from memory:

- Listing copy and review notes: `docs/app-store-metadata.md`
- App Privacy answers: `docs/app-privacy-questionnaire.md`
- Age rating: `docs/app-store-age-rating.md`
- Screenshot sequence: `docs/app-store-screenshot-plan.md`
- TestFlight execution: `docs/testflight-checklist.md`
- Current technical evidence: `docs/app-store-release-audit.md`

## Registered product

| Field | Value |
| --- | --- |
| App Store name | AT CAPACITY by Gordy |
| App Store Connect Apple ID | `6792719833` |
| Bundle ID | `com.gordyelliott.shift` |
| Apple team | `H4J3XX8R8M` |
| Marketing version | `1.0` |
| Current candidate | Build `3` |
| Business model | Existing clients sign up/pay on the web, then sign in to the app |

## Build commands

- `npm run ios:preflight` validates Xcode, signing identity, bundle ID, team, version, build and HTTPS server origin.
- `npm run ios:build` creates an unsigned simulator build.
- `npm run ios:archive` syncs the hosted portal shell and creates a signed archive on the writable external Xcode volume.
- The archive command never uploads. Validate in Xcode Organizer, then distribute deliberately.

## Public URLs

- Privacy policy: `/privacy`
- Support: `/support`
- Client login: `/login`
- Account deletion: Settings > Delete account

Use the canonical `https://app.onlinegordy.com` URLs in App Store Connect.

The canonical review notes and contact details are in `docs/app-store-metadata.md`. Review credentials remain only in App Store Connect.

## Submission blockers

- Confirm the live App Store Connect record is named "AT CAPACITY by Gordy"; the repository cannot verify the signed-in Apple state.
- Gordy's approval of the listing copy, content-rights answer and representative review fixture.
- Reconcile the drafted listing, age rating, privacy answers and review notes against App Store Connect. The last repository evidence says the saved listing predates the calendar and connected-health updates.
- Keep Google Calendar in version 1 only after Google's branding/data-access verification is approved and a real production connection, sync, disconnect and native return pass succeeds. Outlook also needs its production contract test.
- Capture final screenshots from the approved candidate. The uploaded 21 July set predates the redesigned Health & Capacity and workout experiences.
- Physical-device TestFlight pass and crash review.
- Retest MyFitnessPal after the observed Terra upstream login timeout. Oura has connected and returned recovery/readiness data in TestFlight.
- Enable the Apple Push Notifications capability, add APNs server credentials and pass a real-device delivery test.
- Enable Supabase leaked-password protection in the dashboard.

## Google approval trigger

Google's approval should start only the final calendar closeout:

1. Connect the review fixture to Google Calendar through the production OAuth consent screen.
2. Confirm the app receives the native return, shows Connected rather than Pending, syncs read-only events and can disconnect cleanly.
3. Confirm no unverified-app warning appears and calendar data remains excluded from AI routes.
4. Update the final review notes with the verified behaviour and select the approved TestFlight build.
5. Submit manually to Apple only after the remaining App Store Connect and physical-device gates above are complete.
