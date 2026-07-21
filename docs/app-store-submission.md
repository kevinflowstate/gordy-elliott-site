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
| App Store name | SHIFT Coaching by Gordy |
| App Store Connect Apple ID | `6792719833` |
| Bundle ID | `com.gordyelliott.shift` |
| Apple team | `H4J3XX8R8M` |
| Marketing version | `1.0` |
| Current candidate | Build `2` |
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

Replace the Vercel-hosted URLs in App Store Connect when Gordy's final domain is live.

The canonical review notes and contact details are in `docs/app-store-metadata.md`. Review credentials remain only in App Store Connect.

## Submission blockers

- Gordy's approval of the listing copy, content-rights answer and representative review fixture.
- Enter the drafted listing, age rating and privacy answers in App Store Connect.
- Capture final screenshots from the approved candidate.
- Physical-device TestFlight pass and crash review.
- Terra production provider testing if Connected Apps is included in version 1.
- Enable the Apple Push Notifications capability, add APNs server credentials and pass a real-device delivery test.
- Enable Supabase leaked-password protection in the dashboard.
