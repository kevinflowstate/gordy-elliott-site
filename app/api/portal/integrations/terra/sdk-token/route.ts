import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTerraSdkToken, getTerraReferenceId } from "@/lib/terra/client";
import { TERRA_CONSENT_VERSION } from "@/lib/terra/events";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (body?.provider !== "apple" && body?.provider !== "healthconnect") {
    return NextResponse.json({ error: "Unsupported native provider" }, { status: 400 });
  }
  if (body.consent !== true) {
    return NextResponse.json({ error: "Confirm the health-data notice before connecting." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("client_profiles").select("id").eq("user_id", user.id).maybeSingle();
  if (profileError) return NextResponse.json({ error: "Profile lookup failed" }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Client profile not found" }, { status: 404 });

  const { data: existing, error: connectionError } = await admin
    .from("client_wearable_connections").select("id, status, updated_at")
    .eq("client_id", profile.id).eq("provider", body.provider).maybeSingle();
  if (connectionError) return NextResponse.json({ error: "Connection lookup failed" }, { status: 500 });
  if (existing?.status === "connected") {
    return NextResponse.json({ error: "This app is already connected." }, { status: 409 });
  }

  const attemptStartedAt = new Date().toISOString();
  const referenceId = getTerraReferenceId(profile.id);
  try {
    const credentials = await generateTerraSdkToken(referenceId);
    const values = {
      client_id: profile.id, provider: body.provider, reference_id: referenceId,
      status: "pending", connected_at: null, disconnected_at: null,
      failure_reason: null, last_data_at: null, consent_version: TERRA_CONSENT_VERSION,
      consented_at: attemptStartedAt, updated_at: attemptStartedAt,
    };
    // A webhook or another request may have changed the row during token issuance.
    const write = existing
      ? admin.from("client_wearable_connections").update(values)
        .eq("id", existing.id).eq("client_id", profile.id)
        .eq("updated_at", existing.updated_at).neq("status", "connected")
      : admin.from("client_wearable_connections").insert(values);
    const { data: saved, error } = await write.select("id").maybeSingle();
    if (error?.code === "23505" || (!error && !saved)) {
      return NextResponse.json({ error: "Connection changed. Refresh and try again." }, { status: 409 });
    }
    if (error) throw new Error("Connection could not be saved");
    return NextResponse.json({ ...credentials, referenceId, attemptStartedAt }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Couldn't start the health connection. Please try again." }, { status: 502 });
  }
}
