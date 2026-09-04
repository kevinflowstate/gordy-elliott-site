# Orchestration: AT CAPACITY App Store readiness fixes

## Execution Rules

- Keep the original objective intact.
- Ask for approval before risky, expensive, external, or destructive actions.
- Keep immediate blocking work local.
- Delegate only bounded, disjoint, materially useful packets.
- Integrate packet results before final verification.

## Branching Rules

- If a local test exposes a regression, fix it before broad verification.
- If provider behavior cannot be proven, hide/defer that provider rather than advertise it as working.
- If the production schema already has the corrected grants, keep the idempotent migration for reproducibility.
- If any native source must change, increment the build and create a new TestFlight candidate; otherwise retain Build 10 only after exact-device verification.
- Stop before all external mutations for the approval gate; never cross the App Store submission gate.

## Packet Prompts

- P1 owns account deletion and shared security utilities.
- P2 owns client/reviewer copy, Home request gating, fixture validation and review documentation.
- P3 owns only the new migration and its migration-level regression test.
- Root owns integration, provider-state decisions, deployment sequencing and final verification.

## Completion Audit

- Every accepted change maps to a confirmed audit finding.
- Every unverified external finding has an exact check and owner.
- The final report distinguishes code-ready, production-ready, device-verified and submit-authorized states.
- `git status` is clean after the integrated commit and the source SHA is recorded.
