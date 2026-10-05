import { buildAccountRecoveryUrl } from "@/lib/account-links";
import { resolveClientLifecycleStatus } from "@/lib/client-attention";
import { sendPasswordResetEmail } from "@/lib/email-templates";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

const GENERIC_RESPONSE = {
  success: true,
  message: "If that email belongs to a portal account, a reset link will be sent.",
};

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limited = rateLimit(`password-reset:${ip}`, 5, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many reset requests. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limited.resetAt - Date.now()) / 1000)) } }
    );
  }

  const { email } = await request.json().catch(() => ({ email: "" }));
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: appUser } = await admin
    .from("users")
    .select("id, email, full_name, role")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (!appUser?.email) {
    return NextResponse.json(GENERIC_RESPONSE);
  }

  if (appUser.role === "client") {
    const { data: clientProfile, error: clientProfileError } = await admin
      .from("client_profiles")
      .select("lifecycle_status, lifecycle_resumes_at")
      .eq("user_id", appUser.id)
      .maybeSingle();

    if (clientProfileError || !clientProfile || resolveClientLifecycleStatus(
      clientProfile?.lifecycle_status,
      clientProfile?.lifecycle_resumes_at,
    ) === "access_frozen") {
      return NextResponse.json(GENERIC_RESPONSE);
    }
  }

  try {
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: appUser.email,
    });
    if (linkError || !linkData?.properties?.hashed_token || linkData.user?.id !== appUser.id) {
      throw new Error("Account link generation failed");
    }
    const setup = linkData.user.user_metadata?.requires_password_setup === true;
    const resetUrl = buildAccountRecoveryUrl(linkData.properties.hashed_token, setup ? "setup" : "reset");
    await sendPasswordResetEmail(appUser.email, appUser.full_name || "there", resetUrl, setup);
  } catch (error) {
    console.log("[PASSWORD_RESET] Reset email failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "We couldn't send a fresh link right now. Please try again shortly." }, { status: 503 });
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
