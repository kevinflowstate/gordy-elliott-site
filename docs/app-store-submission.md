# App Store Submission Sheet

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

## URLs after this branch is deployed

- Privacy policy: `/privacy`
- Support: `/support`
- Client login: `/login`
- Account deletion: Settings > Delete account

Replace the Vercel-hosted URLs in App Store Connect when Gordy's final domain is live.

## Review notes draft

SHIFT Coaching is a sign-in-only companion app for existing Gordy Elliott coaching clients. Coaching enrolment and payment happen outside the app. Reviewers can use the supplied client account to inspect assigned training and nutrition plans, direct messaging, check-ins, progress tracking and connected-app settings. The app does not offer in-app purchases or public account creation.

Connected-health summaries are informational coaching signals. They do not diagnose conditions and never alter a training programme automatically. Apple Health is not enabled in version 1.

## Submission blockers

- Final domain and monitored support contact.
- Dedicated App Review credentials with representative non-personal data.
- App Store description, keywords, categories, age rating and screenshots.
- App Privacy questionnaire completed from `docs/app-privacy-inventory.md`.
- Physical-device TestFlight pass and crash review.
- Terra production provider testing if Connected Apps is included in version 1.
