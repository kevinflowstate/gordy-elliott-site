import { buildAccountRecoveryUrl } from "@/lib/account-links";
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
    .select("email, full_name, role")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (!appUser?.email) {
    return NextResponse.json(GENERIC_RESPONSE);
  }

  try {
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: appUser.email,
    });
    const resetUrl = linkData?.properties?.hashed_token
      ? buildAccountRecoveryUrl(linkData.properties.hashed_token, "reset")
      : linkData?.properties?.action_link || null;

    if (resetUrl) {
      await sendPasswordResetEmail(appUser.email, appUser.full_name || "there", resetUrl);
    }
  } catch (error) {
    console.log("[PASSWORD_RESET] Reset email failed:", error instanceof Error ? error.message : error);
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
