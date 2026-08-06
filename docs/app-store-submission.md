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
| Current candidate | Build `5` (pre-submission validation candidate; not submitted for review) |
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
- Keep Google Calendar in version 1 only after Google's branding/data-access verification is approved and a real production connection, sync, disconnect and native return pass succeeds. Outlook also needs its production contract test.
- Complete the physical-device TestFlight pass and crash review on that exact Build 5.
- Reset and retest the fictional Demo Client password, then update App Store Connect to the same verified credential. The account exists, but the credential currently saved in App Store Connect was rejected by production on 6 August.
- Retest MyFitnessPal after the observed Terra upstream login timeout. Oura has connected and returned recovery/readiness data in TestFlight.
- Pass a real-device APNs delivery and deep-link opening test.
- Complete Digital Services Act trader/business details with the account owner's legal information.
- Complete and publish truthful App Accessibility declarations after physical-device accessibility QA.
- Resolve or explicitly accept the Guideline 4.2 risk documented in `docs/app-store-reviewer-walkthrough.md`: the native integrations are real, but the core client interface is still delivered by the hosted portal.

## Closed pre-submission controls

- Supabase leaked-password protection is enabled. The live Supabase security advisor returned no findings on 6 August.
- Build 5 has a production-signed local archive with a valid distribution signature, production APNs entitlement, `get-task-allow = false`, iPhone-only device family and valid Capacitor/Cordova privacy manifests.
- Build 5 passed Organizer validation, uploaded successfully, completed Apple processing and is available to the `SHIFT Internal` TestFlight group as **Ready to Submit**.
- The live App Store Connect version remains **Prepare for Submission**, uses manual release and has not been added for review.

## Submission hold

Preparation may include archiving, validating and uploading Build 5 to TestFlight. Do not click **Add for Review**, submit version 1.0 to App Review, accept new legal terms or enable automatic release until Kevin gives separate submission authorization.

## Google approval trigger

Google's approval should start only the final calendar closeout:

1. Connect the review fixture to Google Calendar through the production OAuth consent screen.
2. Confirm the app receives the native return, shows Connected rather than Pending, syncs read-only events and can disconnect cleanly.
3. Confirm no unverified-app warning appears and calendar data remains excluded from AI routes.
4. Update the final review notes with the verified behaviour and select the approved TestFlight build.
5. Submit manually to Apple only after the remaining App Store Connect and physical-device gates above are complete.
