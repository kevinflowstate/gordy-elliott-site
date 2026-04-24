import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";
import { normalizeCheckinConfig } from "@/lib/checkin-form";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Form config is readable by any authenticated user (clients need it for check-in page)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (!type || !["checkin", "business_plan"].includes(type)) {
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
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config: data.config });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { type, config } = await request.json();

  if (!type || !["checkin", "business_plan"].includes(type)) {
    return NextResponse.json({ error: "Invalid form type" }, { status: 400 });
  }

  if (!config) {
    return NextResponse.json({ error: "Config is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (type === "checkin") {
    const { data: existingTemplate } = await admin
      .from("checkin_forms")
      .select("id")
      .eq("is_default", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingTemplate?.id) {
      const { data, error } = await admin
        .from("checkin_forms")
        .update({ config: normalizeCheckinConfig(config), updated_at: new Date().toISOString() })
        .eq("id", existingTemplate.id)
        .select("config")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ config: normalizeCheckinConfig(data.config) });
    }
  }

  const { data, error } = await admin
    .from("form_config")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("form_type", type)
    .select("config")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config: data.config });
}
