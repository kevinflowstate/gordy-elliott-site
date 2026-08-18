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
| App Store Connect Apple ID | `6792719833` |
| Bundle ID | `com.gordyelliott.shift` |
| Apple team | `H4J3XX8R8M` |
| Marketing version | `1.0` |
| Current candidate | Build `7` (signed local pre-submission candidate; not uploaded or submitted for review) |
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

- Gordy's approval of the listing copy, content-rights answer and representative review fixture.
- Google Calendar branding/data-access verification is approved. Production now contains synced Google and Outlook events, but both providers still need exact Build 8 native-return and disconnect/reconnect checks.
- Complete the physical-device TestFlight pass and crash review on exact Build 8.
- Run the exact TestFlight reviewer walkthrough with the now-verified fictional Demo Client credential saved in App Store Connect.
- Retest MyFitnessPal nutrition ingestion and Oura current-day freshness after the Terra production cutover.
- Pass a real-device APNs delivery and deep-link opening test.
- Complete Digital Services Act trader/business details with the account owner's legal information.
- Complete and publish truthful App Accessibility declarations after physical-device accessibility QA.
- Resolve or explicitly accept the Guideline 4.2 risk documented in `docs/app-store-reviewer-walkthrough.md`: the native integrations are real, but the core client interface is still delivered by the hosted portal.

## Closed pre-submission controls

- Supabase leaked-password protection is enabled. The live Supabase security advisor returned no findings on 6 August.
- Build 8 has a production-signed local archive with a valid distribution signature, production APNs and Universal Link entitlements, `get-task-allow = false`, iPhone-only device family and valid Capacitor/Cordova privacy manifests.
- Build 8 passed Xcode's archive-time local store validation and Organizer's network-backed **Validate App**. Upload, processing and TestFlight selection remain outstanding.
- Xcode confirms Build 6 was previously uploaded. App Store version 1.0 has not been submitted for review.
- The fictional Demo Client credential stored in App Store Connect signs in successfully to production.

## Submission hold

Preparation may include archiving, validating and uploading Build 8 to the internal TestFlight group. Do not click **Add for Review**, submit version 1.0 to App Review, accept new legal terms or enable automatic release until Kevin gives separate submission authorization.

## Google approval trigger

Google's approval should start only the final calendar closeout:

Completed on 7 August 2026:

1. Google approved AT CAPACITY branding and data access.
2. Production browser QA showed no unverified-app warning and passed connect, return, sync, refresh, disconnect/reconnect and cancellation handling.
3. Calendar-to-AI isolation remains covered by the release-contract suite.
4. App Store Connect review notes were updated for the previously processed candidate. Build 8 still needs upload and selection.

Still required:

1. Prove exact TestFlight native return and real event ingestion; the QA Google calendar had zero events in the seven-day sync window.
2. Submit manually to Apple only after the remaining App Store Connect and physical-device gates above are complete.
