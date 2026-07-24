# AT CAPACITY — Fable orchestration record, 24 July 2026

Coordination record for the autonomous completion sprint. No credentials or
secret values belong in this file.

## Branch state

- Integration branch: `fable/at-capacity-founder-outcomes-2026-07-24`
  (created from detached HEAD at `fbcc549` = origin/main)
- `25dd152` — preservation commit: Google OAuth verification homepage,
  privacy and calendar copy (user work, already live in production).
- Baseline on branch: 27/27 release-contract tests passing.

## External gates (do not touch)

- Google Calendar: verification submitted 24 Jul 2026, under review.
  Credentials attached in Composio. Portal implementation complete. Real
  authenticated production contract test outstanding. Client onboarding
  gated on Google approval.
- Outlook: implemented; real production connection test outstanding.
- Terra: architecture built; awaiting Gordy's subscription + production
  credentials. No invented credentials, no weakened webhook verification.

## Worktrees and agent assignments

| Worktree | Branch | Agent | Scope | Status |
|---|---|---|---|---|
| `../gordy-wt-early-win` | `agent/early-win-2026-07-24` | Fable 5 impl | Phase 6 Fourteen-Day Early Win | INTEGRATED (`0321edb`) |
| `../gordy-wt-storm` | `agent/storm-warning-2026-07-24` | Fable 5 impl | Phase 8 Storm Warning rules engine | INTEGRATED (`4c35131`) |
| `../gordy-wt-docs` | `agent/release-docs-2026-07-24` | Fable 5 docs | Privacy inventory, DPIA, release docs | INTEGRATED (`d8b09a9`) |

Wave 2 (started after Wave 1 fully integrated at `a5df4cc`):

| Workspace | Branch | Agent | Scope | Status |
|---|---|---|---|---|
| `../gordy-wt-early-win` (reused) | `agent/founder-compliance-2026-07-24` | Fable 5 impl | Phase 5: compliance, Month 4 review, baseline override, configurable guarantee | INTEGRATED (`ac90ca4`) |
| canonical repo (read-only) | n/a | Fable 5 reviewer | Hostile security/data-isolation review of Wave 1 diff `fbcc549..a5df4cc` | COMPLETE (no P1/P2; 5 P3s fixed) |

Wave 3 (started at `774f644`):

| Workspace | Branch | Agent | Scope | Status |
|---|---|---|---|---|
| `../gordy-wt-storm` (reused) | `agent/release-qa-2026-07-24` | Fable 5 QA | Hostile release QA, scan-volume test, SHIFT sweep, a11y | INTEGRATED (`8f69548` + follow-ups `caf8911`) |
| `../gordy-wt-docs` (reused) | `agent/docs-delta-2026-07-24` | Fable 5 docs | DPIA/inventory delta for new tables | INTEGRATED (`8504cc2`) |

Wave 3 Fable-run checks: App Store metadata check PASSED (name 20/30,
subtitle 29/30, promo 129/170, keywords 82/100, iPhone-only). App Review
fixture check PASSED read-only against production (demo account complete:
2 sessions, 10 items, 4 meals, 3 tracker entries, 3 check-ins, 2 DMs);
Vercel env pulled temporarily and deleted after the check.

Docs-delta findings fixed by Fable at integration: privacy policy now
discloses coaching-administration records (call attendance, WhatsApp
support notes, review summaries, baseline-correction audit) - closes the
Article 13 transparency gap before Founder onboarding; unnecessary
authenticated grants dropped from the four admin-only tables (month4
reviews keep theirs - clients read own completed review); compliance
migration test now asserts no authenticated grants on admin-only tables.

Compliance integration notes (Fable): merge was conflict-free; Fable
genericized the portal capacity-baseline route's error responses for
P3-4 consistency and wired the 34 compliance tests into
`test:release-contracts` (now 114 tests). Deploy notes: migrations
`20260724120000` + `20260724121000` required at deploy, alongside the
earlier `20260724100000` (early win) and `20260724110000` (storm).

Wave 2 file boundaries: compliance agent owns new compliance/month4/
override/guarantee files + mounts in `app/admin/clients/[id]/page.tsx`;
may make only minimal localized touches to FounderDashboard/page.tsx.
Reviewer is strictly read-only. No other writers on the repo besides
Fable (checklist/orchestration only) until compliance lands.

Note: Kevin requested the strongest available model for subagents mid-run
(24 Jul). Original Opus 4.8 agents were stopped minutes in (no work lost,
worktrees clean) and respawned on Claude Fable 5. There is no "Opus 5";
Fable 5 is the Claude 5 family model above Opus 4.8.

