# AT CAPACITY - Data Protection Impact Assessment

| | |
| --- | --- |
| Product | AT CAPACITY by Gordy Elliott (web, PWA and iOS shell) |
| Version assessed | v1 release candidate, branch state of 24 July 2026 |
| Status | DRAFT - awaiting controller sign-off |
| Author | Prepared by the Flowstate build team from the production code |
| Review trigger | Any new processor, new data category, AI scope change, or the Terra/Google gates completing |

This DPIA is proportionate to a single-coach platform with a small, invitation-only client base. It covers the two processing activities that most warrant assessment under UK GDPR: health data (special category) and connected calendar data. Facts are grounded in the code paths cited; where a control is planned but not yet verified, it is labelled as pending.

## 1. Description of processing

AT CAPACITY is a private coaching platform for existing clients of Gordy Elliott. Clients sign in to a portal (web, PWA or the iOS shell, which loads the hosted portal). There are two client experiences: Founder Dashboard (higher tier, coached directly by Gordy over WhatsApp and calls) and AI Coaching (in-app DM with Gordy plus an AI assistant).

Personal data processed:

- Account and contact details, consultation answers, goals, date of birth and sex.
- Health data (special category): injuries, health context, daily wellbeing metrics, body measurements, progress photos, optional cycle tracking (settings and daily entries), and, once Terra is live, wearable summaries (sleep, HRV, resting heart rate, activity, nutrition).
- Calendar data (optional, Founder-focused): read-only synced copies of events for today plus seven days - event identifiers, title (private/confidential titles stored as "Busy"), start/end times, all-day and busy status, and a meeting link. No descriptions, attendees or locations are stored (`lib/composio/normalise.ts`).
- Communications: in-app DMs, check-ins, and coaching notes ingested by Gordy from call/Zoom/Loom/Fathom/WhatsApp/email/voice-note transcripts.
- Operational data: push identifiers, AI usage metering, logins and server logs.

Data flows and recipients:

- Storage and access control: Supabase (database, auth, private storage) with row-level security; hosting on Vercel.
- Calendar: client-initiated OAuth handled by Composio as processor. Reads use Composio tool calls (`GOOGLECALENDAR_EVENTS_LIST_ALL_CALENDARS`, `OUTLOOK_GET_CALENDAR_VIEW`) on a schedule (`app/api/cron/calendar-sync/route.ts`, bearer-secret protected) and on demand. Only the normalised minimum is persisted.
- Wearables: Terra as processor. Signed webhooks (HMAC-SHA256 with timestamp tolerance and idempotency hashing) deliver provider payloads; raw events and normalised daily summaries are stored per client.
- AI: coaching context is sent per request to Anthropic; query text is embedded via OpenAI or OpenRouter for retrieval over a de-identified coaching-knowledge base. Calendar data is not sent to AI. AI output is suggestion-only and never changes a programme automatically.
- Push: Apple APNs and web-push services receive device identifiers and notification payloads.

Retention: data is retained for the life of the account; clients can permanently delete their account from Settings (`app/api/portal/account/route.ts` removes uploads, then deletes the auth user so client-owned rows cascade). Calendar disconnect revokes the Composio connected account and deletes the synced event copies. Wearable disconnect is currently local-only (see risk R8).

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

Consent mechanism as implemented: the consultation form includes an unticked-by-default checkbox stating the form may include health, training, nutrition, injury and cycle-related information and how Gordy will use it. The server rejects submission without it and stores `privacy_consent`, `privacy_consent_version` (`health_cycle_v1`) and a timestamp (`app/api/portal/consultation/route.ts`). Withdrawing consent is effected by disabling the feature, disconnecting the provider, or deleting the account.

Gaps to close before launch (action plan): the consent wording predates the calendar and Terra connection screens; each connection screen should state what is read and stored at the point of connection, and the consent version should be bumped when wording changes.

## 4. Consultation

The client base is small, closed and personally known to the controller. No formal data-subject consultation has been run; the Founding Five pilot functions as the feedback channel. Clients can raise privacy questions through DM, WhatsApp or the public support page.

## 5. Risks and mitigations

Scoring: likelihood x severity, each low/medium/high, judged for this product's scale (tens of clients, one coach).

