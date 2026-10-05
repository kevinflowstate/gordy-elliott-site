export interface SupportAlert {
  id: string;
  reference: string;
  area: string;
  impact: string;
}

export async function deliverSupportAlerts(deps: {
  pending: () => Promise<SupportAlert[]>;
  send: (ticket: SupportAlert, idempotencyKey: string) => Promise<string>;
  markSent: (id: string, emailId: string) => Promise<void>;
}) {
  const tickets = await deps.pending();
  let sent = 0;
  const failed: string[] = [];
  for (const ticket of tickets) {
    try {
      // A retry after a successful send but failed database write reuses the
      // provider's idempotency key instead of creating another email.
      const emailId = await deps.send(ticket, `support-alert-${ticket.id}`);
      await deps.markSent(ticket.id, emailId);
      sent += 1;
    } catch {
      failed.push(ticket.reference);
    }
  }
  return { checked: tickets.length, sent, failed };
}
