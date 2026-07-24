# AT CAPACITY Implementation Checklist

Last updated: 24 July 2026

## Objective

Reposition the existing coaching platform as AT CAPACITY and add a Founder
Dashboard experience for programme clients without rebuilding the existing
portal, AI brain, content library, tracking, or client data.

Target:

- Founding Five pilot: 5 working days
- Complete, tested v1: 8 to 12 working days
- Apple Health through the native Terra SDK: follow-up phase, not a v1 blocker

## Status Key

- `[ ]` Not started
- `[x]` Complete and verified
- Add `(blocked: reason)` when an external decision or credential is required

## Decisions Needed From Gordy

- [ ] Define what measurable change satisfies the Month 4 guarantee.
- [x] Treat the bar as system load: a fuller bar means more pressure. Gordy can
      still request a wording or direction change before pilot.
- [ ] Confirm the final client-facing name for the lower-tier Mode B offer.
- [ ] Supply the WhatsApp number used by Founder clients.
- [ ] Supply the booking link used for private strategy calls.
- [ ] Confirm whether call tokens are a visible balance or simply an internal
      attendance allowance.
- [ ] Sign off the DPIA (`docs/at-capacity-dpia.md`) - Gordy/Kevin.
- [ ] Compile the processor due-diligence record (DPAs, AI training-disabled
      terms, transfer mechanisms) - Kevin.
- [ ] Supply the controller legal identity and complaint-contact details for
      the privacy policy (UK GDPR: controller name and ICO complaint right).

## Existing Foundations

- [x] Terra connection, webhook, event, and normalized-summary architecture.
- [x] Wearable readiness score and recovery flags.
- [x] Client-side Connected Apps and synced Daily Tracker data.
- [x] Coach-side per-client wearable summary.
- [x] Daily metrics, body measurements, training, nutrition, and check-ins.
- [x] Manual calendar events and dashboard next-event tile.
- [x] Client tasks and Gordy-assigned priorities.
- [x] Admin red, amber, and green attention logic.
- [x] Per-client monitoring controls and ignored/snoozed signals.
- [x] Cycle tracking for eligible female accounts.
- [x] Coaching-note ingestion for calls, Zoom, Loom, Fathom, WhatsApp, email,
      and voice-note transcripts.
- [x] Native iOS shell and App Store Connect groundwork.

## Phase 1: Identity And Modes

Estimated effort: 0.5 to 1.5 days

- [x] Replace client-facing SHIFT naming with AT CAPACITY.
- [x] Update wordmark treatment: pink `AT`, white or black `CAPACITY`.
- [x] Update PWA manifest, browser metadata, native display name, splash, and
      app icon.
- [ ] Update App Store name, description, review notes, and screenshots.
      Metadata and review documents are updated; new screenshots require the
      release build. The App Store Connect record is still named "SHIFT
      Coaching by Gordy" and its saved listing, review notes and App
      Privacy answers predate the calendar work - re-enter from the updated
      docs and rename before submission.
- [x] Inventory AI prompts, emails, notifications, and seeded copy for stale
      SHIFT references.
