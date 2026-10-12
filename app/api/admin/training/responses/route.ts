import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { signLessonResponses } from "@/lib/lesson-response-access";
import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const clientId = new URL(request.url).searchParams.get("client");
  if (!clientId) return NextResponse.json({ error: "Choose a client" }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("lesson_responses").select("id, reply_text, audio_path, created_at, lesson:module_content(title)").eq("client_id", clientId).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "Could not load lesson answers" }, { status: 500 });
  return NextResponse.json({ responses: await signLessonResponses(admin, data || []) });
}
