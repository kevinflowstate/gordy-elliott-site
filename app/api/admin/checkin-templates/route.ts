import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { dbError } from "@/lib/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCheckinConfig, validateCheckinTemplate } from "@/lib/checkin-form";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("checkin_forms")
    .select("id, name, description, config, is_default, created_at, updated_at")
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    return dbError(error, "Couldn't load check-in forms. Try again.");
  }

  // Assignment counts so Gordy can see which templates are in use before editing/deleting
  const { data: assignments } = await admin
    .from("client_profiles")
    .select("checkin_form_id");
  const assignmentCounts = new Map<string, number>();
  for (const row of assignments || []) {
    if (row.checkin_form_id) {
      assignmentCounts.set(row.checkin_form_id, (assignmentCounts.get(row.checkin_form_id) || 0) + 1);
    }
  }

  const templates = (data || []).map((template) => ({
    ...template,
    config: normalizeCheckinConfig(template.config),
    assigned_client_count: assignmentCounts.get(template.id) || 0,
  }));

  return NextResponse.json({
    templates,
    defaultTemplateId: templates.find((template) => template.is_default)?.id || null,
  });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Template id is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Block deleting a template with clients still assigned to it
  const { count: assignedCount } = await admin
    .from("client_profiles")
    .select("id", { count: "exact", head: true })
    .eq("checkin_form_id", id);

  if ((assignedCount || 0) > 0) {
    return NextResponse.json(
      { error: `This template is still assigned to ${assignedCount} client${assignedCount === 1 ? "" : "s"}. Reassign them first.` },
      { status: 409 },
    );
  }

  // Block deleting the default template — always keep one
  const { data: existing } = await admin
    .from("checkin_forms")
    .select("is_default")
    .eq("id", id)
    .maybeSingle();
  if (existing?.is_default) {
    return NextResponse.json(
      { error: "You can't delete the default template. Mark another one as default first." },
      { status: 409 },
    );
  }

  // Null out any check-ins that referenced this template so deletion isn't blocked
  await admin.from("checkins").update({ checkin_form_id: null }).eq("checkin_form_id", id);

  const { error } = await admin.from("checkin_forms").delete().eq("id", id);
  if (error) {
    return dbError(error, "Couldn't delete that check-in form. Try again.");
  }

  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { name, description, config, is_default } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Template name is required" }, { status: 400 });
  }

  const configError = config ? validateCheckinTemplate(config) : null;
  if (configError) return NextResponse.json({ error: configError }, { status: 400 });
  if (is_default && config?.programme_type === "boardroom") return NextResponse.json({ error: "Business check-ins must be assigned personally, not used as the global default" }, { status: 400 });
  const admin = createAdminClient();

  if (is_default) {
    await admin.from("checkin_forms").update({ is_default: false }).neq("id", "");
  }

  const { data, error } = await admin
    .from("checkin_forms")
    .insert({
      name: name.trim(),
      description: description?.trim() || "",
      config: normalizeCheckinConfig(config),
      is_default: Boolean(is_default),
    })
    .select("id, name, description, config, is_default, created_at, updated_at")
    .maybeSingle();

  if (error || !data) {
    return dbError(error, "Couldn't create that check-in form. Try again.");
  }

  return NextResponse.json({ template: { ...data, config: normalizeCheckinConfig(data.config) } });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id, name, description, config, is_default } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Template id is required" }, { status: 400 });
  }

  const configError = config ? validateCheckinTemplate(config) : null;
  if (configError) return NextResponse.json({ error: configError }, { status: 400 });
  const admin = createAdminClient();
  const { data: existing } = await admin.from("checkin_forms").select("config, is_default").eq("id", id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  const nextConfig = config || existing.config;
  if (config && (config.programme_type === "boardroom") !== (existing.config?.programme_type === "boardroom")) {
    const { count, error: assignedError } = await admin.from("client_profiles").select("id", { count: "exact", head: true }).eq("checkin_form_id", id);
    if (assignedError) return dbError(assignedError, "Couldn't verify this form's assignments");
    if ((count || 0) > 0) return NextResponse.json({ error: "Create a new form to change programme while this template has assigned clients" }, { status: 409 });
  }
  if ((is_default ?? existing.is_default) && nextConfig?.programme_type === "boardroom") return NextResponse.json({ error: "Business check-ins must be assigned personally, not used as the global default" }, { status: 400 });
  if (is_default) {
    await admin.from("checkin_forms").update({ is_default: false }).neq("id", id);
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof name === "string") updates.name = name.trim();
  if (typeof description === "string") updates.description = description.trim();
  if (config) updates.config = normalizeCheckinConfig(config);
  if (typeof is_default === "boolean") updates.is_default = is_default;

  const { data, error } = await admin
    .from("checkin_forms")
    .update(updates)
    .eq("id", id)
    .select("id, name, description, config, is_default, created_at, updated_at")
    .maybeSingle();

  if (error || !data) {
    return dbError(error, "Couldn't save that check-in form. Try again.");
  }

  return NextResponse.json({ template: { ...data, config: normalizeCheckinConfig(data.config) } });
}
