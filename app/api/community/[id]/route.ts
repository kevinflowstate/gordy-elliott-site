import { requireAdmin } from "@/lib/admin-auth";
import { COMMUNITY_MEDIA_BUCKET } from "@/lib/community-media";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid message" }, { status: 400 });

  const admin = createAdminClient();
  const { data: message } = await admin
    .from("shift_community_messages")
    .select("id, media_path")
    .eq("id", id)
    .maybeSingle();
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  const { error } = await admin.from("shift_community_messages").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Message could not be removed" }, { status: 500 });
  if (message.media_path) {
    await admin.storage.from(COMMUNITY_MEDIA_BUCKET).remove([message.media_path]);
  }
  return NextResponse.json({ success: true });
}
