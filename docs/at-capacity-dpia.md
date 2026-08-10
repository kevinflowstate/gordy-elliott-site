# AT CAPACITY - Data Protection Impact Assessment

| | |
| --- | --- |
| Product | AT CAPACITY by Gordy Elliott (web, PWA and iOS shell) |
| Version assessed | v1 release candidate, branch state of 24 July 2026 (revision 2, same day: delta for the merged Early Win, Storm Warning and Founder compliance workstreams) |
| Status | DRAFT - awaiting controller sign-off |
| Author | Prepared by the Flowstate build team from the production code |
| Review trigger | Any new processor, new data category, AI scope change, or the Terra/Google gates completing |

Revision 2 note: the "new data category" review trigger fired on 24 July 2026 when three implementation workstreams merged. This revision adds those processing activities to section 1, risks R11-R13 to the register, and one action-plan item. No new processor was introduced, none of the new data reaches AI prompts, and an independent hostile security review of the full merged diff found no P1/P2 issues; five P3 hardening items were remediated the same day (an allowlist hole, removal of direct client dismissal writes, an audit-log cap, generic client-facing error messages, and date validation).

This DPIA is proportionate to a single-coach platform with a small, invitation-only client base. It covers the two processing activities that most warrant assessment under UK GDPR: health data (special category) and connected calendar data. Facts are grounded in the code paths cited; where a control is planned but not yet verified, it is labelled as pending.

## 1. Description of processing

AT CAPACITY is a private coaching platform for existing clients of Gordy Elliott. Clients sign in to a portal (web, PWA or the iOS shell, which loads the hosted portal). There are two client experiences: Founder Dashboard (higher tier, coached directly by Gordy over WhatsApp and calls) and AI Coaching (in-app DM with Gordy plus an AI assistant).

Personal data processed:

- Account and contact details, consultation answers, goals, date of birth and sex.
- Health data (special category): injuries, health context, daily wellbeing metrics, body measurements, progress photos, optional cycle tracking (settings and daily entries), and, once Terra is live, wearable summaries (sleep, HRV, resting heart rate, activity, nutrition).
- Calendar data (optional, Founder-focused): read-only synced copies of events for today plus seven days - event identifiers, title (private/confidential titles stored as "Busy"), start/end times, all-day and busy status, and a meeting link. No descriptions, attendees or locations are stored (`lib/composio/normalise.ts`).
- Communications: in-app DMs, check-ins, and coaching notes ingested by Gordy from call/Zoom/Loom/Fathom/WhatsApp/email/voice-note transcripts.
- Operational data: push identifiers, AI usage metering, logins and server logs.
- Early-win goals (added revision 2): an admin-set priority metric per Founder client (wearable HRV/resting heart rate/sleep, body-measurement weight/waist, or manual), dated value entries and a 14-day review, with completed wins made immutable (`supabase/migrations/20260728122140_add_early_win.sql`).
- Storm-warning records (added revision 2): a deterministic, append-only audit log of calendar-pressure warnings storing rule IDs, per-day meeting counts and earliest start times, thresholds and an input hash - never event titles, descriptions, attendees or links - plus client dismissals per warning window (`supabase/migrations/20260728122215_add_storm_warnings.sql`, `lib/storm-warning.ts`).
- Founder compliance records (added revision 2): call-attendance rows, weekly WhatsApp-help records (a helped flag and short note about off-platform coaching contact - communications metadata, never message content), frozen Month 4 review snapshots containing health-metric baselines and compliance summaries, and an immutable audit of admin overrides of locked health baselines (`supabase/migrations/20260728122252_add_founder_compliance.sql`, `20260728122318_add_month4_reviews_and_baseline_overrides.sql`). All are admin-recorded; clients see only their own active early win, own storm warnings and own completed Month 4 review. Every new table cascades on account deletion.

Data flows and recipients:

