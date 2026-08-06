# App Store Release Audit

Date: 6 August 2026

Candidate: AT CAPACITY 1.0 (Build 5)

Verdict: **not ready to submit**. The code-controlled preparation is substantially complete, but exact-build Apple validation, reviewer access, physical-device QA and account-owner declarations remain open.

## Exact candidate

- Source branch: `codex/app-store-readiness-2026-08-06`.
- Local signed archive: `/Volumes/XCode/Storage-Quarantine-2026-07-15/AT-CAPACITY-Releases/AT-CAPACITY-1.0-5.xcarchive`.
- Bundle ID: `com.gordyelliott.shift`.
- Marketing/build version: `1.0 (5)`.
- Minimum iOS: 15.0.
- Device family: iPhone only.
- Production origin: `https://app.onlinegordy.com`.
- Apple team: `H4J3XX8R8M`.

Build 4 remains attached to version 1.0 in App Store Connect. Build 5 is processed and available to the `SHIFT Internal` TestFlight group, but is not attached to the App Store version. Version 1.0 remains in **Prepare for Submission**.

## Passed engineering evidence

- `npm run ios:preflight`: passed for the expected identity, production origin, team, version and build.
- `npm run ios:archive`: passed with Xcode 26.3. The archive is production signed.
- Xcode Organizer **Validate App**: passed all App Store Connect validation checks.
- App Store Connect upload: complete. Build 5 finished Apple processing, shows **Ready to Submit**, expires in 90 days and is available to the existing internal group.
- `codesign --verify --deep --strict`: passed.
- Archived entitlements: correct application identifier; `aps-environment = production`; `get-task-allow = false`; beta reports enabled.
- Archive contents: Capacitor and Cordova privacy manifests are present and valid; no unexpected embedded frameworks were found; the embedded public-shell hashes match the source shell.
- Release contract tests: 168/168 passed.
- Strict TypeScript: passed.
- ESLint: zero errors and 45 pre-existing application warnings.
- Production Next.js build: passed, 141 routes. The only framework warning is the existing Next.js middleware-convention deprecation.
- App Store metadata verifier: passed the name, subtitle, promotional text, keyword and iPhone-only checks.
- Public production App Store contract: 19 checks passed for privacy/support/auth boundaries, Google disclosures, security headers and unauthenticated native-push rejection.
- Supabase leaked-password protection is enabled. The live Supabase security advisor returned no findings after the change.
- Live App Store Connect draft: metadata, privacy answers, 16+ age override, manual release, six replacement screenshots and Build 4 were verified; **Add for Review** was not selected. The draft was rechecked after the Build 5 upload and still remains **Prepare for Submission** with Build 4 attached.

The complete authenticated production contract previously passed 85/85 on 6 August. It could not be independently rerun from the release shell during this pass because the temporary QA storage state/service-role environment was not present.

## Xcode and TestFlight status

The Apple account for team `H4J3XX8R8M` was restored in Xcode. Organizer validated Build 5 successfully, uploaded it to App Store Connect and recorded the archive status as **Uploaded**. App Store Connect completed processing at 16:18 BST on 6 August 2026. No validation or processing warning was shown.

Build 5 is in the existing internal TestFlight group only. Its TestFlight **What to Test** field contains the exact launch, workout, tracker, connected-health, native-return, APNs, photo, offline and accessibility focus for this candidate. It has not been added to the external `Gordy Preview` group, selected for the App Store version or added for App Review.

## Reviewer-access blocker

The fictional Demo Client user exists, but a production login using the credential currently saved in App Store Connect was rejected on 6 August. Do not put the password in source control.

Required resolution:

1. Reset the synthetic review account password in Supabase.
2. Prove a clean production sign-in using the new value.
3. Update only the App Store Connect review credential to the same value.
4. Re-run the reviewer walkthrough on exact TestFlight Build 5.

## Security and privacy scan

Passed:

- The native archive has production APNs and no debug entitlement.
- Authenticated portal/admin routes enforce server-side user/role checks. Founder-restricted routes and client APIs fail closed.
- Auth callbacks use a local-path redirect validator. Native deep links constrain schemes, host and route families.
- The Terra callback path verifies connection state before storing a connected account.
- The only `dangerouslySetInnerHTML` use found is a constant service-worker bootstrap string, not user-derived content.
- Browser storage findings are limited to UI preferences, workout-resume state, a handled deep-link marker and the native APNs device token; no password, Supabase session or OAuth token is explicitly written by application code.
- Production sends HTTPS/HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and `Referrer-Policy: strict-origin-when-cross-origin`.

Open hardening item:

- **SEC-CSP-001 — Medium, non-Apple-specific:** `next.config.ts` and the live production response do not send a Content Security Policy or Permissions Policy. No exploitable HTML injection path was established in this focused scan, so this is defense-in-depth rather than evidence of an active vulnerability. The smallest safe remediation is to introduce a report-only CSP, inventory required Next.js/Supabase/Terra/Composio origins, then enforce a nonce-based policy after violation-free QA. Do not add `unsafe-eval` or a broad wildcard policy merely to make the build pass.

Dependency note:

- `npm audit --omit=dev --audit-level=high` exits successfully because there are no high/critical findings. It currently reports two moderate PostCSS findings through Next.js. The suggested forced remediation moves Next outside the declared range, so it must be handled as a separately tested framework update rather than an audit-force change immediately before submission.

## Guideline 4.2 assessment

The app has genuine native behaviour: production APNs registration/deep-link routing, haptics, native status/splash treatment, camera/photo permission paths, secure external OAuth browser hand-off and return, safe native deep links and offline recovery. The client also includes materially interactive coaching workflows rather than a brochure website.

Residual risk remains significant because the core signed app loads the hosted portal and most product UI/business logic is shared with the web/PWA. This is not proven safe against Apple's “repackaged website” interpretation. Complete the exact reviewer walkthrough and preserve evidence of the native behaviours in `docs/app-store-reviewer-walkthrough.md`; if a stronger mitigation is required, the smallest product-level addition is a clearly native, client-useful surface rather than more reviewer-note copy.

## App Store Connect and external gates

- Digital Services Act status is incomplete. Trader/non-trader status and any displayed contact details require the account owner's legal decision.
- App Accessibility declarations are unconfigured. Publish only after the evidence matrix in `docs/app-store-accessibility.md` is completed on physical devices.
- Google Calendar OAuth verification remains under review. Either complete the production Google contract before submission or remove/disable the Google launch claim and show an honest unavailable state.
- Outlook needs its production connect/sync/disconnect/native-return contract.
- MyFitnessPal needs a successful retest after the observed Terra upstream login timeout.
- Oura has completed a real TestFlight connection and returned recovery/readiness data.
- Gordy must approve listing copy, content rights, screenshots and the fictional review fixture.

## Exact remaining pre-submission sequence

1. Restore and verify the fictional review credential, then update App Store Connect.
2. Install exact Build 5 from the `SHIFT Internal` TestFlight group.
3. Run `docs/testflight-checklist.md` and `docs/app-store-reviewer-walkthrough.md` on a small and a current large iPhone.
4. Prove APNs delivery/deep-link opening, password reset/native return, backgrounding, offline recovery, photo permissions and account separation.
5. Retest MyFitnessPal and decide the Google/Outlook launch state.
6. Complete the accessibility evidence matrix and publish only declarations that passed.
7. Complete the DSA legal declaration with the account owner.
8. Review TestFlight crash data and the final App Store metadata/build attachment.
9. Stop with version 1.0 still in **Prepare for Submission** until Kevin gives separate submission authorization.
