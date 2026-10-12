import { normalizeProgrammeType } from "@/lib/programmes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get client profile
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id, programme_type")
    .eq("user_id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Client profile not found" }, { status: 404 });

  // Get module with content (only if published)
  const { data: mod } = await admin
    .from("training_modules")
    .select("*, content:module_content(*)")
    .eq("id", id)
    .eq("is_published", true)
    .contains("programme_audiences", [normalizeProgrammeType(profile.programme_type)])
    .single();

  if (!mod) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  // Get progress
  const progress: Record<string, boolean> = {};
  if (profile) {
    const { data: progressData } = await admin
      .from("content_progress")
      .select("content_id, completed")
      .eq("client_id", profile.id);

    if (progressData) {
      progressData.forEach((p: { content_id: string; completed: boolean }) => {
        progress[p.content_id] = p.completed;
      });
    }
  }

  return NextResponse.json({
    module: mod,
    progress,
    profileId: profile?.id || null,
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { contentId, completed, profileId } = await request.json();

  if (!profileId || !contentId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Verify the profileId belongs to the authenticated user
  const { data: ownedProfile } = await admin
    .from("client_profiles")
    .select("id, programme_type")
    .eq("id", profileId)
    .eq("user_id", user.id)
    .single();

  if (!ownedProfile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (typeof completed !== "boolean") return NextResponse.json({ error: "Invalid completion" }, { status: 400 });
  const { data: allowedModule } = await admin.from("training_modules").select("id").eq("id", id).eq("is_published", true).contains("programme_audiences", [normalizeProgrammeType(ownedProfile.programme_type)]).maybeSingle();
  const { data: lesson } = await admin.from("module_content").select("id").eq("id", contentId).eq("module_id", id).maybeSingle();
  if (!allowedModule || !lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

  if (completed) {
    const { error } = await admin.from("content_progress").upsert({
      client_id: profileId,
      content_id: contentId,
      completed: true,
      completed_at: new Date().toISOString(),
    }, { onConflict: "client_id,content_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin
      .from("content_progress")
      .update({ completed: false, completed_at: null })
      .eq("client_id", profileId)
      .eq("content_id", contentId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
