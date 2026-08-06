# AT CAPACITY - Release Documentation (v1)

Prepared 24 July 2026 and updated 6 August 2026 from the code on this branch, the implementation checklist and the App Store worksheets. This is the release-readiness summary; the canonical detail lives in the linked documents.

## 1. What v1 ships

One coaching product across web, PWA and a Capacitor iOS shell (`com.gordyelliott.shift`, production host https://app.onlinegordy.com), sign-in only, with two client experiences enforced in server routes as well as navigation:

- Founder Dashboard (higher tier): calendar-first daily view with next meeting and day summary, capacity/load bar from the wearable summary, today's training and non-negotiables, quick actions, seven-day calendar-density strip. Client-facing DM and AI surfaces are hidden and route-gated. Contact with Gordy is over WhatsApp and booked strategy calls (both awaiting Gordy's details).
- AI Coaching (lower tier, final client-facing name pending): the existing portal - training, nutrition, daily tracker, check-ins, DM with Gordy, AT CAPACITY AI assistant, optional cycle tracking for eligible clients.

Shared foundations shipping in v1: Month 1 baseline capture with locking, an audited service-role-only override flow (written reason required, prior values preserved immutably) and Baseline vs Now comparison, Gordy's Capacity Scan admin view with explained red/amber states, coaching-note ingestion, account deletion, push-notification groundwork, and the calendar and wearable integration architecture described below.

Also built as of 24 July 2026 (merged the same day, covered by an independent security review of the full diff that found no P1/P2 issues, with five P3 hardening items remediated same-day):

- Fourteen-day early win: an admin-set priority metric per Founder client (wearable, body-measurement or manual) with dated entries and an immutable completed review history.
- Storm Warning: deterministic calendar-pressure warnings with a capped, deduplicated audit log (rule IDs, per-day meeting counts and times only - no event content) and server-validated client dismissals.
- Founder compliance and Month 4: call-attendance records, weekly WhatsApp-help records (metadata only, admin-only), frozen immutable Month 4 review snapshots visible to the client once completed, and programme-level guarantee configuration that evaluates nothing until Gordy defines the thresholds.

Built with production credentials: Terra wearable connections. Oura completed a real TestFlight connection and readiness/recovery ingestion pass; MyFitnessPal still needs a successful retest after an upstream Terra timeout. Google and Outlook calendar connections via Composio remain gated by the provider contract tests, and Google additionally remains under verification review.

