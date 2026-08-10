import type { InboxMessage, UserRole } from "@/lib/types";

export function hasUnreadIncomingMessages(messages: InboxMessage[], viewerRole: UserRole) {
  return messages.some((message) => viewerRole === "admin"
    ? message.sender_role === "client" && !message.read_by_admin
    : message.sender_role === "admin" && !message.read_by_client
  );
}
