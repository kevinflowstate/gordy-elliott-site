export type EmailKind = "setup" | "password_reset" | "migration" | "consultation";
export type EmailSendState = "sending" | "accepted" | "failed" | "unknown";
export type EmailDeliveryState = EmailSendState | "delivered" | "delivery_delayed" | "bounced" | "complained" | "suppressed";
export const DELIVERY_EVENT_TYPES = ["email.sent", "email.delivered", "email.delivery_delayed", "email.bounced", "email.complained", "email.failed", "email.suppressed"] as const;
export type DeliveryEventType = typeof DELIVERY_EVENT_TYPES[number];
export type DeliveryEvent = { webhook_id: string; email_id: string; event_type: DeliveryEventType; occurred_at: string };
export type EmailAttempt = { id: string; kind: EmailKind; status: EmailSendState; provider_email_id: string | null; created_at: string; accepted_at: string | null };

// A later sent/delayed event must never erase a terminal outcome. A bounce or
// complaint remains actionable even if a delayed delivery webhook arrives later.
const EVENT_RANK: Record<DeliveryEventType, number> = {
  "email.sent": 1, "email.delivery_delayed": 2, "email.delivered": 3,
  "email.failed": 4, "email.suppressed": 5, "email.bounced": 6, "email.complained": 7,
};

export function emailAttemptStatus(attempt: EmailAttempt, events: DeliveryEvent[]) {
  const matching = events.filter((event) => event.email_id === attempt.provider_email_id);
  const outcome = matching.sort((a, b) => EVENT_RANK[b.event_type] - EVENT_RANK[a.event_type]
    || Date.parse(b.occurred_at) - Date.parse(a.occurred_at) || b.webhook_id.localeCompare(a.webhook_id))[0];
  const status: EmailDeliveryState = outcome
    ? outcome.event_type === "email.sent" ? "accepted" : outcome.event_type.slice(6) as EmailDeliveryState
    : attempt.status;
  return { ...attempt, status, status_at: outcome?.occurred_at || attempt.accepted_at || attempt.created_at,
    delivery_verified: matching.some((event) => event.event_type === "email.delivered"),
  };
}

export const EMAIL_STATUS_LABELS: Record<EmailDeliveryState, string> = {
  sending: "Acceptance not confirmed", accepted: "Accepted — delivery unconfirmed",
  unknown: "Acceptance uncertain", delivered: "Delivered to mail server",
  delivery_delayed: "Delivery delayed", bounced: "Bounced", complained: "Marked as spam",
  suppressed: "Suppressed by provider", failed: "Failed",
};
