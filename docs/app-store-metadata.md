# AT CAPACITY App Store Metadata

Prepared 21 July 2026 for the first iOS release; calendar-connection copy and review notes added 24 July 2026. Recheck character limits in App Store Connect before submission. The listing currently saved in App Store Connect predates the calendar additions and must be re-entered from this document.

## Product fields

| Field | Submission value |
| --- | --- |
| Name | AT CAPACITY by Gordy |
| Subtitle | Training, nutrition, coaching |
| Primary category | Health & Fitness |
| Secondary category | Lifestyle |
| Copyright | 2026 Gordy Elliott |
| Support URL | https://gordy-elliott-site.vercel.app/support |
| Marketing URL | https://gordy-elliott-site.vercel.app |
| Privacy Policy URL | https://gordy-elliott-site.vercel.app/privacy |
| Privacy Choices URL | https://gordy-elliott-site.vercel.app/privacy |
| Version | 1.0 |
| Release | Manually release after approval |

Replace the Vercel host with Gordy's final production domain when it is live. The current URLs are public, functional submission fallbacks.

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

- Send and receive private direct messages
- Complete weekly check-ins and receive feedback
- Log sleep, energy, stress, hydration and training in the Daily Tracker
- Keep consultations, documents and progress information in one place

COACHING CONTEXT THAT MOVES WITH YOU

Eligible clients can use optional cycle tracking. Supported connected apps can also contribute sleep, recovery, activity and nutrition summaries when enabled. Founder Dashboard clients can optionally connect Google Calendar or Outlook Calendar with read-only access so the dashboard reflects the shape of their day. These signals support coaching suggestions only and never change a programme automatically.

Note before submission: keep the calendar sentence only if calendar connections are enabled for the launch build. Google Calendar remains externally gated by Google's verification review (submitted 24 July 2026, under review); Outlook does not depend on that review but still needs its production contract test.

AT CAPACITY AI can help eligible AI Coaching clients find assigned content and understand their existing coaching plan. Founder Dashboard clients receive direct coaching from Gordy and do not use in-app AI. AI does not replace Gordy, diagnose conditions or provide emergency or medical care.

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

Connected-health summaries are informational coaching signals. They do not diagnose conditions and never alter a training programme automatically. Apple Health is not enabled in version 1. When Terra production credentials are unavailable, Connected Apps presents an unavailable state rather than fabricated data.

Calendar connections (Founder Dashboard clients) are optional and read-only. The app does not use EventKit or request the iOS calendar permission; clients authorise Google Calendar or Outlook Calendar through the provider's own OAuth consent screen, processed by Composio as service provider. AT CAPACITY stores only event identifiers, titles (private events shown as "Busy"), start/end times, busy status and a meeting link - never descriptions or attendee lists. Disconnecting removes the synced copies. If calendar providers are not configured in the review build, the connect screen presents a not-available state.

Notification permission is requested only after the client selects Enable. DMs, coach nudges, tasks and reminders use the same account-level pause/freeze suppression rules as in-app notifications.

Account deletion is available after sign-in under Settings > Delete account and requires explicit confirmation. The privacy policy and support page are also available publicly at the URLs supplied in App Store Connect.

## Other submission answers

- Content rights: **Yes, the app has the necessary rights to all content it displays.** Confirm Gordy owns or is licensed to use every uploaded coaching video, document and image before final submission.
- Advertising identifier: **No.** The native authenticated app does not load Meta Pixel or use IDFA.
- In-app purchases: **No.** Existing clients enrol and pay outside the app.
- Export compliance: **No non-exempt encryption.** The app uses operating-system and standard HTTPS encryption and declares `ITSAppUsesNonExemptEncryption = NO`.
- Regulated medical device: **No.** The app provides fitness coaching and explicitly avoids diagnosis or treatment claims.
- Sign-in required: **Yes.** Supply the verified Demo Client credentials already held in App Store Connect.
