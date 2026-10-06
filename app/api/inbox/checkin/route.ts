import { NextResponse } from "next/server";
import { getInboxViewer } from "@/lib/inbox-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { contextFromCheckin } from "@/lib/checkin-message";
import type { CheckIn, CheckinFormConfig } from "@/lib/types";

export async function GET(request: Request) {
  const viewer = await getInboxViewer();
  if (!viewer) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (viewer.role === "client" && !viewer.clientProfileId) return NextResponse.json({ error: "Check-in not found" }, { status: 404 });
  const id = new URL(request.url).searchParams.get("checkin_id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid check-in" }, { status: 400 });
  const admin = createAdminClient();
  const query = admin.from("checkins").select("*").eq("id", id);
  const { data: checkin, error } = await (viewer.role === "client" ? query.eq("client_id", viewer.clientProfileId) : query).maybeSingle();
  if (error || !checkin) return NextResponse.json({ error: "Check-in not found" }, { status: 404 });
  const { data: assignedForm } = checkin.checkin_form_id
    ? await admin.from("checkin_forms").select("config").eq("id", checkin.checkin_form_id).maybeSingle()
    : { data: null };
  const { data: defaultForm } = assignedForm ? { data: null }
    : await admin.from("checkin_forms").select("config").eq("is_default", true).order("created_at").limit(1).maybeSingle();
  const { data: legacyForm } = assignedForm || defaultForm ? { data: null }
    : await admin.from("form_config").select("config").eq("form_type", "checkin").maybeSingle();
  const config = (assignedForm || defaultForm || legacyForm)?.config as CheckinFormConfig | null;
  return NextResponse.json({ context: contextFromCheckin(checkin as CheckIn, config), reply: checkin.admin_reply }, { headers: { "Cache-Control": "private, no-store" } });
}
