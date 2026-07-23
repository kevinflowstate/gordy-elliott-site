# App Privacy Inventory

This is the engineering inventory behind the App Store answers. Use `docs/app-privacy-questionnaire.md` as the canonical App Store Connect worksheet, then confirm it against this inventory immediately before submission.

## Data linked to the client

| App Store category | AT CAPACITY examples | Purpose |
| --- | --- | --- |
| Contact info | Name, email, phone where supplied | Account, coaching support, authentication |
| Health and fitness | Training, nutrition, sleep, recovery, injuries, body measurements, cycle information, connected-app summaries | Coaching and app functionality |
| User content | DMs, check-ins, consultation answers, progress photos, documents | Coaching and app functionality |
| Identifiers | Supabase user/client IDs, Terra user/reference IDs, push subscription identifiers | Account, security and integrations |
| Usage data | Logins, completion/adherence and feature activity | Coaching support, app functionality and security |
| Diagnostics | Server errors and operational logs | Reliability and security |

## Current handling position

- Data is used to provide coaching and app functionality; it is not sold.
- Health and cycle data is not used for third-party advertising.
- Meta Pixel is present on the web product. Confirm it is not loaded inside authenticated/native portal journeys before answering tracking questions.
- Relevant coaching context may be processed by contracted AI providers to produce summaries or suggestions.
- Terra receives the minimum identifiers needed to connect a provider and returns health/fitness data selected by the client.
- Camera and photo library access are used only when the client chooses to upload an image.
- Clients can disconnect providers and permanently delete their account from Settings.

## Before App Store submission

- Confirm every production SDK/provider and its privacy policy.
- Confirm whether any diagnostics or analytics SDK is added to build 2.
- Confirm data retention periods with Gordy and his legal/privacy adviser.
- Add a monitored public support/privacy contact to the deployed policy.
- Complete Apple's tracking/domain questions based on observed native traffic, not assumptions.
