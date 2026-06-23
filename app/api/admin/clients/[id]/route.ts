import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { dbError } from "@/lib/api-errors";
import { getClientById } from "@/lib/admin-data";
import { NextResponse } from "next/server";

const VALID_TIERS = ["coached", "premium", "vip", "ai_only"];
const VALID_SEX_VALUES = ["female", "male", "prefer_not_to_say"];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const client = await getClientById(id);

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json({ client });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();

  // Only allow safe profile fields to be patched
  const allowed = ["checkin_day", "checkin_form_id", "coach_notes", "start_weight", "tier", "date_of_birth", "sex", "cycle_tracking_enabled"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  // Validate tier value if present
  if ("tier" in updates && !VALID_TIERS.includes(String(updates.tier))) {
    return NextResponse.json({ error: "Invalid tier value" }, { status: 400 });
  }

  if ("sex" in updates) {
    if (updates.sex === "") updates.sex = null;
    if (updates.sex !== null && !VALID_SEX_VALUES.includes(String(updates.sex))) {
      return NextResponse.json({ error: "Invalid sex value" }, { status: 400 });
    }
  }

  if ("cycle_tracking_enabled" in updates) {
    const sexForEligibility = updates.sex === undefined
      ? await createAdminClient()
          .from("client_profiles")
          .select("sex")
          .eq("id", id)
          .maybeSingle()
          .then(({ data }) => data?.sex || null)
      : updates.sex;

    updates.cycle_tracking_enabled = sexForEligibility === "female"
      ? Boolean(updates.cycle_tracking_enabled)
      : false;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("client_profiles")
    .update(updates)
    .eq("id", id);

  if (error) {
    return dbError(error, "Couldn't update that client. Try again.");
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { user_id } = await request.json();

  if (!user_id) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  // Verify the user_id matches the client profile being deleted
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("client_profiles")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();

  if (!profile || profile.user_id !== user_id) {
    return NextResponse.json({ error: "user_id does not match this client" }, { status: 400 });
  }

  const { error } = await admin.auth.admin.deleteUser(user_id);

  if (error) {
    return dbError(error, "Couldn't revoke access. Try again.", 400);
  }

  return NextResponse.json({ success: true });
}