- Storage and access control: Supabase (database, auth, private storage) with row-level security; hosting on Vercel.
- Calendar: client-initiated OAuth handled by Composio as processor. Reads use Composio tool calls (`GOOGLECALENDAR_EVENTS_LIST_ALL_CALENDARS`, `OUTLOOK_GET_CALENDAR_VIEW`) on a schedule (`app/api/cron/calendar-sync/route.ts`, bearer-secret protected) and on demand. Only the normalised minimum is persisted.
- Wearables: Terra as processor. Signed webhooks (HMAC-SHA256 with timestamp tolerance and idempotency hashing) deliver provider payloads; approved activity, daily, sleep and nutrition events plus normalised daily summaries are stored per client. Unused body, athlete and menstruation events are acknowledged and discarded.
- AI: coaching context is sent per request to Anthropic; query text is embedded via OpenAI or OpenRouter for retrieval over a de-identified coaching-knowledge base. Calendar data is not sent to AI. AI output is suggestion-only and never changes a programme automatically.
- Push: Apple APNs and web-push services receive device identifiers and notification payloads.

Retention: account and coaching data is retained for the life of the account; clients can permanently delete their account from Settings (`app/api/portal/account/route.ts` removes uploads, then deletes the auth user so client-owned rows cascade). Calendar disconnect revokes the Composio connected account and deletes the synced event copies. Raw Terra webhook payloads are purged after 90 days by default (configurable from 7-365 days); normalised coaching summaries remain with the account. Wearable disconnect calls Terra's deauthentication endpoint before marking the local connection disconnected, and later data for a non-connected row is not stored. These Terra controls are implemented in the 3 August activation branch and require a real testing-environment acceptance run before launch.

## 2. Necessity and proportionality

- Purpose: deliver personalised coaching under the client's coaching agreement. Health signals (sleep, recovery, cycle, wearables) and schedule pressure (calendar density) are the coaching signals the product exists to read; the processing is directly tied to the service the client is paying for.
- Data minimisation is designed in at the highest-risk boundary: calendar sync persists only identifiers, masked-where-private titles, times, busy status and a meeting link, over an eight-day forward window. Outlook requests a restricted field set (`OUTLOOK_SELECT` in `lib/composio/calendar.ts`).
- Could the purpose be achieved with less data? A free/busy-only calendar feed would be less intrusive but would remove the "next meeting" and meeting-link functions clients are shown; the chosen middle ground (title-with-masking, no descriptions/attendees) is defensible. Wearable summaries are aggregates, not raw sensor streams, in the tables the app uses day to day (raw webhook payloads are, however, retained - risk R4).
- Alternatives to AI processing (manual coach review only) exist for Founder clients, who have no in-app AI surface; AI Coaching clients are told AI is part of the product.

## 3. Lawful bases

| Processing | Article 6 basis | Article 9 condition (where special category) |
| --- | --- | --- |
| Core coaching (plans, logs, check-ins, DMs, coaching notes) | Contract (6(1)(b)) | Explicit consent (9(2)(a)) for the health content, captured at consultation |
| Optional cycle tracking | Consent (6(1)(a)) - feature is off unless enabled | Explicit consent (9(2)(a)) |
| Optional wearable connection (Terra) | Consent (6(1)(a)) - client initiates the provider OAuth | Explicit consent (9(2)(a)) |
| Optional calendar connection (Composio) | Consent (6(1)(a)) - client initiates the OAuth | Not special category by design (titles masked, no attendees); residual sensitive content addressed at R3 |
| Push notifications | Consent (6(1)(a)) - permission requested only after the client selects Enable | - |
| Security, logging, abuse prevention | Legitimate interests (6(1)(f)) | - |

Consent mechanism as implemented: the consultation form includes an unticked-by-default checkbox stating the form may include health, training, nutrition, injury and cycle-related information and how Gordy will use it. The server rejects submission without it and stores `privacy_consent`, `privacy_consent_version` (`health_cycle_v1`) and a timestamp (`app/api/portal/consultation/route.ts`). The Terra connection screen separately requires an unticked explicit-health-data checkbox, names Terra as the connection provider, links both privacy notices and stores `wearable_connection_v2` plus its acceptance time on the provider connection. Calendar connection now uses a just-in-time first-connect dialog: it explains the seven-day read-only sync, private-event masking, coaching purpose, AI/advertising separation and withdrawal, links the privacy policy, and records `calendar_connection_v1` plus its acceptance time before the provider OAuth can start. Withdrawing consent is effected by disabling the feature, disconnecting the provider, or deleting the account.

## 4. Consultation

The client base is small, closed and personally known to the controller. No formal data-subject consultation has been run; the Founding Five pilot functions as the feedback channel. Clients can raise privacy questions through DM, WhatsApp or the public support page.

