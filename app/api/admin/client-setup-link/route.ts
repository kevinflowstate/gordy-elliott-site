import { requireAdmin } from "@/lib/admin-auth";
import { buildAccountRecoveryUrl } from "@/lib/account-links";
import { sendWelcomeEmail } from "@/lib/email-templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { client_id, sendEmail } = await request.json();
  if (!client_id) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("client_profiles")
    .select("id, user_id, user:users!client_profiles_user_id_fkey(email, full_name, role)")
    .eq("id", client_id)
    .maybeSingle();

  const user = Array.isArray(profile?.user) ? profile?.user[0] : profile?.user;
  if (error || !profile?.user_id || !user?.email || user.role !== "client") {
    return NextResponse.json({ error: "Client account could not be resolved" }, { status: 404 });
  }

  const { data: authUser } = await admin.auth.admin.getUserById(profile.user_id);
  const existingMetadata = authUser?.user?.user_metadata || {};
  await admin.auth.admin.updateUserById(profile.user_id, {
    user_metadata: {
      ...existingMetadata,
      requires_password_setup: true,
    },
  });

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: user.email,
  });

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  const setupUrl = linkData?.properties?.hashed_token
    ? buildAccountRecoveryUrl(linkData.properties.hashed_token, "setup")
    : linkData?.properties?.action_link || null;

  if (!setupUrl) {
    return NextResponse.json({ error: "Could not generate setup link" }, { status: 500 });
  }

  let emailSent = false;
  if (sendEmail) {
    try {
      await sendWelcomeEmail(user.email, user.full_name || "there", setupUrl);
      emailSent = true;
    } catch (sendError) {
      console.log("[CLIENT_SETUP_LINK] Email send failed:", sendError instanceof Error ? sendError.message : sendError);
    }
  }

  return NextResponse.json({
    success: true,
    setupUrl,
    emailSent,
  });
}
