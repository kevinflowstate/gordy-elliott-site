# App Store Release Audit

Date: 21 July 2026

Candidate: SHIFT Coaching 1.0 (Build 2)

Status: ready for controlled web deployment and candidate archive; not ready for final App Store submission

## Verified evidence

- Production Next.js build: passed, 122 routes.
- ESLint and strict TypeScript: passed.
- Release contract tests: 6 passed.
- Responsive authenticated portal QA: 56 route/viewport checks passed at 320, 390, 430 and 1440 pixels.
- App Store browser behavior gate: 68 assertions passed, including assigned nutrition-plan priority and client-facing Gordy DM identity.
- iPhone 17 Pro Max simulator build: succeeded with Xcode 26.3.
- Native launch and custom-scheme deep-link smoke tests: passed.
- App Review fixture: active adult fictional client with 2 training sessions, 10 prescribed exercises, 4 meals, tracker history, check-ins and two-way DM; cleanliness scan passed.
- Native push database: migration applied; RLS enabled; no `anon`/`authenticated` table access; authenticated register/read/remove API round trip passed.
- Dependency audit: zero known production vulnerabilities at the last release pass.
- App Store screenshots: six opaque `1284 x 2778` iPhone JPEGs generated from production, visually inspected and uploaded in the approved order.

## App Store Connect state

- Version 1.0 listing copy, keywords, categories and support details are saved.
- Review username, contact details and notes are restored in the live form; Apple will not save that section until the required review password is entered.
- Distribution is free, public and iPhone-only; Mac, Apple Vision Pro and education-volume availability are disabled.
- The age questionnaire is complete at 9+, and the app is declared not to be a regulated medical device.
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

- Add the Apple account back to Xcode, produce a signed archive and upload the candidate build.
- Create and securely install the APNs signing key, set the production APNs environment variables and prove delivery on a physical TestFlight device.
- Enter the App Review account password in App Store Connect without storing it in source control.
- Save the privacy-policy URL in App Store Connect; the current Apple form has not persisted the otherwise valid value.
- Complete Digital Services Act trader/business details with the account owner's legal information.
- Gordy approves listing copy, screenshots, content rights and the fictional review account.
- Terra production credentials and provider acceptance tests are complete if Connected Apps is advertised at launch.
- Physical-device TestFlight covers password reset, keyboard, offline recovery, photos/camera, backgrounding, pause/freeze and account switching.
- TestFlight crash data and Xcode Organizer validation are reviewed before submission.
