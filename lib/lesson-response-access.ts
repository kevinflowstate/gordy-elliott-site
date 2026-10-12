import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeProgrammeType } from "@/lib/programmes";

export async function accessibleBoardroomLesson(admin: SupabaseClient, userId: string, moduleId: string, contentId: string) {
  const { data: profile, error: profileError } = await admin.from("client_profiles").select("id, programme_type").eq("user_id", userId).maybeSingle();
  if (profileError) throw new Error("Could not load profile");
  if (!profile || profile.programme_type !== "boardroom") return null;
  const { data: module, error: moduleError } = await admin.from("training_modules").select("id").eq("id", moduleId).eq("is_published", true).contains("programme_audiences", [normalizeProgrammeType(profile.programme_type)]).maybeSingle();
  if (moduleError) throw new Error("Could not load module");
  if (!module) return null;
  const { data: lesson, error: lessonError } = await admin.from("module_content").select("id").eq("id", contentId).eq("module_id", moduleId).maybeSingle();
  if (lessonError) throw new Error("Could not load lesson");
  return lesson ? profile : null;
}

export async function signLessonResponses<T extends { audio_path: string | null }>(admin: SupabaseClient, rows: T[]) {
  return Promise.all(rows.map(async ({ audio_path, ...row }) => {
    if (!audio_path) return { ...row, audio_url: null };
    const { data } = await admin.storage.from("lesson-responses").createSignedUrl(audio_path, 600);
    return { ...row, audio_url: data?.signedUrl || null, audio_unavailable: !data };
  }));
}
