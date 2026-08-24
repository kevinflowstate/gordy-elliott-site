import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { dbError } from "@/lib/api-errors";
import { getClientById } from "@/lib/admin-data";
import { isProgrammeType, legacyProfileForProgramme } from "@/lib/programmes";
import { NextResponse } from "next/server";
import { notifyClientUser } from "@/lib/client-notifications";

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
  const admin = createAdminClient();
  const { data: currentProfile, error: currentProfileError } = await admin
    .from("client_profiles")
    .select("user_id, onboarding_status, activated_at, sex")
    .eq("id", id)
    .maybeSingle();
  if (currentProfileError) return dbError(currentProfileError, "Couldn't load that client. Try again.");
  if (!currentProfile) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Only allow safe profile fields to be patched
  const allowed = ["checkin_day", "checkin_form_id", "coach_notes", "start_weight", "programme_type", "onboarding_status", "date_of_birth", "sex", "cycle_tracking_enabled"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if ("programme_type" in updates) {
    if (!isProgrammeType(updates.programme_type)) {
      return NextResponse.json({ error: "Invalid programme" }, { status: 400 });
    }
    Object.assign(updates, legacyProfileForProgramme(updates.programme_type));
  }

  if ("onboarding_status" in updates) {
    if (!['invited', 'consultation_complete', 'active', 'paused'].includes(String(updates.onboarding_status))) {
      return NextResponse.json({ error: "Invalid onboarding status" }, { status: 400 });
    }
    const requestedStatus = String(updates.onboarding_status);
    const currentStatus = currentProfile.onboarding_status || "active";
    if (requestedStatus === "active" && !["consultation_complete", "paused", "active"].includes(currentStatus)) {
      return NextResponse.json({ error: "The consultation must be completed before this client can go live" }, { status: 409 });
    }
    if (requestedStatus === "consultation_complete" && !["invited", "consultation_complete"].includes(currentStatus)) {
      return NextResponse.json({ error: "That onboarding step has already been completed" }, { status: 409 });
    }
    if (requestedStatus === "invited" && currentStatus !== "invited") {
      return NextResponse.json({ error: "Onboarding cannot be moved back to invited" }, { status: 409 });
    }
    if (requestedStatus === "active" && currentStatus !== "active") {
      updates.activated_at = currentProfile.activated_at || new Date().toISOString();
      updates.activated_by = auth.userId;
    }
  }

  if ("sex" in updates) {
    if (updates.sex === "") updates.sex = null;
    if (updates.sex !== null && !VALID_SEX_VALUES.includes(String(updates.sex))) {
      return NextResponse.json({ error: "Invalid sex value" }, { status: 400 });
    }
  }

  if ("cycle_tracking_enabled" in updates) {
    const sexForEligibility = updates.sex === undefined
      ? currentProfile.sex
      : updates.sex;

    updates.cycle_tracking_enabled = sexForEligibility === "female"
      ? Boolean(updates.cycle_tracking_enabled)
      : false;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const becameActive = updates.onboarding_status === "active" && currentProfile.onboarding_status !== "active";
  const { data: updatedProfile, error } = await admin
    .from("client_profiles")
    .update(updates)
    .eq("id", id)
    .select("user_id, onboarding_status, activated_at")
    .maybeSingle();

  if (error) {
    return dbError(error, "Couldn't update that client. Try again.");
  }

  if (becameActive && updatedProfile?.user_id) {
      await notifyClientUser(updatedProfile.user_id, {
        title: "Your AT CAPACITY plan is live",
        message: "Gordy has finished your setup. Open the app to get started.",
        link: "/portal",
        tag: `onboarding-live-${id}`,
      });
  }

  return NextResponse.json({ success: true, client: updatedProfile });
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