- [x] Add `experience_mode` with `founder_dashboard` and `ai_coaching`.
- [x] Default all existing clients to `ai_coaching`.
- [x] Add mode selection to client invitation and onboarding.
- [x] Add mode editing to Gordy's client profile controls.
- [x] Enforce mode gates in server routes as well as navigation.
- [x] Hide client-facing DM and AI surfaces for Founder clients.
- [ ] Add WhatsApp and strategy-call actions for Founder clients. (blocked:
      Gordy's WhatsApp number and booking link)

Acceptance:

- [x] Existing clients retain their current experience and data.
- [x] Founder clients cannot reach hidden DM or AI routes directly.
- [x] Gordy can change a client's mode without recreating the account.

## Phase 2: Founder Dashboard

Estimated effort: 1.5 to 2.5 days

- [x] Make the connected calendar and shape of today the first dashboard block.
- [x] Show the next meeting and a plain-English day summary.
- [x] Add the daily capacity or load bar using the existing wearable summary.
- [x] Replace fitness-app language with operator language.
- [x] Show today's training and Gordy's non-negotiables.
- [x] Add quick actions for nutrition, training, and energy/mood tracking.
- [x] Add a compact seven-day calendar-density strip.
- [x] Handle missing calendar, wearable, training, and task data gracefully.
- [x] Keep the screen fast and readable on current iPhone sizes.

Acceptance:

- [x] A Founder client can understand today within five seconds.
- [x] Primary actions require no more than one tap from the dashboard.
- [x] The dashboard remains useful before calendar or wearable connection.

## Phase 3: Composio Calendar Connections

Estimated effort: 1 to 2 days

- [x] Add Composio environment configuration and server client.
- [x] Add a client-to-Composio connected-account mapping.
- [x] Add Connect Google Calendar. Custom Google OAuth credentials
      (project `at-capacity-503314`) are attached to the Composio auth
      configuration. Portal implementation is complete.
- [x] Add Connect Outlook Calendar.
- [x] Restrict integrations to read-only calendar actions.
- [x] Normalize Google and Outlook events into one internal shape.
- [x] Pull the current day and next seven days.
- [x] Store only the minimum calendar information needed by the dashboard.
- [x] Add connection status, last sync, reconnect, and disconnect controls.
- [x] Add daily refresh and manual sync handling for changed events.
- [x] Mirror calendar connection and density on Gordy's client view.

Acceptance:

- [x] Client A cannot access Client B's calendar data.
- [x] Disconnecting removes future calendar access.
- [x] Google and Outlook produce the same dashboard model.
- [x] Calendar errors do not block the rest of the portal.

Status: Outlook is implemented and ready for a real production connection
test. Google Calendar credentials are attached to the Composio auth
configuration and the portal implementation is complete. Google branding and
Calendar data-access verification were submitted on 24 July 2026 and are
under review (initial Trust & Safety contact expected in roughly 3-5 business
days; full verification may take 4-6 weeks). Calendar scopes are sensitive,
not restricted. Test users can connect during review; normal client
onboarding remains externally gated by Google approval. A real authenticated
production contract test for both Google and Outlook remains outstanding.
Do not treat Google approval as complete.

## Phase 4: Terra Production

Estimated effort after credentials: 0.5 to 1 day

- [ ] Add Terra production credentials and webhook signing secret. (blocked:
      Terra subscription and production credentials)
- [ ] Enable and verify the agreed launch providers.
- [ ] Test real Garmin, Oura, WHOOP, Fitbit, and nutrition payloads as
      available.
- [ ] Confirm provider-specific null and partial-data behaviour.
- [ ] Remove all preview/mock messaging from production.
- [ ] Confirm daily summaries update capacity and coach-side flags.
- [ ] Confirm cycle data continues to use the existing tracker unless a
      supported Terra source is explicitly verified.
- [ ] Deauthenticate the provider with Terra on wearable disconnect so a
      later provider webhook cannot silently restore the connection and
      resume storing summaries. Implementation can precede credentials;
      real verification blocked: Terra credentials.

Acceptance:

- [ ] Replayed webhooks remain idempotent.
- [ ] Missing provider metrics do not create misleading scores.
- [ ] Wearable data informs suggestions but never edits a programme
      automatically.

## Phase 5: Baseline And Guarantee

Estimated effort: 2 to 3 days

- [x] Add a Month 1 baseline record per Founder client.
- [x] Calculate HRV, resting heart rate, and sleep from a defined baseline
      window.
- [x] Add manually entered body-composition baseline values.
- [ ] Lock the baseline with an audit timestamp and Gordy override reason.
      Locking and the audit timestamp are complete; an explicit override flow
      remains outstanding.
- [x] Add client-side Baseline vs Now.
- [x] Add coach-side Baseline vs Now.
- [ ] Show the same comparison in the Month 4 review.
- [ ] Add configurable guarantee thresholds after Gordy's definition is
      confirmed. (blocked: exact guarantee definition)
- [ ] Add call-attendance records.
- [ ] Use existing check-in records for check-in compliance.
- [ ] Add a simple weekly WhatsApp-help record for Gordy.
- [ ] Add a compliance summary without turning it into a gamified score.

Acceptance:

- [x] Baselines cannot silently change after locking.
- [x] Missing wearable days are shown as missing, not zero.
- [x] Baseline comparisons show their source period and comparison period.

## Phase 6: Fourteen-Day Early Win

Estimated effort: 0.5 day

- [x] Let Gordy select one priority metric after the Capacity X-Ray.
      Admin panel on the client profile (Founder clients): sourced metrics
      (HRV, resting HR, sleep from wearables; weight, waist from body
      measurements) or a fully manual metric with Gordy-defined label,
      unit and logged values.
- [x] Store the starting value, target, start date, and optional note.
      `client_early_wins` with metric/source consistency CHECKs, one
      active win per client (partial unique index), and completed rows
      made immutable by trigger.
- [x] Show the metric prominently for the first 14 days. Card sits
      directly under Today's capacity on the Founder Dashboard; honest
      states for missing and stale readings (a missing value is never
      shown as zero; readings 3+ days old are marked stale).
- [x] Show progress to Gordy on the client profile. Day counter, latest
      reading with date, progress toward target with
      direction-of-improvement handling, review-due prompt from day 14.
- [x] Keep the card useful when the metric is manually tracked. Manual
      value log (`client_early_win_entries`) written by Gordy; latest
      entry drives the card.

Acceptance:

- [x] The app never guesses the client's early-win metric. The card and
      portal endpoint return nothing until Gordy explicitly creates a win.
- [x] The card retires cleanly after the 14-day review. Completing the
      review (with outcome note) sets status `completed`; the client card
      disappears, history stays queryable and visible to Gordy, and RLS
      only ever exposes the active win to the client. NOTE: migration
      `20260724100000_add_early_win.sql` must be applied at deploy.

## Phase 7: Gordy's Capacity Scan

Estimated effort: 1 to 1.5 days

- [x] Add a Founder-client scan view to the admin dashboard.
- [x] Show capacity status, sleep, HRV, training, nutrition, mood, calendar
      density, and last sync.
- [x] Add red and amber explanations, not colour alone.
- [x] Reuse existing ignored and snoozed monitoring controls.
- [x] Add filters for Founder clients, red, amber, disconnected, and missing
      data.
- [x] Link each row directly to the client's detailed view.

Acceptance:

- [ ] Gordy can scan 20 or more clients without opening each profile. The
      single-list UI is built; production-volume acceptance testing remains.
- [x] Every alert states why it exists.
- [x] Paused and frozen clients follow existing notification rules.

## Phase 8: Storm Warning

Estimated effort: 0.5 to 1 day for deterministic v1

- [x] Define initial density rules for meeting count, consecutive busy days,
      early starts, travel, and insufficient gaps. Deterministic engine in
      `lib/storm-warning.ts`; all thresholds in one `STORM_THRESHOLDS`
      block. Travel uses only the client-set `travel` category (structured
      data); synced events carry no travel inference and titles are never
      keyword-sniffed. Gap checks run only where the connected calendar
      provides start and end times; manual events lack end times, and the
      rule skips honestly (with an explanation) rather than guessing.
- [x] Compare current density with the client's recent calendar pattern where
      enough history exists. Requires 14 distinct stored-event days in the
      trailing 28; below that the rule is skipped and the copy says the
      warning is based on the week's calendar alone.
- [x] Show a client-side warning with restrained language.
- [x] Show the same warning in Gordy's Capacity Scan. Same engine, same
      explanations; dismissed warnings stay visible to Gordy with a
      "Dismissed by client" marker. Paused clients are still evaluated and
      logged (their scan status remains paused) - deliberate, so pressure
      building during a pause is not lost.
- [x] Do not alter training or nutrition automatically.
- [x] Log the rule and inputs that generated each warning. Idempotent audit
      log (`client_storm_warnings`, unique on client/window/input-hash);
      snapshots hold counts and times only - no titles, descriptions or
      attendees. NOTE: migration `20260724110000_add_storm_warnings.sql`
      must be applied at deploy; until then a portal evaluation that finds
      a warning cannot record its audit row.

Acceptance:

- [x] Warnings are explainable and dismissible. Per-rule client-readable
      explanations with actual numbers; dismissal is per ISO-week window
      and severity, re-raised on a new week or amber-to-red escalation.
- [x] Sparse calendar data does not generate false certainty. Skipped rules
      say why; 33 engine/migration tests cover boundaries, DST, recurrence
      and dismissal windowing.
- [x] No meeting descriptions or attendees are exposed to AI unnecessarily.
      None are stored, none are sent to AI; the engine and logs never touch
      titles.

## Phase 9: Release Verification

Estimated effort: 1 to 2 days

- [x] Run lint, TypeScript, production build, contract, and migration checks.
- [ ] Run authenticated mobile release verification for both modes.
- [x] Verify Founder routes cannot be reached by Mode B and vice versa where
      applicable.
- [ ] Test calendar and wearable disconnect/reconnect flows.
- [x] Test missing and stale wearable data.
- [x] Test baseline locking and comparison calculations. Guarantee thresholds
      remain blocked by the commercial definition.
- [x] Test dashboard layout at 390x844 and 1440x1000.
- [ ] Update privacy inventory and client consent language. The privacy
      inventory rewrite is complete (`docs/app-privacy-inventory.md`,
      24 July 2026). Consent language at the calendar and wearable
      connection points, plus a consent-version bump, remains outstanding.
- [ ] Complete a health and calendar data DPIA. Drafted 24 July 2026
      (`docs/at-capacity-dpia.md`); awaiting Gordy/Kevin sign-off.
- [ ] Add controller legal identity and ICO complaint-right wording to the
      privacy policy. (blocked: controller legal identity from Gordy/Kevin)
- [ ] Agree and implement bounded retention for synced calendar-event
      history and raw Terra webhook payloads (currently unbounded; storm
      pattern comparison needs only the trailing 28 days).
- [ ] Regenerate App Store screenshots.
- [ ] Upload a new TestFlight build if native identity or capabilities change.
- [ ] Complete Gordy and Founding Five acceptance testing.
- [ ] Deploy only after all release gates pass.

## Explicitly Out Of Scope For V1

- [ ] Apple Health through the Terra Mobile SDK.
- [ ] Android Health Connect.
- [ ] Automatic WhatsApp conversation ingestion.
- [ ] Full Calendly or booking-platform synchronization.
- [ ] Automatic programme or nutrition changes.
- [ ] Machine-learning storm prediction.
- [ ] Kahunas or Skool history migration.

## Progress Log

Add dated entries here as work is completed:

- 23 July 2026: Brief assessed against current production repository. Existing
  foundations confirmed and implementation checklist created.
- 23 July 2026: Built the AT CAPACITY identity, two explicit client experience
  modes, server-side Founder AI/DM gates, invite and admin mode controls,
  Founder Dashboard, Capacity Scan, Month 1 baseline capture and comparison,
  app icon, splash artwork, and regression tests in a clean external worktree.
- 23 July 2026: Structured review found thirteen deployment blockers across
  three passes. All were repaired, including account deletion with locked baselines,
  draft RLS, exact-value locking, stale wearables, calendar timestamps,
  timezone boundaries, scan query failures, body-measurement bounds,
  incompatible mode/tier combinations, nullable legacy dates, London/UTC
  boundaries, and hidden-thread unread counts.
- 23 July 2026: Verified 27 release-contract tests, lint with zero errors,
  production TypeScript/build across 126 routes, and responsive browser QA
  with no horizontal overflow or console errors.
- 23 July 2026: Capacity Scan follow-up hardened stale/future data handling,
  recurring calendar expansion, scheduled lifecycle resumptions, monitoring
  suppressions, red/amber/disconnected filters, and biweekly DST/weekday
  behaviour. Mobile and desktop scan layouts were verified with filter
  interaction.
- 23 July 2026: Upgraded Next.js and its lint configuration to 16.2.11 and
  pinned Sharp 0.35.3. The production dependency audit now reports zero known
  vulnerabilities.
- 23 July 2026: App Store metadata and iOS release preflight passed for
  AT CAPACITY 1.0 (2), bundle `com.gordyelliott.shift`, using Xcode 26.3.
- 24 July 2026: Preserved the Google OAuth verification work (AT CAPACITY
  public homepage repositioning, Google site-verification metadata, calendar
  privacy disclosures with Limited Use wording, Composio processor
  disclosure) as commit `25dd152` on integration branch
  `fable/at-capacity-founder-outcomes-2026-07-24`. These changes were already
  live in production. Baseline verification on the branch: 27/27
  release-contract tests passing. Google branding and Calendar data-access
  verification submitted 24 July 2026 and now under Google review.
- 24 July 2026: Privacy and release documentation workstream integrated:
  privacy inventory rewritten and grounded in code, UK GDPR DPIA drafted
  (`docs/at-capacity-dpia.md`, awaiting sign-off), v1 release documentation
  added, App Store worksheets made calendar-aware, historical SHIFT
  references labelled. Privacy policy calendar wording corrected to state
  that events are read from the calendars in the connected account (there
  is no per-calendar selection). Follow-ups recorded: Terra deauth on
  disconnect, connection-point consent language, controller identity/ICO
  wording, bounded retention windows, ASC record re-entry and rename.
- 24 July 2026: Phase 8 Storm Warning completed and integrated: pure
  deterministic rules engine (density, consecutive busy days, early
  starts, insufficient gaps, client-marked travel, recent-pattern
  comparison gated on 14-of-28-days history), founder-gated portal route
  with server-validated dismissals, idempotent audit logging, and the same
  engine and explanations in Gordy's Capacity Scan. Verification re-run at
  integration: 33/33 storm tests, 27/27 release contracts, lint zero
  errors, tsc clean, production build compiled. Storm tests wired into
  `test:release-contracts`. A pre-existing fixture type error in
  `tests/founder-dashboard.test.ts` (invalid `updated_at` property) was
  fixed in passing.
- 24 July 2026: Phase 6 Fourteen-Day Early Win completed and integrated:
  admin metric selection (wearable-sourced, body-measurement-sourced or
  fully manual), one active win per client enforced in the schema,
  prominent Founder Dashboard card with honest missing/stale states,
  day-14 review flow that retires the card while preserving immutable
  history, founder-gated portal endpoint, RLS exposing only the active
  win to clients. Verification at integration: 20/20 early-win tests,
  60/60 release contracts, tsc clean. Early-win tests wired into
  `test:release-contracts`. The planned FounderDashboard overlap with the
  storm workstream was merged by hand and re-verified.
