# App Privacy Questionnaire

Prepared 21 July 2026 from the production code and Apple's current App Privacy taxonomy. Confirm again after Terra and any analytics or crash SDK configuration is final.

## Top-level answers

- Does this app collect data? **Yes**
- Is any collected data used to track users? **No**
- Is data sold or shared with data brokers? **No**
- Is the advertising identifier used? **No**
- Privacy Policy URL: `https://gordy-elliott-site.vercel.app/privacy`
- User Privacy Choices URL: `https://gordy-elliott-site.vercel.app/privacy`

All declared types below are **linked to the user's identity** because SHIFT stores them against an authenticated coaching account. None are used for third-party advertising or cross-company tracking.

## Data types to select

| Apple data type | SHIFT examples | Purpose selections |
| --- | --- | --- |
| Contact Info - Name | Client name | App Functionality; Product Personalization |
| Contact Info - Email Address | Login and support email | App Functionality |
| Contact Info - Phone Number | Optional consultation/profile phone | App Functionality |
| Health & Fitness - Health | Injuries, cycle information, sleep, recovery, wellbeing, consultation health answers | App Functionality; Product Personalization |
| Health & Fitness - Fitness | Programmes, sessions, exercise logs, activity and body measurements | App Functionality; Product Personalization |
| Sensitive Info | Optional cycle and other sensitive consultation information | App Functionality; Product Personalization |
| User Content - Emails or Text Messages | Private client/coach DMs | App Functionality |
| User Content - Photos or Videos | Progress, check-in and profile photos | App Functionality |
| User Content - Other User Content | Check-ins, tracker notes, consultations, documents and saved responses | App Functionality; Product Personalization |
| Identifiers - User ID | Supabase account/client IDs and Terra reference IDs | App Functionality |
| Identifiers - Device ID | APNs and web-push device/subscription identifiers | App Functionality |
| Usage Data - Product Interaction | Login, plan completion, adherence and feature activity | App Functionality; Product Personalization |
| Diagnostics - Other Diagnostic Data | Server errors and operational security/reliability logs | App Functionality |

## Do not select on current evidence

- Financial information or purchase history: payment does not occur in the app and SHIFT does not receive payment details.
- Precise or coarse location: the app does not request location or use IP addresses to determine location.
- Contacts, browsing history, search history, audio, advertising data, crash data or performance data: no current app feature or embedded native SDK collects these for Gordy.
- Tracking: Meta Pixel is confined to the public marketing layout. The native shell opens non-portal marketing links externally and must pass the release network audit before this answer is published.

## Providers represented by the answers

- Supabase: authentication, database and private storage
- Vercel: hosting and operational logs
- Resend: transactional email once production email is configured
- AI providers: relevant coaching context used to answer a request or create a coaching suggestion
- Terra: account reference and connected health/fitness summaries after a client opts in
- Apple Push Notification service and web-push providers: device/subscription identifiers and notification payloads

No provider receives data for third-party advertising. Terra and AI data flows must remain limited to the features the client or coach invokes.

## Final verification before publishing

1. Run authenticated native network QA and confirm no requests reach Meta/Facebook advertising domains.
2. Confirm no analytics, crash-reporting or attribution SDK was added after this inventory.
3. Confirm Vercel is not intentionally retaining or using client IP addresses as location or device data.
4. Confirm Gordy's final privacy/support contact and retention wording.
5. Confirm Terra's enabled production providers and privacy policy before real client connections begin.
