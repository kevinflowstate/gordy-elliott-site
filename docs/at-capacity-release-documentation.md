# AT CAPACITY - Release Documentation (v1)

Prepared 24 July 2026 from the code on this branch, the implementation checklist and the App Store worksheets. This is the release-readiness summary; the canonical detail lives in the linked documents.

## 1. What v1 ships

One coaching product across web, PWA and a Capacitor iOS shell (`com.gordyelliott.shift`, production host https://gordy-elliott-site.vercel.app), sign-in only, with two client experiences enforced in server routes as well as navigation:

- Founder Dashboard (higher tier): calendar-first daily view with next meeting and day summary, capacity/load bar from the wearable summary, today's training and non-negotiables, quick actions, seven-day calendar-density strip. Client-facing DM and AI surfaces are hidden and route-gated. Contact with Gordy is over WhatsApp and booked strategy calls (both awaiting Gordy's details).
- AI Coaching (lower tier, final client-facing name pending): the existing portal - training, nutrition, daily tracker, check-ins, DM with Gordy, AT CAPACITY AI assistant, optional cycle tracking for eligible clients.

Shared foundations shipping in v1: Month 1 baseline capture with locking and Baseline vs Now comparison (override flow still outstanding), Gordy's Capacity Scan admin view with explained red/amber states, coaching-note ingestion, account deletion, push-notification groundwork, and the calendar and wearable integration architecture described below.

Built but externally gated (present in code, inert without credentials/approval): Google and Outlook calendar connections via Composio; Terra wearable connections (production presents an unavailable state, never mock data).

In progress at the time of writing (per the implementation checklist): fourteen-day early win card, storm-warning density rules and logging, guarantee thresholds (blocked on Gordy's definition).

Explicitly out of scope for v1: Apple Health/HealthKit, Android Health Connect, WhatsApp auto-ingestion, Calendly sync, automatic programme changes, ML storm prediction, Kahunas/Skool migration.

## 2. External gates

| Gate | Status (24 July 2026) | What it blocks |
| --- | --- | --- |
| Google branding + Calendar data-access verification (project `at-capacity-503314`) | Submitted 24 July 2026, UNDER REVIEW. Initial Trust & Safety contact expected in roughly 3-5 business days; full verification may take 4-6 weeks. Scopes are sensitive, not restricted. Do not describe approval as complete. | Normal client Google Calendar connections. Test users can connect during review. |
| Real production calendar contract tests | Outstanding for both Google and Outlook. Outlook is implemented and ready to test; it does not depend on the Google review. | Advertising calendar connections; Founder pilot calendar onboarding. |
| Terra production credentials | Awaited (Gordy purchasing the subscription). No real provider testing has happened. | All real wearable data; Terra provider acceptance tests; Terra-side deauthentication verification. |
| Apple: APNs capability + key, physical-device TestFlight, review password, DSA trader details, record rename from "SHIFT Coaching by Gordy" | Per `docs/app-store-release-audit.md` and `docs/app-store-submission.md` | Final App Store submission. |
| Supabase leaked-password protection | Pending dashboard toggle | Release audit sign-off. |

## 3. Privacy and consent position

- Live policy: `/privacy` (code: `app/privacy/page.tsx`, effective 20 July 2026). It discloses calendar connections with Google Limited Use wording, names Composio as the calendar processor, describes the "Busy" masking and no-descriptions/no-attendees position, and states that disconnecting a calendar deletes the synced copies. The code matches these claims (`lib/composio/normalise.ts`, disconnect route).
- Explicit consent for health and cycle data is captured at consultation as an unticked checkbox, versioned `health_cycle_v1` and timestamped server-side. Calendar and wearable connections are separately client-initiated OAuth flows.
- Full data mapping: `docs/app-privacy-inventory.md`. Risk assessment and action plan: `docs/at-capacity-dpia.md` (draft, awaiting Gordy/Kevin sign-off). App Store answers: `docs/app-privacy-questionnaire.md`.
- Known gaps carried in the DPIA action plan rather than hidden: connection-point consent wording, bounded retention for calendar history and raw Terra events, Terra-side deauthentication on disconnect, processor due-diligence record, and two policy wording fixes (all-calendars read scope for Google; controller identity and ICO complaint right).

## 4. Support and legal links

| Item | Value |
| --- | --- |
| Privacy policy | https://gordy-elliott-site.vercel.app/privacy |
| Support page | https://gordy-elliott-site.vercel.app/support (monitored contact: kevin@flowstatesystems.ai) |
| Account deletion | In-app: Settings - Delete account (type DELETE to confirm) |
| Final domain | Pending from Gordy; Vercel URLs are functional fallbacks and must be replaced in App Store Connect and the Composio/Google OAuth configuration when live |

## 5. App Store review notes - calendar guidance

For the reviewer-facing notes (canonical copy in `docs/app-store-metadata.md`):

- The app does not use EventKit and never requests the iOS calendar permission. Calendar access is a web OAuth consent on Google's or Microsoft's own screens, processed by Composio.
- Access is read-only; the app stores only event identifiers, masked-where-private titles, times, busy status and meeting links, for today plus seven days.
- If the review build has no calendar providers configured, the Connected Calendar screen shows a not-available state - this is intentional, not a broken feature.
- The demo/review account should either demonstrate the calendar connect screen's honest unavailable state, or (if a test connection is configured) a connected calendar with fictional events only. Never connect a real calendar to the review fixture.
- Keep the existing Terra framing: connected-health summaries are informational, never diagnostic, and never change a programme automatically.

## 6. Outstanding Gordy decisions

Tracked in the implementation checklist; all block copy or feature completion, none block the architecture:

1. Month 4 guarantee: the measurable definition (blocks guarantee thresholds and Month 4 review comparison).
2. Final client-facing name for the lower-tier Mode B offer (blocks listing copy and in-app labels).
3. WhatsApp number for Founder clients (blocks the Founder contact action).
4. Booking link for private strategy calls (blocks the Founder booking action).
5. Call tokens: visible balance or internal attendance allowance (blocks the call-token UI decision).

Also awaiting Gordy: final production domain, Terra subscription, approval of listing copy/screenshots/content rights/review fixture, and DPIA sign-off.

## 7. Release sequence (summary)

1. Close the in-progress checklist items (early win, storm-warning rules and logging) or explicitly descope them for the pilot.
2. Ship the DPIA action-plan items that are code changes (consent wording at connection points, policy wording fixes).
3. Run the real calendar contract tests (Outlook now; Google with a test user during review).
4. On Terra credentials: configure, run provider acceptance tests, implement and verify deauthentication on disconnect.
5. Complete the Apple gates (rename record, re-enter listing and privacy answers, screenshots from the release candidate, APNs, physical-device TestFlight).
6. Gordy and Founding Five acceptance, then deploy and submit.
