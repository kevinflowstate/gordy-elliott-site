# App Privacy Inventory

Updated 24 July 2026 from the production code on this branch, with a delta pass later the same day covering the merged Early Win, Storm Warning and Founder compliance workstreams. This is the engineering inventory behind the public privacy policy (`app/privacy/page.tsx`), the App Store answers (`docs/app-privacy-questionnaire.md`) and the DPIA (`docs/at-capacity-dpia.md`). Confirm it against the code immediately before submission.

Roles: Gordy Elliott is the controller for client data. Flowstate (Kevin Harkin) operates the platform on his behalf. All third parties below act as processors or independent services under the client's own authorisation.

## Processor register

| Processor | Service | Data reached |
| --- | --- | --- |
| Supabase | Authentication, database, private file storage | All stored client data |
| Vercel | Hosting, serverless execution, cron, operational logs | All data in transit; request logs |
| Composio | Google Calendar and Outlook Calendar OAuth and read-only API calls | Calendar OAuth tokens (held by Composio), calendar event payloads in transit |
| Terra | Wearable and nutrition provider connections and webhooks | Terra user ID, reference ID (`client:<profile-id>`), provider health payloads |
| Anthropic | AI responses (portal AI, admin AI, nutrition generation, coaching-note extraction) | Coaching context sent per request (see AI processing below) |
| OpenAI or OpenRouter | Embeddings for coaching-knowledge retrieval | The text of the query being embedded |
| Resend | Transactional email (once production email is configured) | Name, email, message content |
| Apple APNs / web-push services | Push delivery | Device or subscription identifiers, notification payloads |

Google and Microsoft are the calendar data sources the client authorises through Composio; they are not processors for AT CAPACITY. Meta Pixel exists only in the public marketing layout (`components/MetaPixel.tsx` in `app/(marketing)/layout.tsx`) and is not loaded in the authenticated portal or native shell.

## Data inventory

Storage is the production Supabase project unless stated. "Account deletion" means the authenticated, confirmation-gated flow at `app/api/portal/account/route.ts`, which removes private storage uploads and then deletes the auth user so client-owned rows cascade (calendar and wearable tables reference `client_profiles` with `ON DELETE CASCADE`).

