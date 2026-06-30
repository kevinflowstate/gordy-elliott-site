import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api-errors";
import { normalizeConsultationConfig } from "@/lib/consultation-form";
import { NextRequest, NextResponse } from "next/server";

const VALID_SEX_VALUES = ["female", "male", "prefer_not_to_say"];
const PROFILE_FIELD_IDS = new Set(["date_of_birth", "sex", "cycle_tracking_enabled"]);

function answerText(data: Record<string, unknown>, key: string) {
  const value = data[key];
  return typeof value === "string" ? value.trim() : "";
}

function buildFallbackSummary(data: Record<string, unknown>) {
  return {
    generated_by: "deterministic",
    generated_at: new Date().toISOString(),
    hierarchy: {
      you: answerText(data, "hierarchy_you"),
      past_experiences: answerText(data, "hierarchy_past"),
      now: answerText(data, "hierarchy_now"),
      support_networks: answerText(data, "hierarchy_support"),
      exercise_nutrition: answerText(data, "hierarchy_exercise_nutrition"),
    },
    coaching_profile: {
      primary_goal: answerText(data, "primary_goal"),
      fitness_level: answerText(data, "fitness_level"),
      training_days: answerText(data, "training_days"),
      equipment_access: answerText(data, "equipment_access"),
      dietary_preferences: answerText(data, "dietary_preferences"),
      injuries: answerText(data, "injuries"),
    },
    flags: {
      mentions_support_risk: /drag|negative|sabotage|pressure|stress|alone|isolat/i.test(answerText(data, "hierarchy_support")),
      mentions_injury_or_limitation: Boolean(answerText(data, "injuries")),
      prefers_lifestyle_nutrition: /lifestyle|flexible|balance|habit/i.test(answerText(data, "hierarchy_exercise_nutrition")),
      prefers_strict_nutrition: /strict|plan|rules|structure/i.test(answerText(data, "hierarchy_exercise_nutrition")),
    },
  };
}

async function extractConsultationSummary(data: Record<string, unknown>) {
  const fallback = buildFallbackSummary(data);
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return fallback;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://gordy-elliott-site.vercel.app",
        "X-Title": "Gordy Elliott Portal",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_CONSULTATION_MODEL || "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Extract a structured coaching profile from a client consultation. Return compact JSON only. Do not diagnose, label trauma, or make medical claims.",
          },
          {
            role: "user",
            content: JSON.stringify({
              required_shape: {
                generated_by: "openrouter",
                hierarchy: {
                  you: "summary of identity/values",
                  past_experiences: "summary of setbacks",
                  now: "summary of current reality",
                  support_networks: "support and drag factors",
                  exercise_nutrition: "preferences and approach",
                },
                coaching_profile: {
                  primary_goal: "goal",
                  fitness_level: "level",
                  training_days: "days",
                  equipment_access: "equipment",
                  dietary_preferences: "diet context",
                  injuries: "limitations",
                },
                flags: {
                  mentions_support_risk: true,
                  mentions_injury_or_limitation: true,
                  prefers_lifestyle_nutrition: true,
                  prefers_strict_nutrition: false,
                },
                coach_notes: ["short practical coaching notes"],
              },
              consultation_answers: data,
            }),
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) return fallback;
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") return fallback;
    const parsed = JSON.parse(content);
    return {
      ...fallback,
      ...parsed,
      generated_by: "openrouter",
      generated_at: new Date().toISOString(),
    };
  } catch {
    return fallback;
  }
}

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
    .select("consultation_data, consultation_summary, profile_setup_data, profile_setup_completed_at, wearables_preference, wearables_notes, phone, date_of_birth, sex, cycle_tracking_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    consultation_data: profile?.consultation_data || null,
    consultation_summary: profile?.consultation_summary || null,
    profile_setup_data: profile?.profile_setup_data || null,
    profile_setup_completed_at: profile?.profile_setup_completed_at || null,
    wearables_preference: profile?.wearables_preference || "",
    wearables_notes: profile?.wearables_notes || "",
    phone: profile?.phone || "",
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
  if (body.privacy_consent !== true) {
    return NextResponse.json({ error: "Privacy consent is required" }, { status: 400 });
  }

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
  consultationData.privacy_consent = true;
  consultationData.privacy_consent_version = "health_cycle_v1";
  consultationData.privacy_consent_at = new Date().toISOString();

  const updates: Record<string, unknown> = {
    consultation_data: consultationData,
    consultation_summary: await extractConsultationSummary(consultationData),
  };

  if (body.profile_setup && typeof body.profile_setup === "object") {
    const setup = body.profile_setup as Record<string, unknown>;
    updates.profile_setup_data = setup;
    updates.profile_setup_completed_at = new Date().toISOString();
    updates.phone = typeof setup.phone === "string" ? setup.phone.trim() || null : null;
    updates.wearables_preference = typeof setup.wearables_preference === "string" ? setup.wearables_preference : null;
    updates.wearables_notes = typeof setup.wearables_notes === "string" ? setup.wearables_notes.trim() || null : null;
  }

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
