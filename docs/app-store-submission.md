# App Store Submission Sheet

This is the operational index for submission. Use the linked worksheets as the canonical values rather than duplicating answers in App Store Connect from memory:

- Listing copy and review notes: `docs/app-store-metadata.md`
- App Privacy answers: `docs/app-privacy-questionnaire.md`
- Age rating: `docs/app-store-age-rating.md`
- Accessibility declarations: `docs/app-store-accessibility.md`
- Reviewer walkthrough and Guideline 4.2 evidence: `docs/app-store-reviewer-walkthrough.md`
- Screenshot sequence: `docs/app-store-screenshot-plan.md`
- TestFlight execution: `docs/testflight-checklist.md`
- Current technical evidence: `docs/app-store-release-audit.md`

## Registered product

| Field | Value |
| --- | --- |
| App Store name | AT CAPACITY by Gordy |
| App Store Connect Apple ID | `6805066999` |
| Bundle ID | `com.gordyelliott.atcapacity` |
| Apple team | `5NU9323724` |
| Marketing version | `1.0` |
| Current candidate | Build `10` (validated, processed in TestFlight and selected for version 1.0; not added for review) |
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

- Complete the physical-device TestFlight reviewer walkthrough and crash review on exact Build 10 after the final hosted-portal deployment.
- Retest Google/Outlook return, MyFitnessPal nutrition ingestion, Oura current-day freshness and APNs receipt/deep-link opening on that exact candidate.
- Complete the accessibility evidence matrix on a small and current large iPhone; publish only the declarations actually demonstrated.
- Confirm Gordy's final approval of the listing screenshots/copy and the remaining Guideline 4.2 risk documented in `docs/app-store-reviewer-walkthrough.md`.

## Closed pre-submission controls

- Supabase leaked-password protection is enabled. The live Supabase security advisor returned no findings on 6 August.
- Build 10 has a production-signed archive with a valid distribution signature, production APNs and Universal Link entitlements, `get-task-allow = false`, iPhone-only device family and valid Capacitor/Cordova privacy manifests.
- Build 10 passed archive-time validation, Organizer's network-backed **Validate App**, Apple processing and internal TestFlight installation. It is selected for version 1.0.
- App Store Connect has the free worldwide price schedule, iPhone-only availability, published privacy label, 16+ age rating, non-medical-device declaration, metadata, review account, manual release setting and six 6.5-inch screenshots.
- Version 1.0 remains **Prepare for Submission** and has not been added for review.
- The fictional Demo Client credential stored in App Store Connect signs in successfully to production.

## Submission hold

Do not click **Add for Review** or submit version 1.0 until Kevin gives separate submission authorization. Manual release is selected so an approval cannot publish the app automatically.

## Google approval trigger

Google's approval should start only the final calendar closeout:

Completed on 7 August 2026:

1. Google approved AT CAPACITY branding and data access.
2. Production browser QA showed no unverified-app warning and passed connect, return, sync, refresh, disconnect/reconnect and cancellation handling.
3. Calendar-to-AI isolation remains covered by the release-contract suite.
4. App Store Connect review notes are saved against selected Build 10. Exact-device native return still needs its final pass.

Still required:

1. Prove exact TestFlight native return and real event ingestion; the QA Google calendar had zero events in the seven-day sync window.
2. Submit manually to Apple only after the remaining App Store Connect and physical-device gates above are complete.
