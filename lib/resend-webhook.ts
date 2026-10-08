import { Resend } from "resend";
import { DELIVERY_EVENT_TYPES, type DeliveryEvent, type DeliveryEventType } from "./email-delivery";

export function verifyDeliveryWebhook(payload: string, headers: Headers, secret: string | undefined): DeliveryEvent | null {
  if (!secret) throw new Error("Email webhook is not configured");
  const webhookId = headers.get("svix-id") || "";
  const event = new Resend("webhook-verification-only").webhooks.verify({
    payload, webhookSecret: secret,
    headers: { id: webhookId, timestamp: headers.get("svix-timestamp") || "", signature: headers.get("svix-signature") || "" },
  });
  if (!DELIVERY_EVENT_TYPES.includes(event.type as DeliveryEventType)) return null;
  const data = event.data as { email_id?: unknown };
  if (!webhookId || webhookId.length > 200 || typeof data.email_id !== "string" || !/^[0-9a-f-]{36}$/i.test(data.email_id)
    || !event.created_at || !Number.isFinite(Date.parse(event.created_at))) throw new Error("Invalid email event");
  // Persist only the fields used for delivery tracking, never message content,
  // recovery tokens, recipient lists, or arbitrary provider error payloads.
  return { webhook_id: webhookId, email_id: data.email_id, event_type: event.type as DeliveryEventType, occurred_at: event.created_at };
}

