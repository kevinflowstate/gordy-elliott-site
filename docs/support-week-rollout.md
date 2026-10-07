# Support fixes — week of 7 October 2026

This branch contains shared portal/server fixes and native workout changes. It does not mean the installed App Store binary has changed. Kevin's instruction is to bundle native changes into Friday 9 October's submission.

## Shared changes

- Coach nutrition logs show dated MyFitnessPal kcal/protein/carbs/fat independently of meal-plan ticks, with missing/zero/partial states and recorded plan target references. Historical target edits were not versioned; the UI says so.
- Nutrition query bounds, headers and columns use the same Monday–Sunday calendar dates.
- Recovery is unknown without sufficient actual sleep/heart signals. Nutrition/activity alone cannot create readiness. Displays, prompts, normalisation and scans use the same rule.
- SHIFT/coached, premium and VIP clients can read their own original coach reply history. New linked replies still open DMs. No old replies or notifications are replayed.
- Health-data consent stays visible and checked. Pending/error connections offer reconnect. Stale browser returns cannot cancel a newer attempt; server reconciliation requires verified provider/client identity and positive provider state.
- Manual dated integer steps replace, rather than add to, same-date synced totals. Blank restores synced totals; zero is valid. Coach loading includes the new field. The tracker uses UK coaching dates and resolves old completed sessions beyond its recent history slice.
- Mobile calendar defaults to a compact Month view with Agenda available and tappable dates. Desktop keeps the full month grid and recurrence behavior.

## Deployment order

1. Review the final commit and run the included release checks.
2. Apply only the two migrations in this branch to verified Supabase project `yeflmlcpqdfsfjlxofqy`:
   - `20261007140000_wearable_recovery_data.sql` allows unknown recovery and repairs unsupported derived recovery values while preserving raw nutrition/activity and original timestamps.
   - `20261007141000_manual_daily_steps.sql` adds a nullable, nonnegative manual total. Existing rows remain null. Existing RLS remains unchanged.
3. Record those exact versions in migration history; do not run unrelated pending migrations. Deploy shared code after schema readiness and verify the deployed Git revision.
4. Use permitted populated QA accounts for coach/client acceptance. Do not change real clients' logs, connect their provider accounts, or send alerts just to demonstrate a pass.

## Native Friday package

The long-prescription layout and EMOM result handling are updated. Current grouping, circuit timers and demo-video paths must be included in the new numbered build. The older 5 October Build 11 archive predates these edits and must not be reused as their release evidence.

An unsigned generic iOS simulator build succeeded on CodexDev, and 36 actual Swift model assertions passed. This establishes compilation/model behavior, not physical-device UX. See `native-workout-friday-validation.md` for grouped workouts, AMRAP/EMOM, long labels, videos, draft/background/offline preservation and reviewer-login checks. Increment and archive the final source, verify it on a device, and submit Friday, not earlier.

## Remaining evidence

- Physical push receipt is unconfirmed. Server-side checks and token registration do not prove receipt. No new alerts were sent in this batch.
- Leona's 7 October 08:28–08:29 UTC MyFitnessPal authorization outcome needs a Terra trace and provider-user state. Existing stored error and absence of persisted events do not prove its cause. Reconnect/callback changes address known product gaps but are not proof her provider login succeeds.
- Full Apple Health/HealthKit is separate scope; manual steps do not implement it.
- Not every exercise's video URL has been verified. Missing URLs remain a truthful empty state.
