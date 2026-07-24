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
| `../gordy-wt-early-win` | `agent/early-win-2026-07-24` | Fable 5 impl | Phase 6 Fourteen-Day Early Win | running |
| `../gordy-wt-storm` | `agent/storm-warning-2026-07-24` | Fable 5 impl | Phase 8 Storm Warning rules engine | running |
| `../gordy-wt-docs` | `agent/release-docs-2026-07-24` | Fable 5 docs | Privacy inventory, DPIA, release docs | running |

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
