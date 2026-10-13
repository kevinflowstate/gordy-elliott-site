import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => null);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!body || typeof body.checkin_id !== "string" || !uuid.test(body.checkin_id) || typeof body.client_id !== "string" || !uuid.test(body.client_id)) {
    return NextResponse.json({ error: "A valid client and check-in are required" }, { status: 400 });
  }
  const { data, error } = await createAdminClient().rpc("mark_checkin_reviewed", {
    p_admin_id: auth.userId, p_checkin_id: body.checkin_id, p_client_id: body.client_id,
  });
  if (error) return NextResponse.json({ error: error.code === "P0002" ? "Check-in not found" : "Could not mark this check-in reviewed" }, { status: error.code === "P0002" ? 404 : 500 });
  return NextResponse.json(data);
}
