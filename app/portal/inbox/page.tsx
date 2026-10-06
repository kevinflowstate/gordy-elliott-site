import { Suspense } from "react";
import ClientInboxClient from "@/components/inbox/ClientInboxClient";

export default function PortalInboxPage() {
  return <Suspense fallback={<div className="text-sm text-text-muted">Loading DMs…</div>}><ClientInboxClient /></Suspense>;
}