Still open (per the implementation checklist): guarantee threshold values themselves (blocked on Gordy's commercial definition - the configuration ships empty and shows clients nothing until set).

Explicitly out of scope for v1: Apple Health/HealthKit, Android Health Connect, WhatsApp auto-ingestion, Calendly sync, automatic programme changes, ML storm prediction, Kahunas/Skool migration.

## 2. External gates

| Gate | Status (6 August 2026) | What it blocks |
| --- | --- | --- |
| Google branding + Calendar data-access verification (project `at-capacity-503314`) | Submitted 24 July 2026, UNDER REVIEW. Initial Trust & Safety contact expected in roughly 3-5 business days; full verification may take 4-6 weeks. Scopes are sensitive, not restricted. Do not describe approval as complete. | Normal client Google Calendar connections. Test users can connect during review. |
| Real production calendar contract tests | Outstanding for both Google and Outlook. Outlook is implemented and ready to test; it does not depend on the Google review. | Advertising calendar connections; Founder pilot calendar onboarding. |
| Terra production acceptance | Credentials are configured and Oura passed a real TestFlight connection/data run. MyFitnessPal hit an upstream login timeout and needs a successful retest; disconnect/revocation evidence remains required. | Advertising MyFitnessPal support and closing the provider acceptance record. |
| Apple exact-candidate gates | Build 5 passed Organizer validation, uploaded and completed processing in the internal TestFlight group. The saved review credential is rejected, and physical TestFlight/accessibility/APNs/DSA checks remain. See `docs/app-store-release-audit.md`. | Final App Store submission. |
| Supabase leaked-password protection | Enabled; live security advisor clear on 6 August 2026 | Complete. |

## 3. Privacy and consent position

- Live policy: `/privacy` (code: `app/privacy/page.tsx`, effective 27 July 2026). It discloses calendar connections with Google Limited Use wording, names Composio as the calendar processor, describes the "Busy" masking and no-descriptions/no-attendees position, states that Google reads all calendars on the connected account, discloses coaching-administration records, and states that disconnecting a calendar deletes the synced copies. The code matches these claims (`lib/composio/normalise.ts`, disconnect route).
- Explicit consent for health and cycle data is captured at consultation as an unticked checkbox, versioned `health_cycle_v1` and timestamped server-side. Calendar and wearable connections are separately client-initiated OAuth flows.
- Full data mapping: `docs/app-privacy-inventory.md`. Risk assessment and action plan: `docs/at-capacity-dpia.md` (draft, awaiting Gordy/Kevin sign-off). App Store answers: `docs/app-privacy-questionnaire.md`.
- Known gaps carried in the DPIA action plan rather than hidden: connection-point consent wording, bounded retention for calendar history and raw Terra events, Terra-side deauthentication on disconnect, processor due-diligence record, and controller legal identity/ICO complaint-right wording. The all-calendars and coaching-administration disclosures are already present in the policy.

## 4. Support and legal links

| Item | Value |
| --- | --- |
| Privacy policy | https://app.onlinegordy.com/privacy |
| Support page | https://app.onlinegordy.com/support (monitored contact: kevin@flowstatesystems.ai) |
| Account deletion | In-app: Settings - Delete account (type DELETE to confirm) |
| Final domain | https://app.onlinegordy.com — DNS and Vercel alias configured 31 July 2026; replace the historical Vercel URLs in App Store Connect and Composio/Google OAuth configuration |

## 5. App Store review notes - calendar guidance

For the reviewer-facing notes (canonical copy in `docs/app-store-metadata.md`):

- The app does not use EventKit and never requests the iOS calendar permission. Calendar access is a web OAuth consent on Google's or Microsoft's own screens, processed by Composio.
- Access is read-only; the app stores only event identifiers, masked-where-private titles, times, busy status and meeting links, for today plus seven days.
- If the review build has no calendar providers configured, the Connected Calendar screen shows a not-available state - this is intentional, not a broken feature.
- The demo/review account should either demonstrate the calendar connect screen's honest unavailable state, or (if a test connection is configured) a connected calendar with fictional events only. Never connect a real calendar to the review fixture.
- Keep the existing Terra framing: connected-health summaries are informational, never diagnostic, and never change a programme automatically.

## 6. Outstanding Gordy decisions

Tracked in the implementation checklist; all block copy or feature completion, none block the architecture:

1. Month 4 guarantee: the measurable definition (the review flow and empty threshold configuration are built; nothing is evaluated or shown to clients until Gordy defines the thresholds).
2. Final client-facing name for the lower-tier Mode B offer (blocks listing copy and in-app labels).
3. WhatsApp number for Founder clients (blocks the Founder contact action).
4. Booking link for private strategy calls (blocks the Founder booking action).
5. Call tokens: visible balance or internal attendance allowance (blocks the call-token UI decision).

Also awaiting Gordy: approval of listing copy/screenshots/content rights/review fixture and DPIA sign-off.

## 7. Release sequence (summary)

1. Restore the fictional review credential and complete the exact-build reviewer, accessibility, APNs, provider-return and crash passes on internal TestFlight Build 5.
2. Run the remaining provider contracts: MyFitnessPal, Outlook and Google when its review gate allows the final production test.
3. Complete the DSA legal declaration, DPIA/controller sign-off and truthful App Accessibility declarations.
4. The Early Win, Storm Warning, Founder compliance and Month 4 migrations are applied and recorded in production as `20260728122140`, `20260728122215`, `20260728122252` and `20260728122318`. Do not rerun them; verify schema/history alignment before future deploys.
5. Reconcile Build 5 and the final review notes in App Store Connect, then stop in **Prepare for Submission** until Kevin authorises **Add for Review**.
