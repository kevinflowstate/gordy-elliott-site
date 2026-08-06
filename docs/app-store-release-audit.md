# App Store Release Audit

Date: 6 August 2026

Candidate: AT CAPACITY 1.0 (Build 3)

Status: engineering preflight passed; not ready for final App Store submission

## Verified evidence

- Production Next.js build: passed, 141 routes.
- Strict TypeScript: passed.
- ESLint: zero errors and 45 existing application warnings. Generated Capacitor build products under `.ios-derived-data` are excluded from source linting.
- Release contract tests: 168 passed, including Google-data isolation, Terra lifecycle/consent, MyFitnessPal totals, strength progress, native push and the current workout overview.
- App Store production browser contract: 85 assertions passed on 6 August, including workout edit/navigation, mobile picker hit targets, Settings accessibility, Google disclosure/data isolation, public support/privacy and native push isolation.
- Focused visual QA passed for Health & Capacity, workout navigation, Strength Progress and MyFitnessPal nutrition at their supported mobile/desktop viewports.
- iPhone 17 Pro Max simulator build: succeeded with Xcode 26.3.
- Native launch and custom-scheme deep-link smoke tests: passed.
- Signed AT CAPACITY 1.0 (3) archive exists from 31 July 2026. No native-project, identity, launch-asset or native-shell files have changed since that archive.
- iOS release preflight passed on 6 August 2026 for the production URL, bundle ID, Apple team, distribution identity, manual signing, provisioning profile and production APNs entitlement.
- App Review fixture passed on 6 August: active adult fictional client with 2 sessions, 10 prescribed exercises, 4 meals, 3 recent tracker entries, 3 check-ins and two-way DM.
- Native push database: migration applied; RLS enabled; no `anon`/`authenticated` table access; authenticated register/read/remove API round trip passed.
- Dependency audit: zero known production vulnerabilities at the last release pass.
- Replacement App Store candidate screenshots: six opaque `1284 x 2778` iPhone JPEGs generated from production with the fictional review account on 6 August and visually inspected. They are ready for Gordy's approval and App Store Connect upload.

## App Store Connect state

The following state was last verified on 21 July 2026. It could not be rechecked on 6 August because the available browser sessions were signed out of App Store Connect:

- Version 1.0 listing copy, keywords, categories and support details are saved.
- Review username, contact details and notes are restored in the live form; Apple will not save that section until the required review password is entered.
- Distribution is free, public and iPhone-only; Mac, Apple Vision Pro and education-volume availability are disabled.
- The age questionnaire was complete at 9+, and the app was declared not to be a regulated medical device. Reconcile this against the current worksheet, which recommends a 16+ override because the intended-client policy excludes under-16s.
- App Privacy is published with 13 linked-to-identity data types and no tracking declaration.
- Manual release is selected. The version has not been added for review or submitted.
- Push Notifications is enabled for `com.gordyelliott.shift`, and the App Store distribution profile has been regenerated.
- The iPhone screenshot set is uploaded in this order: Dashboard, Training, Active Session, Daily Tracker, DM and Nutrition.

## Security review

The new APNs path now has bounded payload fields, a ten-second stream timeout, bounded provider responses, one HTTP/2 session per APNs environment per dispatch, app-topic filtering and invalid-token disablement. Sandbox/production classification comes from the native build marker. The current device token is removed before sign-out and account deletion clears the associated database rows.

Supabase's only current security warning is **Leaked Password Protection Disabled**. Enable it under Authentication settings before submission: [Supabase password security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Existing performance debt

- The release migration added all 13 missing foreign-key indexes and removed duplicate body-measurement indexes.
- 71 existing RLS policies use per-row auth function evaluation: [Auth RLS initialization-plan guidance](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan).
- 252 existing role/action combinations have multiple permissive policies: [multiple permissive policy guidance](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies).
- Newly created and low-traffic indexes appear as unused until production queries exercise them: [unused index guidance](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

The RLS advisories are optimization work, not evidence of unauthorized access. Consolidating them changes the authorization boundary across most tables and should be a dedicated migration with admin/client regression coverage, not folded into the App Store release deploy.

## Remaining human and external gates

- Sign into App Store Connect and reconcile the live app name, build availability, metadata, privacy answers, age rating, review notes, release mode and uploaded screenshots against this repository.
- Confirm build 3 is still selectable for version 1.0. The signed archive and local signing preflight are already present.
- Prove APNs delivery and deep-link opening on a physical TestFlight device.
- Enter the App Review account password in App Store Connect without storing it in source control.
- Confirm the privacy-policy URL is persisted in App Store Connect.
- Complete Digital Services Act trader/business details with the account owner's legal information.
- Gordy approves listing copy, screenshots, content rights and the fictional review account.
- Gordy approves the 6 August replacement screenshot set before it replaces the historical App Store Connect uploads.
- Retest MyFitnessPal after the observed Terra upstream timeout. Oura has completed a real TestFlight connection and recovery/readiness data pass.
- Complete the Google Calendar production OAuth contract after Google approves the request; Outlook needs its production contract test as well.
- Physical-device TestFlight covers password reset, keyboard, offline recovery, photos/camera, backgrounding, pause/freeze and account switching.
- TestFlight crash data and Xcode Organizer validation are reviewed before submission.
