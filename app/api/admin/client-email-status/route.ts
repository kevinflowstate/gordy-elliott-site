import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailAttemptStatus, type EmailAttempt, type DeliveryEvent } from "@/lib/email-delivery";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const clientId = new URL(request.url).searchParams.get("client_id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) return NextResponse.json({ error: "Valid client_id is required" }, { status: 400 });
  const admin = createAdminClient();
  const { data: client, error: clientError } = await admin.from("client_profiles").select("id").eq("id", clientId).maybeSingle();
  if (clientError) return NextResponse.json({ error: "Could not load email tracking" }, { status: 503 });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const { data: attempts, error } = await admin.from("client_email_attempts")
    .select("id,kind,status,provider_email_id,created_at,accepted_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(20);
  if (error) return NextResponse.json({ error: "Email tracking is not available" }, { status: 503 });
  const emailIds = (attempts || []).map((attempt) => attempt.provider_email_id).filter(Boolean);
  let events: DeliveryEvent[] = [];
  if (emailIds.length) {
    const result = await admin.from("client_email_delivery_events").select("webhook_id,email_id,event_type,occurred_at").in("email_id", emailIds);
    if (result.error) return NextResponse.json({ error: "Email tracking is not available" }, { status: 503 });
    events = result.data as DeliveryEvent[];
  }
  return NextResponse.json({ webhookConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET),
    attempts: ((attempts || []) as EmailAttempt[]).map((attempt) => emailAttemptStatus(attempt, events)),
  }, { headers: { "Cache-Control": "no-store" } });
}
