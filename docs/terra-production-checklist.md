# Terra Production Checklist

## Credentials and destination

- Set `TERRA_DEV_ID` and `TERRA_API_KEY` together in production.
- Set `TERRA_WEBHOOK_SIGNING_SECRET` from the Terra destination settings.
- Point Terra to `https://<final-domain>/api/integrations/terra/webhook`.
- Leave `TERRA_MOCK_MODE` unset in production. The application disables mock connections in production even if it is set accidentally.
- Keep all Terra secrets server-only; none use a `NEXT_PUBLIC_` prefix.

## Security contract

- Terra's raw request body is verified against the `terra-signature` HMAC-SHA256 header before JSON parsing.
- Timestamp tolerance defaults to 300 seconds and can be changed with `TERRA_WEBHOOK_TOLERANCE_SECONDS` only if Terra support requires it.
- Raw payloads are hashed for idempotency so retries do not duplicate event records.
- Client mapping uses `reference_id = client:<client_profile_id>` first, then the stored Terra user ID.
- Production rejects unsigned webhooks and never silently enables preview data.

Official references:

- https://docs.tryterra.co/health-and-fitness-api/integration-setup/setting-up-data-destinations/webhooks
- https://docs.tryterra.co/health-and-fitness-api/user-authentication/implementation-terra-widget
- https://docs.tryterra.co/health-and-fitness-api/user-authentication/handling-authentication-events

## Provider acceptance tests

- Garmin: authenticate, receive auth event, daily/activity/sleep payloads, reconnect and disconnect.
- Oura: authenticate, receive sleep/HRV/resting-heart-rate data and reconnect.
- MyFitnessPal: confirm it is enabled for Gordy's Terra account, then verify calories/macros/hydration payloads with a consenting test account.
- Confirm provider names from real payloads match stored connection keys.
- Replay the same signed payload and verify one raw event plus one set of daily summaries.
- Send a valid multi-day array and verify every date is updated.
- Confirm client A cannot access client B's connections or summaries.
- Confirm AI context is suggestion-only and no training-plan mutation is triggered.

## Known version 1 boundaries

- Local disconnect is implemented; call Terra's deauthentication endpoint after account credentials confirm final provider behaviour.
- Apple Health requires the later native Terra/HealthKit SDK phase and is not included in version 1.
- Flo is not treated as a supported provider without written confirmation and a successful Terra account-level test.
- Add webhook monitoring/alerts before onboarding real clients because Terra retries failed deliveries but can eventually drop them.
