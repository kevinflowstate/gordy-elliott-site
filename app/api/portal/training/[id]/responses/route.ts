import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { accessibleBoardroomLesson, signLessonResponses } from "@/lib/lesson-response-access";
import { ALLOWED_AUDIO_TYPES, hasExpectedAudioSignature } from "@/lib/audio-file";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const admin = createAdminClient();
  const contentId = new URL(request.url).searchParams.get("contentId") || "";
  const profile = await accessibleBoardroomLesson(admin, user.id, id, contentId);
  if (!profile) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  const { data, error } = await admin.from("lesson_responses").select("id, reply_text, audio_path, created_at").eq("client_id", profile.id).eq("content_id", contentId).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "Could not load your answers" }, { status: 500 });
  return NextResponse.json({ responses: await signLessonResponses(admin, data || []) });
}
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!rateLimit(`lesson-response:${user.id}`, 20, 15 * 60 * 1000).success) return NextResponse.json({ error: "Please wait a little before sending another answer" }, { status: 429 });
  const form = await request.formData();
  const contentId = String(form.get("contentId") || "");
  const text = String(form.get("text") || "").trim();
  const file = form.get("audio");
  if (text.length > 10000 || (!text && !(file instanceof File))) return NextResponse.json({ error: "Add a text answer or voice note (text up to 10,000 characters)" }, { status: 400 });
  const admin = createAdminClient();
  const profile = await accessibleBoardroomLesson(admin, user.id, id, contentId);
  if (!profile) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  let audioPath: string | null = null;
  if (file instanceof File) {
    const mime = file.type.split(";")[0];
    if (!ALLOWED_AUDIO_TYPES.has(mime) || file.size < 1 || file.size > 3 * 1024 * 1024 || !hasExpectedAudioSignature(mime, new Uint8Array(await file.slice(0, 16).arrayBuffer()))) return NextResponse.json({ error: "Choose a valid voice note under 3MB" }, { status: 400 });
    audioPath = `${profile.id}/${contentId}/${crypto.randomUUID()}.${ALLOWED_AUDIO_TYPES.get(mime)}`;
    const { error } = await admin.storage.from("lesson-responses").upload(audioPath, await file.arrayBuffer(), { contentType: mime, upsert: false });
    if (error) return NextResponse.json({ error: "Could not upload your voice note. Your draft is still here." }, { status: 500 });
  }
  const { error } = await admin.from("lesson_responses").insert({ client_id: profile.id, content_id: contentId, reply_text: text || null, audio_path: audioPath });
  if (error) {
    if (audioPath) await admin.storage.from("lesson-responses").remove([audioPath]);
    return NextResponse.json({ error: "Could not save your answer. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
