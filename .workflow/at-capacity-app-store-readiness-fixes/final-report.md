# Final Report: AT CAPACITY App Store readiness fixes

## Outcome

The code-level App Store readiness repairs are complete and locally verified. The candidate is not yet submission-ready because the production migration/deployment, reviewer fixture refresh, provider acceptance checks, exact-device TestFlight walkthrough and App Store Connect declarations remain external gates.

## Accepted Results

- Account deletion now attempts Terra and Composio revocation before deleting the account, fails safely when revocation cannot be confirmed, and removes SHIFT Community media.
- Client inbox lookup fails closed when no client profile can be resolved.
- Local redirect and canonical site URL handling reject unsafe or malformed destinations.
- Browser roles are explicitly denied execution of the two AI-usage mutation RPCs through a forward-only migration.
- The review fixture checker now requires the CAPACITY programme, active onboarding and no pending/error wearable rows; its guarded refresh prepares those fixture fields without removing healthy connections.
- Reviewer copy no longer mentions TestFlight or unverified provider outcomes.
- The unused wearable roadmap is hidden instead of advertising unfinished providers.
- Weekly-capacity traffic is only requested for Founder experiences.
- Privacy copy now identifies the data controller, lawful bases, health-data consent, ICO complaint right and Apple push processing.
- iOS archives cannot silently overwrite an existing build and receive a Git source receipt.
- Launch guidance now records the hosted-portal freeze, source SHA, deployment identity and web/binary rollback distinction.

## Rejected Results

- No App Store submission was attempted.
- No production migration, deployment, reviewer-fixture mutation or provider configuration was performed during the local phase.
- No new native build was created because the native source did not change.

## Conflicts Resolved

- The original dirty/divergent local `main` checkout was preserved. All work was based on audited production tree `6dac98a` in an isolated worktree.
- Reviewer notes were reduced to demonstrable behaviour; provider caveats remain internal gates rather than App Review copy.

## Verification Evidence

- 43/43 focused regression tests passed.
- 240/240 release-contract tests passed.
- `npx tsc --noEmit` passed.
- ESLint passed with zero errors and 41 warnings, identical to the audited baseline warning count.
- `npm run build` passed and generated 155 routes.
- `npm run ios:sync`, `npm run ios:preflight` and an unsigned generic iOS Release build passed.
- App Store metadata and SHIFT AI input checks passed.
- The read-only production reviewer simulation passed 80/80 assertions across workout, calendar, DM, tracker, nutrition, consultation, AI, settings, privacy and security-header surfaces.
- Connected-app visual QA passed at 390x844, 430x932 and 1440x1000 with enabled WHOOP visible and disabled roadmap providers hidden.
- Nutrition visual QA passed at 390x844 and 1440x1000; strength visual QA passed at 320, 390, 430 and 1440px, including empty and error states.
- A broad production sweep passed every non-Home route. The old deployment's Home made the known forbidden weekly-capacity request; the fixed local build then passed Home at 320, 390, 430 and 1440px with no failed request or overflow.
- `git diff --check` passed.

## Remaining Risks

- Apply and verify the RPC grant migration in production.
- Deploy the committed tree from `main`, record the deployment ID/SHA and begin the hosted-portal change freeze.
- Refresh the marked fictional App Review account, then run its read-only readiness checker to zero failures.
- WHOOP, Oura, Google Calendar and Outlook Calendar all had fresh 4 September production data in the read-only check. MyFitnessPal's connection refreshed on 4 September, but its latest delivered payloads and normalised summary remained dated 27 August; current-day MyFitnessPal ingestion still requires an exact-device/provider acceptance test.
- Verify WHOOP/Oura/Google/Outlook native returns and APNs on the exact TestFlight build even though their server-side production freshness is now evidenced.
- Complete the physical-device reviewer walkthrough, including workout persistence/offline recovery, DM voice/photo, permissions, keyboard, safe areas, splash, deep links and account deletion.
- Confirm App Store Connect privacy/accessibility/DSA declarations, review notes, selected build, manual release, crash feedback and Gordy's product approval.
- Record Gordy's controller/DPIA sign-off and retained processor due-diligence evidence.

## Reusable Follow-up

Use `scripts/check-app-review-fixture.mjs` immediately before submission and after any fixture-affecting change. Use `PORTAL_QA_READ_ONLY=true` with `scripts/verify-app-store-release.mjs` for non-mutating production reviewer simulation. Treat any portal deployment after the device walkthrough as invalidating the recorded freeze and repeat the affected checks.