## File ownership boundaries (Wave 1)

- Early Win agent: NEW files `lib/early-win*.ts`,
  `components/portal/EarlyWinCard.tsx`, `components/admin/EarlyWin*.tsx`,
  `app/api/portal/early-win/**`, `app/api/admin/client-early-win/**`, one
  migration, `tests/early-win*.test.ts`. Minimal insertions only in
  `app/portal/page.tsx`, `components/portal/FounderDashboard.tsx`,
  `app/admin/clients/[id]/page.tsx`. MUST NOT touch admin capacity scan,
  storm logic, checklist, or preserved marketing/privacy files.
- Storm Warning agent: NEW `lib/storm-warning.ts`, one migration,
  ack/dismiss API route, `tests/storm-warning*.test.ts`. Owns the storm
  section of `FounderDashboard.tsx` (replaces inline heuristic at ~line
  140-142/215-221), `app/api/admin/capacity-scan/route.ts`,
  `app/admin/capacity/page.tsx`. May add props through
  `app/portal/page.tsx`. MUST NOT touch early-win files, checklist, or
  preserved marketing/privacy files.
- Docs agent: writes only under `docs/` (new files or updates to
  `docs/app-privacy-inventory.md` etc.). No code edits. MUST NOT touch the
  implementation checklist (Fable-owned).
- Known accepted overlap: `FounderDashboard.tsx` and `app/portal/page.tsx`
  are touched by both implementation agents in different regions. Fable
  resolves at integration; Early Win integrates first.

## Commits awaiting review

(none yet)

## Commits integrated

- `25dd152` preservation commit (Fable, reviewed: coherent, no secrets).
- `7034fb7` docs workstream via merge `d8b09a9` (reviewed: docs-only,
  8 files, gates honestly labelled, spot-checked claims against code).
- `f11a8b2`+`825241a` storm workstream via merge `4c35131` (reviewed:
  engine, migration RLS, route gating, admin scan reuse; coach
  `calendar_events` are globally shared by design - matches existing
  `/api/calendar`; 33/33 + 27/27 re-run by Fable). Storm tests wired into
  `test:release-contracts` by Fable post-merge.
  DEPLOY NOTE: apply `20260724110000_add_storm_warnings.sql` before or
  with the code deploy - without it, portal storm GET 500s whenever a
  warning needs logging.
- `c26ea50` early-win workstream via merge `0321edb` (reviewed: lib,
  migration incl. immutability trigger and one-active index, portal
  gating, metric-to-column mapping verified against live schema usage;
  20/20 + contracts re-run by Fable; agent went idle without a handoff
  report - work was complete and verified directly from the worktree).
  FounderDashboard/page.tsx overlap with storm resolved by Fable; both
  features re-verified post-resolution. Early-win tests wired into
  `test:release-contracts` by Fable.
  DEPLOY NOTE: apply `20260724100000_add_early_win.sql` with the deploy.

## Docs-workstream findings (verified by Fable where noted)

- P2 Terra disconnect is local-only; a later provider webhook silently
  restores the connection (no "terra"/deauth call in the disconnect route
  - verified). Checklist item added under Phase 4.
- P2 privacy policy per-calendar wording vs `GOOGLECALENDAR_EVENTS_LIST_
  ALL_CALENDARS` (verified in lib/composio/client.ts). FIXED by Fable in
  app/privacy/page.tsx at integration.
- P2 no controller legal identity / ICO complaint wording in policy -
  NEEDS INPUT (legal identity). Checklist item added.
- P2 ASC record still named "SHIFT Coaching by Gordy"; listing predates
  calendar work. Checklist note added under Phase 1.
- P3 unbounded retention: synced calendar events + raw Terra payloads.
  Checklist item added.
- P3 consent wording predates connect screens; version bump needed.
  Folded into the Phase 9 consent item.
- NOTE client-facing portal AI runs claude-haiku-4-5 (verified in
  app/api/portal/ai/route.ts) - conflicts with Kevin's standing rule
  against Haiku for client-facing agents. Product decision for Kevin;
  surfaced in the final report.
- NOTE review-fixture tier decides whether Apple's reviewer can see the
  calendar connect screen (connect blocked for ai_only tier) - align
  review notes deliberately in Wave 3 App Store work.

## Verification results

- 24 Jul: `npm run test:release-contracts` 27/27 pass at `25dd152`.

## Architectural decisions

