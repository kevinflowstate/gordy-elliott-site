import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type KeyDateInput = {
  label?: string;
  date?: string;
  recurring?: boolean;
};

const VALID_SEX_VALUES = ["female", "male", "prefer_not_to_say"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = user.id;

  const { fullName, phone, businessName, businessType, goals, dateOfBirth, sex, cycleTrackingEnabled, keyDates } = await request.json();

  // Only update name if provided (prevents onboarding from blanking it)
  if (fullName) {
    await admin.from("users").update({ full_name: fullName }).eq("id", userId);
  }

  // Only update profile fields that were provided
  const profileUpdate: Record<string, string | boolean | null> = {};
  if (phone !== undefined) profileUpdate.phone = phone;
  if (businessName !== undefined) profileUpdate.business_name = businessName;
  if (businessType !== undefined) profileUpdate.business_type = businessType;
  if (goals !== undefined) profileUpdate.goals = goals;
  if (dateOfBirth !== undefined) profileUpdate.date_of_birth = dateOfBirth || null;
  if (sex !== undefined) {
    const nextSex = sex === "" ? null : sex;
    if (nextSex !== null && !VALID_SEX_VALUES.includes(nextSex)) {
      return NextResponse.json({ error: "Invalid sex value" }, { status: 400 });
    }
    profileUpdate.sex = nextSex;
    profileUpdate.cycle_tracking_enabled = nextSex === "female" ? Boolean(cycleTrackingEnabled) : false;
  } else if (cycleTrackingEnabled !== undefined) {
    const { data: currentProfile } = await admin
      .from("client_profiles")
      .select("sex")
      .eq("user_id", userId)
      .maybeSingle();
    profileUpdate.cycle_tracking_enabled = currentProfile?.sex === "female" ? Boolean(cycleTrackingEnabled) : false;
  }

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
