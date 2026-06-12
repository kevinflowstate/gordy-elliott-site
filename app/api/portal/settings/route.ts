import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type KeyDateInput = {
  label?: string;
  date?: string;
  recurring?: boolean;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = user.id;

  const { fullName, phone, businessName, businessType, goals, dateOfBirth, keyDates } = await request.json();

  // Only update name if provided (prevents onboarding from blanking it)
  if (fullName) {
    await admin.from("users").update({ full_name: fullName }).eq("id", userId);
  }

  // Only update profile fields that were provided
  const profileUpdate: Record<string, string | null> = {};
  if (phone !== undefined) profileUpdate.phone = phone;
  if (businessName !== undefined) profileUpdate.business_name = businessName;
  if (businessType !== undefined) profileUpdate.business_type = businessType;
  if (goals !== undefined) profileUpdate.goals = goals;
  if (dateOfBirth !== undefined) profileUpdate.date_of_birth = dateOfBirth || null;

  if (Object.keys(profileUpdate).length > 0) {
    await admin.from("client_profiles").update(profileUpdate).eq("user_id", userId);
  }

  if (Array.isArray(keyDates)) {
    const { data: profile } = await admin
      .from("client_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (profile?.id) {
      await admin.from("client_key_dates").delete().eq("client_id", profile.id);
      const rows = (keyDates as KeyDateInput[])
        .map((item) => ({
          client_id: profile.id,
          label: item.label?.trim() || "",
          date: item.date || "",
          recurring: item.recurring !== false,
        }))
        .filter((item) => item.label && item.date);

      if (rows.length > 0) {
        await admin.from("client_key_dates").insert(rows);
      }
    }
  }

  return NextResponse.json({ success: true });
}