| Ref | Risk | Initial | Implemented mitigations (with evidence) | Residual |
| --- | --- | --- | --- | --- |
| R1 | Cross-client leakage: one client sees another's health or calendar data | Low x High | Supabase RLS on all client tables; calendar tables restrict SELECT to the owning client or admin, writes are service-role only (`supabase/migrations/20260723153000_add_composio_calendar_integrations.sql`); server routes resolve the caller's own profile before any query; release tests assert client A cannot reach client B's connections; native push store denies browser roles entirely | Low |
| R2 | Processor compromise (Composio, Terra, Anthropic, Supabase, Vercel) | Low x High | Calendar OAuth tokens are held by Composio, not stored by AT CAPACITY; Terra webhooks are HMAC-verified with replay tolerance; secrets are server-only (no `NEXT_PUBLIC_` prefixes); disconnect revokes the Composio connected account. Pending: processor due-diligence record (DPAs, sub-processor lists, transfer terms) has not been compiled | Medium until the due-diligence record exists, then Low |
| R3 | Calendar over-collection: sensitive information in event titles; Google reads span all calendars on the connected account | Medium x Medium | Only the normalised minimum is persisted; private/confidential titles are stored as "Busy"; no descriptions, attendees or locations are stored; eight-day forward window; read-only scopes; Google Limited Use wording in the policy. Not mitigated: titles that are sensitive but not marked private are stored verbatim; Google's tool reads every calendar on the account with `response_detail: "full"` in transit (only normalised fields are kept) | Medium-Low. Accepted for v1 with the policy wording fix in the action plan |
| R4 | Retention creep: synced calendar events accumulate beyond the sync window; raw Terra webhook payloads retained indefinitely | Medium x Medium | Stale-event cleanup runs inside the current sync window; disconnect deletes all synced events; account deletion cascades everything. Not mitigated: no scheduled purge of past calendar events (kept for storm-warning density history) or of raw `client_wearable_events` payloads | Medium. Action: agree bounded retention (e.g. purge calendar events and raw wearable events older than an agreed window) |
| R5 | AI exposure of health data: coaching context including cycle and wearable data sent to Anthropic; model output wrong or over-reaching | Medium x Medium | Context is scoped to the requesting client only; cycle context included only while tracking is enabled; prompts forbid diagnosis and instruct GP referral for concerning symptoms; AI is suggestion-only with no programme mutation; coaching-knowledge base is de-identified; usage metered per client; policy discloses AI processing and its limits | Medium-Low. Pending: confirm the Anthropic account is on terms with training disabled, and record it in the processor due-diligence file |
| R6 | Consent shortfall for special category data: consent wording predates calendar/wearable connections; version not yet refreshed | Medium x Medium | Versioned, timestamped explicit consent exists (`health_cycle_v1`); connections are separately client-initiated (a real act of choice); policy describes each connection | Medium until connection-point consent wording ships (action plan), then Low |
| R7 | Coach/admin access breadth: Gordy's admin role can read all client data; device or account compromise exposes everything | Low x High | Admin gated by role checks and `private.is_admin()` RLS; admin accounts cannot be deleted via the client API; Supabase leaked-password protection is a known pending toggle (release audit). Pending: leaked-password protection on; consider enforcing MFA for the admin account | Medium until the auth hardening items land, then Low |
| R8 | Ineffective wearable disconnect: local disconnect does not call Terra's deauthentication endpoint; a later data webhook from the still-authorised provider will upsert the connection back to "connected" and resume storing summaries (`app/api/portal/integrations/[connectionId]/disconnect/route.ts` vs `app/api/integrations/terra/webhook/route.ts`) | Medium x Medium (currently theoretical - no production Terra credentials) | Terra checklist already requires calling the deauthentication endpoint once production credentials exist; policy honestly states already-received data may remain | Medium until Terra deauth is implemented and verified; this is a launch condition for advertising wearables |
| R9 | Notification content exposure on lock screens | Low x Low | Notifications follow account-level pause/freeze suppression; payload fields are bounded server-side | Low |
| R10 | International transfers: US-based processors (Anthropic, OpenAI/OpenRouter, Vercel, Composio; Supabase region per project) | Medium x Low | Standard provider terms generally incorporate the UK IDTA/Addendum. Pending: confirm and record each processor's transfer mechanism in the due-diligence file | Medium-Low until recorded |

## 6. Residual risk assessment

With the implemented controls, no risk is assessed as high residual. The residual mediums (R4 retention, R6 consent wording, R8 Terra disconnect, and the due-diligence record behind R2/R5/R10) are all addressable through the action plan below and none requires prior consultation with the ICO. The externally gated items do not change this picture, because the gated features (Google Calendar for the general client base; Terra wearables) do not process real client data until their gates open.

## 7. Action plan

| # | Action | Owner | When |
| --- | --- | --- | --- |
| 1 | Add connection-point consent/notice wording to the calendar and wearable connect screens; bump the consent version | Build team | Before Founder pilot onboarding |
| 2 | Correct the privacy policy calendar wording: Google connections read all calendars on the connected account (there is no per-calendar selection) | Build team (code change - see findings) | Before Google-connected clients onboard |
| 3 | Implement and verify Terra-side deauthentication on disconnect | Build team | Before wearables are advertised (after credentials) |
| 4 | Agree and implement bounded retention for past calendar events and raw wearable webhook payloads | Gordy + build team | Before or shortly after launch |
| 5 | Compile the processor due-diligence record (DPAs, training-disabled AI terms, transfer mechanisms, sub-processors) | Kevin | Before launch |
| 6 | Enable Supabase leaked-password protection; consider admin MFA | Kevin | Before launch |
| 7 | Run the real production calendar contract tests (Google and Outlook) and the Terra provider acceptance tests when gates open | Build team | Gate-dependent |
| 8 | Add controller identity and ICO complaint-right wording to the privacy policy | Build team (code change - see findings) | Before launch |

## 8. Sign-off

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| Controller | Gordy Elliott | Pending | - |
| Platform operator | Kevin Harkin | Pending | - |

Sign-off confirms acceptance of the residual risks above and commitment to the action plan. Re-run this assessment when the review triggers at the top of this document occur.
