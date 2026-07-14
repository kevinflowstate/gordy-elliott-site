import { Suspense } from "react";
import AdminInboxClient from "@/components/inbox/AdminInboxClient";

export default function AdminInboxPage() {
  return (
    <Suspense fallback={<div className="text-sm text-text-muted">Loading DMs...</div>}>
      <AdminInboxClient />
    </Suspense>
  );
}
