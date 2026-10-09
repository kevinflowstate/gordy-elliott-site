import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";
import { dbError } from "@/lib/api-errors";
import { normalizeCheckinConfig, validateCheckinTemplate } from "@/lib/checkin-form";
import { normalizeConsultationConfig } from "@/lib/consultation-form";
import { NextResponse } from "next/server";

const VALID_FORM_TYPES = ["checkin", "business_plan", "consultation", "boardroom_consultation"];

function normalizeConfig(type: string, config: unknown) {
  if (type === "checkin") return normalizeCheckinConfig(config as Parameters<typeof normalizeCheckinConfig>[0]);
  if (type === "boardroom_consultation") return normalizeConsultationConfig(config as Parameters<typeof normalizeConsultationConfig>[0], "boardroom");
  if (type === "consultation") return normalizeConsultationConfig(config as Parameters<typeof normalizeConsultationConfig>[0]);
  return config;
}

function fallbackConfig(type: string) {
  if (type === "checkin") return normalizeCheckinConfig(null);
  if (type === "boardroom_consultation") return normalizeConsultationConfig(null, "boardroom");
  if (type === "consultation") return normalizeConsultationConfig(null);
  return { questions: [] };
}

export async function GET(request: Request) {
  // Form config is readable by any authenticated user (clients need it for check-in page)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (!type || !VALID_FORM_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid form type" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (type === "checkin") {
    const { data: templateData } = await admin
      .from("checkin_forms")
      .select("config")
      .eq("is_default", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (templateData?.config) {
      return NextResponse.json({ config: normalizeCheckinConfig(templateData.config) });
    }
  }

  const { data, error } = await admin
    .from("form_config")
    .select("config")
    .eq("form_type", type)
    .maybeSingle();

  if (error) {
    return dbError(error, "Couldn't load that form config. Try again.");
  }

  return NextResponse.json({ config: data?.config ? normalizeConfig(type, data.config) : fallbackConfig(type) });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { type, config } = await request.json();

  if (!type || !VALID_FORM_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid form type" }, { status: 400 });
  }

  if (!config) {
    return NextResponse.json({ error: "Config is required" }, { status: 400 });
  }

  if (type === "checkin") {
    const configError = validateCheckinTemplate(config);
    if (configError) return NextResponse.json({ error: configError }, { status: 400 });
    if (config.programme_type === "boardroom") return NextResponse.json({ error: "Business check-ins must be assigned personally, not used as the global default" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (type === "checkin") {
    const { data: existingTemplate } = await admin
      .from("checkin_forms")
      .select("id,config")
      .eq("is_default", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingTemplate?.id) {
      if (existingTemplate.config?.programme_type === "boardroom") {
        const { count, error: assignedError } = await admin.from("client_profiles").select("id", { count: "exact", head: true }).eq("checkin_form_id", existingTemplate.id);
        if (assignedError) return dbError(assignedError, "Couldn't verify this form's assignments");
        if ((count || 0) > 0) return NextResponse.json({ error: "Create a new form to change programme while this template has assigned clients" }, { status: 409 });
      }
      const { data, error } = await admin
        .from("checkin_forms")
        .update({ config: normalizeCheckinConfig(config), updated_at: new Date().toISOString() })
        .eq("id", existingTemplate.id)
        .select("config")
        .maybeSingle();

      if (error) {
        return dbError(error, "Couldn't save that form config. Try again.");
      }

      return NextResponse.json({ config: normalizeCheckinConfig(data?.config) });
    }
  }

  const normalizedConfig = normalizeConfig(type, config);
  const { data, error } = await admin
    .from("form_config")
    .upsert({ form_type: type, config: normalizedConfig, updated_at: new Date().toISOString() }, { onConflict: "form_type" })
    .select("config")
    .maybeSingle();

  if (error) {
    return dbError(error, "Couldn't save that form config. Try again.");
  }

  return NextResponse.json({ config: data?.config ? normalizeConfig(type, data.config) : normalizedConfig });
}
