import { requireAdmin } from "@/lib/admin-auth";
import { notifyClientUser } from "@/lib/client-notifications";
import { sendConsultationLinkEmail } from "@/lib/email-templates";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

function buildConsultationUrl(): string {
  const url = new URL("/portal/consultation", getSiteUrl());
  url.searchParams.set("setup", "true");
  return url.toString();
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { client_id } = await request.json();
  if (!client_id) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("client_profiles")
    .select("id, user_id, user:users!client_profiles_user_id_fkey(email, full_name)")
    .eq("id", client_id)
    .maybeSingle();

  const user = Array.isArray(profile?.user) ? profile?.user[0] : profile?.user;
  if (error || !profile?.user_id || !user?.email) {
    return NextResponse.json({ error: "Client email could not be resolved" }, { status: 404 });
  }

  const consultationUrl = buildConsultationUrl();
  const clientName = user.full_name || "there";
  const firstName = clientName.split(" ")[0] || "there";

  const notification = await notifyClientUser(profile.user_id, {
    title: "Complete your consultation",
    message: `Hi ${firstName}, Gordy has asked you to complete your consultation form.`,
    link: "/portal/consultation?setup=true",
    tag: "consultation-link",
  });

  let emailSent = false;
  if (!notification.suppressed) {
    try {
      await sendConsultationLinkEmail(user.email, clientName, consultationUrl);
      emailSent = true;
    } catch (sendError) {
      console.log("[CONSULTATION_LINK] Email send failed:", sendError instanceof Error ? sendError.message : sendError);
    }
  }

  return NextResponse.json({
    success: true,
    consultationUrl,
    emailSent,
    notification,
  });
}
