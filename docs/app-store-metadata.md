# AT CAPACITY App Store Metadata

Prepared for the first iOS release and reconciled against the live Gordy-owned App Store Connect record on 26 August 2026. Version 1.0 remains Prepare for Submission.

## Product fields

| Field | Submission value |
| --- | --- |
| Name | AT CAPACITY |
| Subtitle | Training, nutrition, coaching |
| Primary category | Health & Fitness |
| Secondary category | Lifestyle |
| Copyright | 2026 Gordy Elliott |
| Support URL | https://app.onlinegordy.com/support |
| Marketing URL | https://app.onlinegordy.com |
| Privacy Policy URL | https://app.onlinegordy.com/privacy |
| Privacy Choices URL | https://app.onlinegordy.com/privacy |
| Version | 1.0 |
| Release | Manually release after approval |

`https://app.onlinegordy.com` is Gordy's canonical production domain. Use these URLs in App Store Connect and the Google OAuth verification submission.

## Promotional text

Your training plan, nutrition targets, daily tracking and direct coaching support from Gordy, together in one private client app.

## Description

AT CAPACITY is the private coaching companion for existing Gordy Elliott clients.

Your programme, progress and coach conversations stay together, so you always know what to focus on next.

TRAIN WITH A CLEAR PLAN

- Browse your current training programme and upcoming sessions
- Start a session, follow each prescribed exercise and record every set
- Review recent performance and keep your weekly schedule organised

KEEP NUTRITION PRACTICAL

- See your assigned nutrition plan and daily targets
- Track meals and review your recent consistency
- Keep everyday food decisions connected to your coaching goals

STAY CONNECTED TO YOUR COACH

- Send private text, photo and voice messages
- Complete weekly check-ins and receive feedback
- Log sleep, energy, stress, hydration and training in the Daily Tracker
- Keep consultations, documents and progress information in one place

COACHING CONTEXT THAT MOVES WITH YOU

Optional connected apps can contribute sleep, recovery, activity and nutrition summaries when enabled. Eligible clients can connect Google Calendar or Outlook Calendar with read-only access so AT CAPACITY can help reflect the shape of the week. These signals support coaching suggestions only and never diagnose a condition or change a programme automatically.

After explicitly allowing optional AI sharing, eligible clients can also use AT CAPACITY AI to find assigned content and understand their existing coaching plan. AI does not replace Gordy, diagnose conditions or provide emergency or medical care.

AT CAPACITY is sign-in only. Coaching enrolment and payment happen outside the app, and an existing client account is required.

## Keywords

`fitness,coaching,training,workouts,nutrition,gym,progress,habits,recovery,wellness`

## Review contact

| Field | Value |
| --- | --- |
| First name | Kevin |
| Last name | Harkin |
| Email | kevin@flowstatesystems.ai |
| Phone | +447749461202 |

Review credentials are stored only in App Store Connect. Do not put the password in source control or submission documents.

## Review notes

AT CAPACITY is a sign-in-only companion app for existing Gordy Elliott coaching clients. Coaching enrolment and payment happen outside the app. There is no public account creation, subscription purchase or in-app purchase flow.

Use the supplied Demo Client account to inspect an assigned training programme and log a session; view the assigned nutrition plan; use Daily Tracker; review check-ins and coach replies; open DM; view consultation and Settings; and inspect Connected Apps. The account contains representative fictional data only.

Connected-health summaries are optional informational coaching signals. They do not diagnose conditions and never alter a training programme automatically. The Connected Apps screen shows the availability and current connection state reported by the server, allows a client to disconnect a connection, and does not substitute fabricated production data. Apple Health is not enabled in version 1.

AI sharing starts off. In Settings > AI sharing (also shown before the first AI chat and on the consultation form), clients see the data categories and named recipients before choosing Allow AI sharing or Keep AI off. Plans, tracking and private coach messages work with AI off. Withdrawal in Settings stops new client and coach-triggered AI requests. Consultation submission still works without an AI summary.

Group chat is deferred for version 1: client/admin navigation and direct pages are unavailable, and community APIs return 404. WHOOP and Apple Health are unavailable in this release.

Calendar connections for clients using the Founder Dashboard experience are optional and read-only. The app does not use EventKit or request the iOS calendar permission. Clients authorise Google Calendar or Outlook Calendar through the provider's own OAuth consent screen, processed by Composio as service provider. AT CAPACITY stores event identifiers, titles (private events shown as "Busy"), start/end times, busy status and a meeting link, but not descriptions or attendee lists. Disconnecting removes the synced event copies.

Notification permission is requested only after the client selects Enable. DMs, coach nudges, tasks and reminders use the same account-level pause/freeze suppression rules as in-app notifications.

Account deletion is available after sign-in under Settings > Delete account and requires explicit confirmation. The privacy policy and support page are also available publicly at the URLs supplied in App Store Connect.

Submission hold: Kevin confirmed the prior iPhone walkthrough on 9 September. Preserve that coverage; the new hosted consent flow needs only a focused check on Build 10. Do not copy these notes into App Store Connect or submit the app until the current App Store Connect session and revised notes have been reconciled. Do not add for review without separate submission authorization.

## Other submission answers

- Content rights: **Yes, the app has the necessary rights to all content it displays.** Confirm Gordy owns or is licensed to use every uploaded coaching video, document and image before final submission.
- Advertising identifier: **No.** The native authenticated app does not load Meta Pixel or use IDFA.
- In-app purchases: **No.** Existing clients enrol and pay outside the app.
- Export compliance: **No non-exempt encryption.** The app uses operating-system and standard HTTPS encryption and declares `ITSAppUsesNonExemptEncryption = NO`.
- Regulated medical device: **No.** The app provides fitness coaching and explicitly avoids diagnosis or treatment claims.
- Sign-in required: **Yes.** Supply the verified Demo Client credentials already held in App Store Connect.


## Saved App Store Connect reconciliation — 9 September 2026

The live app name is AT CAPACITY; Gordy remains the business/account holder. Kevin confirmed the new consent and sign-in screens on iPhone. Revised description and reviewer notes are now saved and verified after a fresh page load. The live reviewer notes retain the detailed Build 10 SwiftUI workout-runner guidance and add default-off AI sharing, recipients and withdrawal, WHOOP/Apple Health unavailability and deferred group chat. The longer draft above is reference material; it should not overwrite the saved native-utility explanation. The earlier session/reconciliation hold is resolved. Final MRDP per-app declaration is prepared but unsaved pending owner confirmation of existing tax information. No submission authorized or performed. See apple-release-corrections-2026-09-09.md for the current handover.
