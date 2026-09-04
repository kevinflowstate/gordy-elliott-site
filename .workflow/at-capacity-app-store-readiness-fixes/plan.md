# AT CAPACITY App Store readiness fixes

## Goal

Make the audited AT CAPACITY candidate at `6dac98a` genuinely ready for App Store submission without submitting it for review.

## Success Criteria

- Confirmed code/security blockers are fixed with regression coverage.
- Review notes and fixture checks describe only demonstrable reviewer journeys.
- A forward-only migration explicitly removes AI-usage RPC execution from `anon` and `authenticated`.
- Relevant tests, typecheck, lint, production build, iOS sync/preflight and release compile pass in the isolated worktree.
- Production/provider/device/App Store checks are completed or recorded as explicit gates with no overclaiming.
- No App Store submission occurs without Kevin's separate authorization.

## Current Context

- Audited source: `6dac98a2d5e0e284f202b195640f4b499ceff574`.
- Isolated branch: `codex/app-store-readiness-fixes-2026-09-04`.
- Isolated worktree: `/Users/kevinharkin/Codex-Worktrees/gordy-app-store-readiness`.
- The ordinary local `main` checkout is dirty and belongs to a divergent older history; it is out of scope.

## Constraints

- Preserve unrelated worktrees and user changes.
- Use forward-only migrations; never rewrite an applied migration.
- Do not expose credentials or include secrets in artifacts.
- Do not deploy, apply migrations, mutate the review fixture or change external services until the local fix set is integrated and an explicit external-action gate is reached.
- Do not submit the app for review.

## Risks

- Account deletion spans database, storage and third-party revocation and must fail safely.
- Fixture/provider state is production data and can decay after verification.
- The iOS binary loads the hosted portal, so any post-walkthrough web deployment invalidates the release freeze.
- WHOOP/MyFitnessPal/Oura/Google/Outlook readiness depends on external providers and physical-device testing.

## Approval Required

- Kevin has authorized local implementation and verification.
- Separate confirmation is required immediately before production deployment, migration application, fixture mutation or provider configuration.
- App Store submission remains explicitly prohibited until separately authorized.

## Work Packets

1. `security-backend`: complete deletion, fail-closed inbox lookup, redirect hardening and site-URL normalization.
2. `reviewer-experience`: remove TestFlight copy, gate weekly-capacity fetches, strengthen the fixture checker and make review notes evidence-only.
3. `database-grants`: add and test a forward migration revoking AI-usage RPC execution from browser roles.
4. `integration-verification`: reconcile changes, run full release checks and prepare production/device/ASC gates.

## Integration Policy

- Each packet owns disjoint files and may add narrowly named tests.
- Do not revert or overwrite concurrent changes.
- Root reviews every diff and resolves conflicts against the audited findings and actual source.
- Provider claims remain unverified until a real account produces current data on the exact TestFlight candidate.

## Verification

- Targeted tests for every changed behavior.
- Release-contract suite, TypeScript, lint and production Next build.
- iOS sync/preflight and unsigned Release compile in the isolated worktree only.
- Browser reviewer simulation against a safe local/preview target before any production action.
- Post-deployment physical-device checklist and App Store Connect review remain explicit final gates.

## Reusable Artifacts

- Workflow plan and final readiness report under this directory.
- Migration and regression tests committed with the implementation.
