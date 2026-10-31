# Terra Production Checklist

## Credentials and destination

- Set `TERRA_DEV_ID` and `TERRA_API_KEY` together in production.
- Set `TERRA_WEBHOOK_SIGNING_SECRET` from the Terra destination settings.
- Set `TERRA_RAW_EVENT_RETENTION_DAYS` only if the approved window differs from the 90-day default (accepted range: 7-365).
- Point Terra to `https://<final-domain>/api/integrations/terra/webhook`.
- Leave `TERRA_MOCK_MODE` unset in production. The application disables mock connections in production even if it is set accidentally.
- Keep all Terra secrets server-only; none use a `NEXT_PUBLIC_` prefix.
- Keep `TERRA_WHOOP_ENABLED` unset until WHOOP credentials are configured in Terra and the real account acceptance test passes. Set it to `true` only when that gate is cleared.

## Security contract

- Terra's raw request body is verified against the `terra-signature` HMAC-SHA256 header before JSON parsing.
- Timestamp tolerance defaults to 300 seconds and can be changed with `TERRA_WEBHOOK_TOLERANCE_SECONDS` only if Terra support requires it.
- Raw payloads are hashed for idempotency so retries do not duplicate event records.
- Client mapping uses `reference_id = client:<client_profile_id>` first, then the stored Terra user ID.
- A webhook is accepted only for an approved launch provider with an existing, explicitly consented connection row.
- Only activity, daily, sleep and nutrition events enter storage; unused body, athlete and menstruation payloads are acknowledged and discarded.
- Healthchecks and informational lifecycle events are acknowledged without requiring a client mapping.
- `deauth` and `access_revoked` mark the connection disconnected. Delayed auth, error or data events cannot revive a disconnected row; only a new client-initiated session moves it back to pending so a fresh auth event can connect it.
- Production rejects unsigned webhooks and never silently enables preview data.
- The daily Terra maintenance cron deletes raw webhook payloads older than the configured retention window and reports error/stale connection counts to Vercel logs.

Official references:

- https://docs.tryterra.co/health-and-fitness-api/integration-setup/setting-up-data-destinations/webhooks
- https://docs.tryterra.co/health-and-fitness-api/user-authentication/implementation-terra-widget
- https://docs.tryterra.co/health-and-fitness-api/user-authentication/handling-authentication-events

## Provider acceptance tests

- Garmin: authenticate, receive auth event, daily/activity/sleep payloads, reconnect and disconnect.
- Oura: authenticate, receive sleep/HRV/resting-heart-rate data and reconnect.
- Fitbit: authenticate, receive daily/activity/sleep payloads, reconnect and disconnect.
- MyFitnessPal: confirm it is enabled for Gordy's Terra account, then verify calories/macros/hydration payloads with a consenting test account.
- WHOOP: register the Terra callback in the WHOOP developer app, configure its client ID and secret in Terra, then verify auth, sleep, recovery/HRV, strain, workouts, reconnect and disconnect with Gordy's live WHOOP membership.
- Confirm provider names from real payloads match stored connection keys.
- Replay the same signed payload and verify one raw event plus one set of daily summaries.
- Send a valid multi-day array and verify every date is updated.
- Confirm client A cannot access client B's connections or summaries.
- Confirm AI context is suggestion-only and no training-plan mutation is triggered.
- Send a Terra healthcheck and verify an immediate 200 response.
- Revoke access in the provider account and verify `access_revoked` leaves the connection disconnected.
- Verify a delayed data event after disconnect is acknowledged without storing a raw event or summary.
- Verify the Terra `DELETE /v2/auth/deauthenticateUser` call completes before the local row is marked disconnected.

## Launch provider boundary

- The backend launch allowlist is Garmin, Oura, Fitbit, MyFitnessPal and WHOOP. Each widget session is restricted to the app selected by the client.
- WHOOP remains hidden and its session route rejects connections until `TERRA_WHOOP_ENABLED=true`; enable it only after provider credentials and the account-level acceptance test are complete.
- Strava remains disabled until its provider credentials and account-level tests are complete.
- Apple Health requires the later native Terra/HealthKit SDK phase and is not included in version 1.
- Flo is not treated as a supported provider without written confirmation and a successful Terra account-level test.
- Terra-side deauthentication, revocation handling and local non-reconnection are implemented but still require a real testing-environment acceptance run.
- Vercel maintenance logging is implemented; configure an operational alert from Terra payload history or Vercel logs before onboarding real clients.

## Provider state, 30 October 2026
Garmin is paused upstream and absent from Terra Sources. TERRA_GARMIN_ENABLED stays unset; keep historical webhooks supported. WHOOP uses the company app at whoop-prod.onlinegordy.com with v2 webhook https://whoop-prod.onlinegordy.com/hooks/whoop/push and five read scopes. Keep TERRA_WHOOP_ENABLED=false until owner verification and non-empty real readings pass. Do not enable either flag as part of hygiene deployment.

## Native SDK release candidate
Apple Health and Health Connect require the TerraHealth plugin in iOS1.0.2(13)/Android1.0.1(3). Web/older builds show the phone-app instruction. TerraiOS1.9.4 and TerraAndroid1.7.4 are pinned stable releases (the registries also offer2.0.0-beta.1). Android minimum is nowAPI28. HEALTH_CONNECT is the exact resource in the1.7.4 SDK enum; no live phone payload observed yet. SDK tokens remain server-generated and single-use; reconcile verifies reference/provider remotely. A native permission success alone is not proof of readings. New binaries use the hosted production URL; the new web/API flow requires the Phase C PR to merge. Perform device acceptance after that merge before store submission.
