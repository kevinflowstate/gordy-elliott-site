import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateSupportUpdate } from "@/lib/support-contract";
import {
  listSupportQueuePage,
  SUPPORT_REPORT_FIELDS as fields,
} from "@/lib/support-queue-server";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized)
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers },
    );
  const admin = createAdminClient();
  const params = new URL(request.url).searchParams;
  const filter = params.get("status") || "Open";
  const page = Number(params.get("page") || "0");
  let result;
  try {
    result = await listSupportQueuePage(admin, filter, page);
  } catch {
    return NextResponse.json(
      { error: "Invalid queue view." },
      { status: 400, headers },
    );
  }
  const { data, error, count } = result;
  if (error)
    return NextResponse.json(
      { error: "Support queue could not be loaded." },
      { status: 503, headers },
    );
  const tickets = await Promise.all(
    (data || []).map(async (ticket) => {
      if (!ticket.image_path) return { ...ticket, image_url: null };
      const { data: signed } = await admin.storage
        .from("support-images")
        .createSignedUrl(ticket.image_path, 300);
      return { ...ticket, image_url: signed?.signedUrl || null };
    }),
  );
  return NextResponse.json(
    {
      tickets,
      hasMore: (count || 0) > page * 50 + tickets.length,
      total: count || 0,
    },
    { headers },
  );
}
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized)
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers },
    );
  try {
    const body = await request.json();
    if (
      typeof body.id !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(body.id) ||
      typeof body.updated_at !== "string"
    )
      return NextResponse.json(
        { error: "Invalid report." },
        { status: 400, headers },
      );
    const update = validateSupportUpdate(body);
    const { data, error } = await createAdminClient()
      .from("support_reports")
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq("id", body.id)
      .eq("updated_at", body.updated_at)
      .select(fields)
      .maybeSingle();
    if (error)
      return NextResponse.json(
        { error: "Update could not be saved." },
        { status: 503, headers },
      );
    if (!data)
      return NextResponse.json(
        { error: "This report changed. Reload the queue before saving." },
        { status: 409, headers },
      );
    return NextResponse.json({ ticket: data }, { headers });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Check the queue fields.",
      },
      { status: 400, headers },
    );
  }
}
