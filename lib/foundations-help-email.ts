// Existing sender identity verified from the client-record Gmail source16Sep2026.
export const FOUNDATIONS_HELP_EMAIL = 'gordon_elliott@icloud.com';
import { FOUNDATIONS_HELP_PREFIX } from './foundations-help';
export function foundationsHelpEmail(ticket: {
    id: string;
    client_id: string;
    client_name: string;
    client_email: string;
    kind: string;
    message: string;
    created_at: string;
}) {
    const reference = `FND-${ticket.id.slice(0, 8).toUpperCase()}`;
    return { subject: `${FOUNDATIONS_HELP_PREFIX} ${reference} · ${ticket.kind}`, replyTo: ticket.client_email,
        text: `Foundations help request\nReference: ${reference}\nClient: ${ticket.client_name}\nEmail: ${ticket.client_email}\nClient ID: ${ticket.client_id}\nSubmitted: ${ticket.created_at}\nType: ${ticket.kind}\n\nClient-provided message:\n${ticket.message}\n\nThis is an app/access or getting-unstuck request, separate from monthly coaching feedback. Reply directly to the client using Reply-To.\nClient record: https://app.onlinegordy.com/admin/clients/${ticket.client_id}` };
}