| Data category | Source | Purpose | Storage | Retention | Deletion path | Processors |
| --- | --- | --- | --- | --- | --- | --- |
| Account and contact details (name, email, optional phone) | Client or Gordy at onboarding | Account, authentication, coaching support | `users`, `client_profiles` | Life of account | Account deletion | Supabase, Vercel, Resend |
| Consultation and health context (goals, injuries, health answers, date of birth, sex) - special category | Client consultation form | Coaching personalisation | `client_profiles.consultation_data` and related columns | Life of account | Account deletion | Supabase, Vercel; relevant parts may be sent to Anthropic per AI request |
| Explicit privacy consent record | Consultation form checkbox (unticked by default) | Evidence of Article 9 explicit consent | `consultation_data.privacy_consent`, `privacy_consent_version` (`health_cycle_v1`), `privacy_consent_at` | Life of account | Account deletion | Supabase |
| Cycle tracking (settings and daily entries) - special category | Client opt-in; only offered where `sex = female` and `cycle_tracking_enabled = true` | Readiness context for coaching | `client_cycle_settings`, `client_cycle_entries` | Life of account | Client can disable tracking; account deletion removes data | Supabase; sent to Anthropic as AI context only while enabled |
| Training and nutrition data (programmes, sessions, exercise logs, nutrition plans, meals) | Gordy-assigned plans; client logging | Core coaching | `client_exercise_plans`, `client_exercise_sessions`, `client_exercise_logs`, `client_nutrition_plans`, `client_nutrition_meals` and related tables | Life of account | Account deletion | Supabase; sent to Anthropic as AI context |
| Daily tracker and check-ins (sleep, energy, stress, hydration, wellbeing, weekly check-ins) | Client entry | Coaching and adherence | `client_daily_metrics`, `checkins` | Life of account | Account deletion | Supabase; sent to Anthropic as AI context |
| Body measurements and progress photos | Client entry and uploads | Progress tracking | Measurement tables; private Storage buckets `progress-photos`, `avatars` | Life of account | Account deletion removes rows and storage objects | Supabase |
| Documents | Client or Gordy upload | Coaching materials | `client_documents` plus the bucket recorded per file | Life of account | Account deletion removes rows and storage objects | Supabase |
| Direct messages (AI Coaching mode clients and Gordy) | Client and coach | Coaching communication | `inbox_messages` | Life of account | Account deletion | Supabase |
| Coaching notes ingested from calls, Zoom, Loom, Fathom, WhatsApp, email and voice-note transcripts | Pasted or uploaded by Gordy | Coaching continuity; a client-visible summary and coach-only notes | `client_coaching_notes` | Life of account | Account deletion | Supabase; transcript text sent to Anthropic once for extraction (`app/api/admin/client-coaching-notes/extract/route.ts`) |
| Wearable connection records (provider, Terra user ID, reference ID, scopes, raw Terra user object) | Terra auth webhook after client connects a provider | Manage the connection | `client_wearable_connections` | Life of account | Local disconnect marks the row disconnected; account deletion removes it (see DPIA risk R8 - Terra-side deauthentication is not yet called) | Supabase, Terra |
| Wearable raw webhook events (full provider payload plus idempotency hash) | Terra webhooks | Idempotency, audit, re-normalisation | `client_wearable_events` | Life of account; no automated purge | Account deletion | Supabase, Terra |
| Wearable daily summaries (sleep, HRV, resting heart rate, activity, calories, macros, hydration) | Normalised from Terra payloads | Capacity/readiness signals, coach-side flags | `client_wearable_daily_summaries` | Life of account; retained after provider disconnect (policy states this) | Account deletion | Supabase; recent summaries sent to Anthropic as AI context |
| Calendar connection records (provider, Composio user ID `client:<profile-id>`, Composio connected-account ID, status, sync timestamps, last error) | Client-initiated OAuth via Composio; blocked for `ai_only` tier | Manage the connection | `client_calendar_connections` | Life of account | Disconnect revokes the Composio connected account and clears the ID; account deletion cascades | Supabase, Composio |
| Synced calendar events | Read-only pulls of today plus seven days from Google (all calendars on the connected account) or Outlook | Next meeting, day summary, calendar density, storm-warning inputs | `client_calendar_events`: external event ID/key, calendar ID, title (private/confidential titles stored as "Busy"), start/end, date and time keys, all-day flag, busy status, meeting link, cancelled flag. No descriptions, attendees or locations are stored (`lib/composio/normalise.ts`) | Rolling window is refreshed each sync; copies of past events persist until disconnect or account deletion (see DPIA risk R4) | Disconnect deletes all synced events for the connection; account deletion cascades | Supabase, Composio; NOT sent to any AI provider in current code |
| AI usage records (model, token counts, costs, credits) | Generated per AI request | Metering and credits | `ai_usage`, `client_profiles.ai_credits` | Life of account | Account deletion | Supabase |
| Push identifiers (web-push subscriptions, native APNs device tokens) | Client enables notifications | Notification delivery | `push_subscriptions`, `native_push_devices` (service-role access only) | Until sign-out, token invalidation or account deletion | Sign-out removes the current device token; account deletion clears rows | Supabase, Apple APNs, web-push services |
| Usage and diagnostics (logins, adherence, feature activity, server errors) | Platform operation | Reliability, security, coaching support | Supabase rows and Vercel logs | Vercel log retention is platform-managed | Account deletion for database rows | Supabase, Vercel |
| Early-win goals and entries (priority metric, starting/target values, dated value entries, review outcome) - health-adjacent | Admin-created after the Capacity X-Ray; values sourced from wearable summaries, body measurements or manual entry | Fourteen-day priority-metric focus and review | `client_early_wins`, `client_early_win_entries` (one active win per client; completed wins made immutable by trigger; client sees own active win only, Founder mode) | Life of account; completed history retained as coaching record | Account deletion (CASCADE) | Supabase only |
| Storm-warning audit log (rule IDs, severity, per-day meeting/all-day/travel counts and earliest start times, thresholds, evaluation JSONB, input hash) | Deterministic server-side evaluation of calendar pressure | Explainable audit trail of every warning shown | `client_storm_warnings`; deduplicated on input hash and capped at 30 rows per client per window; no event titles, descriptions, attendees or meeting links are stored (`lib/storm-warning.ts`); client SELECT own rows (Founder mode), writes service-role only | Life of account; append-only | Account deletion (CASCADE) | Supabase only; not sent to AI |
| Storm-warning dismissals (window key, severity, timestamp) | Client dismissal action | Respect the client's choice to silence a warning for a window | `client_storm_warning_dismissals`; writes are API-only and validated against a fresh server-side evaluation - clients hold SELECT only (`app/api/portal/storm-warning/route.ts`) | Life of account | Account deletion (CASCADE) | Supabase only |
| Call-attendance records (call date, call type, attended flag, note up to 500 characters, recording admin) | Recorded by Gordy | Guarantee compliance evidence | `client_call_attendance`; admin-only, no client read surface in v1 | Life of account | Account deletion (CASCADE) | Supabase only |
| WhatsApp help records (week key, helped flag, note up to 500 characters) - communications metadata about off-platform WhatsApp coaching | Recorded weekly by Gordy | Guarantee compliance evidence | `client_whatsapp_help`; admin-only, no client read surface in v1. Message content is never stored; this records only that help occurred in a given week | Life of account | Account deletion (CASCADE) | Supabase only |
| Month 4 review (frozen JSONB baseline comparison containing health-metric values, compliance summary, outcome note) | Snapshot built by the admin review flow | Month 4 guarantee review | `client_month4_reviews`; draft until completed, then immutable by trigger; clients see only their own completed review | Life of account | Account deletion (CASCADE) | Supabase only |
| Baseline override audit (old and new health baseline values, written reason, acting admin, timestamp) | Service-role-only `override_locked_capacity_baseline` function | Evidence that a locked health baseline never changes silently | `client_baseline_overrides`; rows immutable by trigger; admin-only visibility | Life of account; deliberately retains superseded health values | Account deletion (CASCADE) | Supabase only |