## 5. Risks and mitigations

Scoring: likelihood x severity, each low/medium/high, judged for this product's scale (tens of clients, one coach).

| Ref | Risk | Initial | Implemented mitigations (with evidence) | Residual |
| --- | --- | --- | --- | --- |
| R1 | Cross-client leakage: one client sees another's health or calendar data | Low x High | Supabase RLS on all client tables; calendar tables restrict SELECT to the owning client or admin, writes are service-role only (`supabase/migrations/20260723132523_add_composio_calendar_integrations.sql`); server routes resolve the caller's own profile before any query; release tests assert client A cannot reach client B's connections; native push store denies browser roles entirely | Low |
| R2 | Processor compromise (Composio, Terra, Anthropic, Supabase, Vercel) | Low x High | Calendar OAuth tokens are held by Composio, not stored by AT CAPACITY; Terra webhooks are HMAC-verified with replay tolerance; secrets are server-only (no `NEXT_PUBLIC_` prefixes); disconnect revokes the Composio connected account. Pending: processor due-diligence record (DPAs, sub-processor lists, transfer terms) has not been compiled | Medium until the due-diligence record exists, then Low |
| R3 | Calendar over-collection: sensitive information in event titles; Google reads span all calendars on the connected account | Medium x Medium | Only the normalised minimum is persisted; private/confidential titles are stored as "Busy"; no descriptions, attendees or locations are stored; eight-day forward window; read-only scopes; Google Limited Use wording and the all-calendars read scope are disclosed in the policy. Remaining: titles that are sensitive but not marked private are stored verbatim; Google's tool reads every calendar on the account with `response_detail: "full"` in transit (only normalised fields are kept) | Medium-Low. Accepted for v1 with the transparency wording shipped |
| R4 | Retention creep: synced calendar events accumulate beyond the sync window; raw Terra payloads could be kept longer than needed | Medium x Medium | Stale calendar cleanup runs inside the current sync window; disconnect deletes all synced calendar events; account deletion cascades everything. Terra maintenance now purges raw `client_wearable_events` after 90 days by default, in bounded batches. Remaining: no scheduled purge of past calendar events kept for storm-warning history | Medium-Low for Terra after deployment; Medium for calendar until its window is agreed |
| R5 | AI exposure of health data: coaching context including cycle and wearable data sent to Anthropic; model output wrong or over-reaching | Medium x Medium | Context is scoped to the requesting client only; cycle context included only while tracking is enabled; prompts forbid diagnosis and instruct GP referral for concerning symptoms; AI is suggestion-only with no programme mutation; coaching-knowledge base is de-identified; usage metered per client; policy discloses AI processing and its limits | Medium-Low. Pending: confirm the Anthropic account is on terms with training disabled, and record it in the processor due-diligence file |
| R6 | Consent shortfall for special category data at optional connection points | Medium x Medium | Versioned, timestamped consultation consent exists (`health_cycle_v1`). Terra requires a separate unticked explicit notice that names Terra and links its end-user privacy policy, and records `wearable_connection_v2` before generating the provider widget. Calendar connection requires its just-in-time first-connect notice and records `calendar_connection_v1` before OAuth starts. Unsigned or unconsented integration mappings are not accepted | Low after deployment and real-device acceptance testing |
| R7 | Coach/admin access breadth: Gordy's admin role can read all client data; device or account compromise exposes everything | Low x High | Admin gated by role checks and `private.is_admin()` RLS; admin accounts cannot be deleted via the client API; Supabase leaked-password protection was enabled and the live security advisor returned no findings on 6 August 2026. Pending: consider enforcing MFA for the admin account | Medium-Low until the MFA decision is recorded, then Low |
| R8 | Ineffective wearable disconnect could allow later provider data to restore processing | Medium x Medium | Disconnect now calls Terra's deauthentication endpoint first; a 404 is treated as already deauthenticated; local status changes only after Terra succeeds; `deauth` and `access_revoked` webhooks disconnect; data for pending/error/disconnected rows is acknowledged without storage | Low after a real testing-environment disconnect/revocation acceptance run; that run remains a launch condition |
| R9 | Notification content exposure on lock screens | Low x Low | Notifications follow account-level pause/freeze suppression; payload fields are bounded server-side | Low |
| R10 | International transfers: US-based processors (Anthropic, OpenAI/OpenRouter, Vercel, Composio; Supabase region per project) | Medium x Low | Standard provider terms generally incorporate the UK IDTA/Addendum. Pending: confirm and record each processor's transfer mechanism in the due-diligence file | Medium-Low until recorded |
| R11 | Behavioural profiling by the storm-warning audit log: an accumulating record of a client's schedule pressure over time (added revision 2) | Low x Medium | Records hold counts, times and rule explanations only - no event content; deduplicated on input hash and capped at 30 rows per client per window; rules are deterministic with the triggering inputs logged, so every warning is explainable; visible only to the client (Founder mode) and admin; warnings are dismissible per window with dismissals validated server-side; no automated consequences - nothing alters training or nutrition | Low |
| R12 | Off-platform communications metadata: weekly WhatsApp-help records document that coaching contact happened outside the platform, which clients may not expect to be recorded (added revision 2) | Low x Medium | Weekly boolean granularity plus a short note (500-character limit); message content is never stored; admin-only with no client read surface; purpose is limited to guarantee compliance evidence; coaching-administration records are disclosed in the privacy policy | Low |
| R13 | Immutable audit records retain superseded health values: the baseline-override audit deliberately keeps the old health-metric values after an override, and completed Month 4 reviews freeze health snapshots (added revision 2) | Low x Medium | This is an intentional integrity control - a locked health baseline can never change silently; the override function is executable by the service role only, requires a written reason, and records actor and timestamp; audit rows are immutable by trigger; all rows cascade on account deletion, so erasure still works. Rectification requests are satisfied by the override itself (the corrected value becomes current); retaining the superseded value in the audit is justified as evidence of the change | Low |

