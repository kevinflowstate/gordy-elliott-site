import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api-errors";
import { normalizeConsultationConfig } from "@/lib/consultation-form";
import { NextRequest, NextResponse } from "next/server";

const VALID_SEX_VALUES = ["female", "male", "prefer_not_to_say"];
const PROFILE_FIELD_IDS = new Set(["date_of_birth", "sex", "cycle_tracking_enabled"]);

async function loadConsultationConfig(admin: ReturnType<typeof createAdminClient>) {
  const { data } = await admin
    .from("form_config")
    .select("config")
    .eq("form_type", "consultation")
    .maybeSingle();

  return normalizeConsultationConfig(data?.config);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const config = await loadConsultationConfig(admin);
  const { data: profile } = await admin
    .from("client_profiles")
    .select("consultation_data, date_of_birth, sex, cycle_tracking_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    consultation_data: profile?.consultation_data || null,
    date_of_birth: profile?.date_of_birth || "",
    sex: profile?.sex || "",
    cycle_tracking_enabled: Boolean(profile?.cycle_tracking_enabled),
    config,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();

  const admin = createAdminClient();
  const config = await loadConsultationConfig(admin);
  const enabledQuestions = config.questions.filter((question) => question.enabled !== false);
  const enabledIds = new Set(enabledQuestions.map((question) => question.id));
  const consultationData: Record<string, unknown> = {};
  for (const question of enabledQuestions) {
    if (!PROFILE_FIELD_IDS.has(question.id) && question.id in body) {
      consultationData[question.id] = body[question.id];
    }
  }

  const updates: Record<string, unknown> = {
    consultation_data: consultationData,
  };

  if (enabledIds.has("date_of_birth")) {
    updates.date_of_birth = typeof body.date_of_birth === "string" && body.date_of_birth ? body.date_of_birth : null;
  }

  if (enabledIds.has("sex")) {
    const nextSex = body.sex === "" || body.sex === undefined ? null : body.sex;
    if (nextSex !== null && !VALID_SEX_VALUES.includes(nextSex)) {
      return NextResponse.json({ error: "Invalid sex value" }, { status: 400 });
    }

    updates.sex = nextSex;
    updates.cycle_tracking_enabled =
      nextSex === "female" && enabledIds.has("cycle_tracking_enabled")
        ? Boolean(body.cycle_tracking_enabled)
        : false;
  }

  const { error } = await admin
    .from("client_profiles")
    .update(updates)
    .eq("user_id", user.id);

  if (error) {
    return dbError(error, "Couldn't save your consultation. Try again.");
  }

  return NextResponse.json({ success: true });
}
