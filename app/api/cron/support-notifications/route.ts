import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverSupportAlerts } from "@/lib/support-notifications";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.RESEND_API_KEY)
    return NextResponse.json({ error: "Support email is not configured" }, { status: 503 });
  const admin = createAdminClient();
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const result = await deliverSupportAlerts({
      pending: async () => {
        const { data, error } = await admin.from("support_reports")
          .select("id,reference,area,impact")
          .is("notification_sent_at", null)
          .order("created_at", { ascending: true }).limit(10);
        if (error) throw error;
        return data || [];
      },
      send: async (ticket, idempotencyKey) => {
        // The recipient and destination are fixed. Reporter content and private
        // screenshots stay in the authenticated queue, not email notifications.
        const { data, error } = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || "AT CAPACITY <info@onlinegordy.com>",
          to: "kevin@flowstatesystems.ai",
          subject: `AT CAPACITY app report ${ticket.reference}`,
          text: `A new app problem has been reported.\n\nReference: ${ticket.reference}\nArea: ${ticket.area}\nImpact: ${ticket.impact}\n\nReview the private queue: https://app.onlinegordy.com/admin/support\n\nCodex checks this queue separately for investigation.`,
        }, { idempotencyKey });
        if (error || !data?.id) throw new Error("Support email was not accepted");
        return data.id;
      },
      markSent: async (id, emailId) => {
        const { error } = await admin.from("support_reports")
          .update({ notification_sent_at: new Date().toISOString(), notification_email_id: emailId })
          .eq("id", id);
        if (error) throw error;
      },
    });
    return NextResponse.json(result, {
      status: result.failed.length ? 502 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Support notifications could not run" }, { status: 503 });
  }
}