Programme-level guarantee configuration (`guarantee_settings`) holds no client personal data: a single row of thresholds, all null until Gordy confirms the commercial definition (nothing is evaluated or shown to clients while null), plus the updating admin's user ID.

## AI processing detail

- Client portal AI (`app/api/portal/ai/route.ts`): sends the client's profile context, goals, plans, adherence, latest check-in, cycle context (only when tracking is enabled), recent wearable summaries and de-identified coaching-knowledge guidance to Anthropic (`claude-haiku-4-5`). The query text is also embedded via OpenAI or OpenRouter for coaching-knowledge retrieval (`lib/brain-retrieval.ts`).
- Admin AI, nutrition generation and coaching-note extraction (`app/api/admin/ai/route.ts`, `app/api/admin/ai-generate-nutrition/route.ts`, `app/api/admin/client-coaching-notes/extract/route.ts`): Anthropic models operating on the selected client's coaching context or pasted transcript.
- Calendar data is not sent to any AI provider anywhere in the current code. The storm-warning logic is deterministic (`lib/storm-warning.ts` states titles are never inspected).
- None of the Early Win, Storm Warning, compliance, Month 4 review or baseline-override data reaches any AI prompt; these features are entirely in-platform and introduce no new processor.
- AI output is suggestion-only. Nothing in the AI path mutates a training or nutrition programme automatically.
- The coaching-knowledge base (`brain_docs`) is stored de-identified and its prompt instructs the model not to reference sources.

## Access model

- Supabase RLS restricts clients to their own rows; Gordy's admin role can read client rows via `private.is_admin()` policies (see `supabase/migrations/20260723153000_add_composio_calendar_integrations.sql` for the calendar pattern).
- Server routes authenticate the user first, then use the service-role client scoped to that client's profile ID.
- Calendar and wearable write paths are service-role only; browser roles have SELECT at most.
- The native push token store denies `anon` and `authenticated` table access entirely.

## Current handling position

- Data is used to provide coaching and app functionality; it is not sold and is not used for third-party advertising or cross-company tracking.
- Calendar connections are optional, client-initiated, read-only, and disclosed in the privacy policy with Google Limited Use wording and Composio named as processor.
- Wearable connections are optional and client-initiated through the Terra widget; production credentials are not yet configured, so production presents an unavailable state rather than mock data.
- Camera and photo library access are used only when the client chooses to upload an image.
- Clients can disconnect providers and permanently delete their account from Settings.

## Before App Store submission

- Confirm every production SDK/provider and its privacy policy, including Composio and the final Terra provider list.
- Confirm whether any diagnostics or analytics SDK is added to the release build.
- Confirm data retention periods with Gordy and his legal/privacy adviser, including whether synced calendar history and raw Terra events should be purged on a schedule.
- Complete Apple's tracking/domain questions based on observed native traffic, not assumptions.
- Re-check the published App Privacy answers against `docs/app-privacy-questionnaire.md` once the calendar launch decision (with or without Google, pending verification) is final.
