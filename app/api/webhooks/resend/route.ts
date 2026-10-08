import { NextResponse } from "next/server";
import { verifyDeliveryWebhook } from "@/lib/resend-webhook";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!process.env.RESEND_WEBHOOK_SECRET) return NextResponse.json({ error: "Webhook unavailable" }, { status: 503 });
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > 65536) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const payload = await request.text();
  if (Buffer.byteLength(payload) > 65536) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  let event;
  try { event = verifyDeliveryWebhook(payload, request.headers, process.env.RESEND_WEBHOOK_SECRET); }
  catch { return NextResponse.json({ error: "Invalid webhook" }, { status: 400 }); }
  if (!event) return NextResponse.json({ received: true });
  const { error } = await createAdminClient().from("client_email_delivery_events").upsert(event, {
    onConflict: "webhook_id", ignoreDuplicates: true,
  });
  if (error) return NextResponse.json({ error: "Tracking temporarily unavailable" }, { status: 503 });
  return NextResponse.json({ received: true });
}