- Storm Warning becomes a pure deterministic rules engine in
  `lib/storm-warning.ts` operating on the existing `CalendarEvent` /
  normalised calendar model; explanation strings generated per rule;
  evaluations logged server-side; dismissals stored per client per warning
  window.
- Early Win is a new table + admin selection + portal card; no guessing of
  metric; retire-at-review preserved as history.
- Live Supabase DB is NOT touched by agents. Migrations are verified by
  contract tests and review only; applying them is a Fable/Kevin decision
  at deploy time.

## Wave 2 security review outcome (24 Jul)

Independent hostile review of `fbcc549..a5df4cc`: NO P1, NO P2. Five P3
hardening findings, all remediated by Fable and re-verified (80/80,
tsc clean, lint 0 errors):

- P3-1 prototype-chain hole in early-win metric allowlist - fixed
  `20a976c` (Object.hasOwn).
- P3-2 dismissals table had direct client INSERT/UPDATE grants allowing
  pre-silencing of arbitrary future windows - migration tightened to
  SELECT-only for clients (API-only writes via service role); migration
  contract test updated to assert the tightened posture.
- P3-3 client-influenceable audit-log growth - capped at 30 logged rows
  per client per window in the portal route.
- P3-4 raw Postgres error messages returned to portal clients - both
  client-facing routes now return generic messages and log detail
  server-side.
- P3-5 rolled-over calendar dates (e.g. 2026-02-30) accepted then 500ing
  - parseDateKey now round-trips and rejects with 400.
- Bonus: stale `lib/admin-auth.ts` docblock (claimed no-session requests
  allowed in preview; code correctly 401s) corrected.

Reviewer CLEAN list covered: RLS on both migrations (incl. mode-switch
bypass ruled out - clients hold no UPDATE policy on client_profiles),
authz on all new routes, cross-client isolation in the scan batch path,
idempotency keys, London/ISO-week boundary execution checks,
data-minimisation promises vs code, portal response field audits, merge
seams, no secrets. Not verifiable from repo: live DB grant state;
Supabase leaked-password-protection toggle (dashboard).

## Wave 3 outcome (24 Jul)

QA branch integrated at `8f69548`; Fable follow-ups at `caf8911`:
honest scan dismissal semantics (silenced vs re-raised), founder
unread-polling gate, preview-tag contrast, volume test wired in
(128 release-contract tests total). Biggest QA catch: push/PWA/native
icons still carried SHIFT/template artwork - all replaced with
hash-verified AT CAPACITY art; SW cache v10->v11 with legacy paths
serving correct art through rollover.

QA items accepted as notes (not fixed): sub-44px admin desktop targets;
`text-white/45` label idiom (borderline AA at 10px, consistent house
style); internal shift-* identifiers (zero client-visible SHIFT text);
`/support` routes technical help to kevin@flowstatesystems.ai - Kevin to
confirm intended.

NOT covered anywhere (external gates): authenticated browser QA for both
modes (needs a real test session/storage state), real-device iOS/APNs
delivery, browser-level scan with 20+ production rows, real Google and
Outlook production contract tests, Terra production, App Store
screenshots (need release build), ASC record re-entry/rename.

## Known latent issues (accepted for v1, do not lose)

- Immutability triggers vs ON DELETE SET NULL: deleting a `users` row
  referenced by `client_early_wins.reviewed_by` (or
  `client_capacity_baselines.locked_by`) fires a referential UPDATE that
  the completed/locked immutability trigger would reject. Not reachable
  today (no admin-deletion flow). If admin deletion ever becomes real,
  permit the SET NULL update in both triggers. Flagged by early-win
  agent, verified pattern applies to both tables.
- Early-win review completion is allowed before day 14 (outcome note
  required; admin panel copy warns it retires the card early). Deliberate
  flexibility for Gordy; add a server-side gate if he wants it strict.
- `sleep_score` deliberately excluded from sourced early-win metrics
  (empty house display unit vs unit NOT NULL check); one CHECK +
  catalogue entry to add if wanted later.

## Risks / blockers

- Gordy decisions outstanding: guarantee definition, Mode B name, WhatsApp
  number, booking link, call-token visibility.
- Google approval and Terra credentials are external gates.

## Lessons for subsequent agents

- Tests run with `npx tsx --test tests/<file>.test.ts` (node:test).
- Migration style: idempotent, RLS-first, CHECK constraints, follow
  `20260723123000_add_capacity_baselines.sql`.
- Design language: dark premium operator aesthetic, accent `#E667D6`,
  calm coaching-led copy, en-GB dates, no gamification, no emojis.
