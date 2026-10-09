# Capacity Boardroom

Boardroom uses the existing invitations, client accounts, direct consultation link and coach inbox. Select **CAPACITY BOARDROOM** before inviting a client. The authenticated client profile chooses the consultation automatically; a URL parameter cannot choose another programme.

## Coach workflow

1. Invite as Boardroom, or change an existing client's programme deliberately. Crossing between business and fitness clears the previous check-in assignment; fitness-to-fitness programme changes retain it.
2. Review the business consultation in the client page. Edit the separate **Boardroom Consultation** in Form Builder when needed.
3. Use **Customise for [client]** to prepare a personal business check-in. Add the client's actual measures and questions. Review it, then save/assign it. An unassigned client sees a preparation message, never a fitness fallback.
4. On the client's dashboard, create their business plan. Default length is 90 days; title, dates, milestones and actions are editable. Pasted agreed action points from Fathom become an editable draft. This does not fetch recordings or invoke an AI service.
5. Switch on full access using the existing Go Live control after preparing their setup. Coach and client can tick actions and save action notes. Create a new block to retain the old plan history.

Completed actions and notes survive structural plan edits. Removing an action with recorded progress is rejected: keep it or create a new block. The previous active block is archived only when its replacement saves successfully. Retries setting an action completed do not toggle it back. A stale draft cannot reactivate a completed block or replace a newer one. Disabled mood fields stay internal and are not presented as client answers.

## Existing authenticated admin API

These endpoints require the coach's existing signed-in admin session. They are not public integrations; no service-role/API key should be shared with a third-party assistant.

- `GET /api/admin/clients/{clientId}` — includes programme, consultation answers/summary, submitted check-ins and plans.
- `GET /api/admin/form-config?type=boardroom_consultation` and `PUT /api/admin/form-config` with `{ "type": "boardroom_consultation", "config": { ... } }` — separate consultation configuration.
- `GET /api/admin/checkin-templates` — template IDs/configs and assignment counts.
- `POST /api/admin/checkin-templates` — create a draft, with `name`, `description`, `is_default:false` and `config.programme_type:"boardroom"`.
- `PATCH /api/admin/checkin-templates` — edit by `id`; preserve question/metric IDs for the same measure. Changing units creates a separate trend series.
- `PATCH /api/admin/clients/{clientId}` with `{ "checkin_form_id": "template-uuid" }` — the explicit assignment/approval step for one client.
- `POST /api/admin/business-plans` with `{ "plan": { ... } }` — atomic plan save. Preserve plan, phase and item IDs when editing. Consult `lib/business-plans.ts` for the validated payload.
- `POST /api/admin/business-plans` with `{ "action":"update_item", "client_id":"client-uuid", "item_id":"item-uuid", "completed":true }` or `notes` — explicit progress/note update.

Progress metrics support `kind` values `money`, `count`, `hours`, `percentage`, `score` and `number`. Use `type:"number"` for numerical measures and `type:"scale"` for 1–10 scores, plus a stable `id`, `label`, `enabled:true` and optional `required:true`. Monetary values are GBP; counts must be whole/nonnegative, hours nonnegative, percentages 0–100, and scores whole 1–10. Zero is a valid submitted value. Each submission snapshots its form, preserving old labels and units after later changes or removal. The client page sends `config_revision` from its authenticated GET response. Stale open forms are rejected with a reload instruction; edits of a submitted business check-in use its original schema.

Client plan and progress APIs derive ownership from the authenticated user. Private documents retain the existing client-owned storage restrictions. Boardroom has no fitness AI entitlement or predefined call-booking quota. Business coaching metrics replace body/fitness sections; existing fitness programmes retain their experience. Existing modules are not automatically assigned to Boardroom.

New client Boardroom AI, a wider wins/dashboard system, automated Fathom import and native store submission are outside this change.