## 6. Residual risk assessment

With the implemented controls, no risk is assessed as high residual. Terra's former R4/R6/R8 code gaps are addressed in the activation branch, subject to migration, deployment and a real testing-environment acceptance run. Calendar retention and the due-diligence record behind R2/R5/R10 remain open; the calendar connection notice is implemented subject to migration, deployment and acceptance testing. None requires prior consultation with the ICO.

The revision 2 additions (R11-R13) all land at low residual: they are in-platform only, introduce no new processor, feed no AI prompt, cascade on account deletion, and were covered by the independent security review of the merged diff. The coaching-administration transparency wording has shipped; action 9 is complete.

## 7. Action plan

| # | Action | Owner | When |
| --- | --- | --- | --- |
| 1 | Add connection-point consent/notice wording to the calendar and wearable connect screens; bump the consent version | Build team | **Terra completed 3 August 2026; calendar implemented 10 August 2026, deployment and acceptance pending** |
| 2 | Correct the privacy policy calendar wording: Google connections read all calendars on the connected account (there is no per-calendar selection) | Build team | **Completed 24 July 2026** |
| 3 | Implement and verify Terra-side deauthentication on disconnect | Build team | **Implemented 3 August 2026; real testing-environment verification pending** |
| 4 | Agree and implement bounded retention for past calendar events and raw wearable webhook payloads | Gordy + build team | **Terra defaults to 90 days in activation branch; calendar remains** |
| 5 | Compile the processor due-diligence record (DPAs, training-disabled AI terms, transfer mechanisms, sub-processors) | Kevin | Before launch |
| 6 | Enable Supabase leaked-password protection; consider admin MFA | Kevin | **Leaked-password protection completed 6 August 2026; admin MFA decision remains** |
| 7 | Run the real production calendar contract tests (Google and Outlook) and the Terra provider acceptance tests when gates open | Build team | Gate-dependent |
| 8 | Add controller identity and ICO complaint-right wording to the privacy policy | Build team (code change - see findings) | Before launch |
| 9 | Extend the privacy policy's "Information AT CAPACITY handles" wording to cover coaching-administration records: call attendance, weekly off-platform help logs, programme review snapshots and baseline-override audit records | Build team | **Completed 24 July 2026** |

## 8. Sign-off

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| Controller | Gordy Elliott | Pending | - |
| Platform operator | Kevin Harkin | Pending | - |

Sign-off confirms acceptance of the residual risks above and commitment to the action plan. Re-run this assessment when the review triggers at the top of this document occur.
