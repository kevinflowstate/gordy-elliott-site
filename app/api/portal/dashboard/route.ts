import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeCheckinConfig } from "@/lib/checkin-form";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = user.id;

  const { data: userData } = await admin
    .from("users")
    .select("full_name")
    .eq("id", userId)
    .single();

  const { data: profile } = await admin
    .from("client_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  }

  // Update last_login timestamp
  await admin
    .from("client_profiles")
    .update({ last_login: new Date().toISOString() })
    .eq("id", profile.id);

  const [checkinsRes, planRes, contentProgressRes, assignedCheckinFormRes, fallbackCheckinFormRes] = await Promise.all([
    admin
      .from("checkins")
      // The dashboard computes streaks and high-touch support state from check-in history,
      // so it needs the full history rather than a shallow recent slice.
      .select("id, week_number, created_at, admin_reply, replied_at")
      .eq("client_id", profile.id)
      .order("created_at", { ascending: false }),
    admin
      .from("business_plans")
      .select("*")
      .eq("client_id", profile.id)
      .eq("status", "active")
      .limit(1)
      .single(),
    // Content progress for training completion tracking
    admin
      .from("content_progress")
      .select("content_id, completed")
      .eq("client_id", profile.id)
      .eq("completed", true),
    profile.checkin_form_id
      ? admin
          .from("checkin_forms")
          .select("config")
          .eq("id", profile.checkin_form_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    admin
      .from("checkin_forms")
      .select("config")
      .eq("is_default", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  let modules: Array<{ id: string; title: string; created_at: string; content?: { id: string }[] }> = [];
  let recentModules: Array<{ id: string; title: string; created_at: string }> = [];

  // Get business plan phases and items if plan exists
  let planPhases: unknown[] = [];
  if (planRes.data) {
    const { data: phases } = await admin
      .from("business_plan_phases")
      .select("*")
      .eq("plan_id", planRes.data.id)
      .order("order_index");

    if (phases && phases.length > 0) {
      const phaseIds = phases.map((p: { id: string }) => p.id);
      const { data: items } = await admin
        .from("business_plan_items")
        .select("*")
        .in("phase_id", phaseIds)
        .order("order_index");

      const { data: links } = await admin
        .from("phase_training_links")
        .select("content_id")
        .in("phase_id", phaseIds);

      const contentIds = [...new Set((links || []).map((link: { content_id: string }) => link.content_id))];
      if (contentIds.length > 0) {
        const { data: contentItems } = await admin
          .from("module_content")
          .select("module_id")
          .in("id", contentIds);

        const moduleIds = [...new Set((contentItems || []).map((contentItem: { module_id: string }) => contentItem.module_id))];
        if (moduleIds.length > 0) {
          const { data: moduleRows } = await admin
            .from("training_modules")
            .select("*, content:module_content(*)")
            .eq("is_published", true)
            .in("id", moduleIds)
            .order("order_index");

          modules = moduleRows || [];
          recentModules = [...modules]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 3)
            .map(({ id, title, created_at }) => ({ id, title, created_at }));
        }
      }

      planPhases = phases.map((phase: { id: string }) => ({
        ...phase,
        items: (items || []).filter((item: { phase_id: string }) => item.phase_id === phase.id),
      }));
    }
  }

  // Build a set of completed content IDs for training progress
  const completedContentIds = new Set(
    (contentProgressRes.data || []).map((p: { content_id: string }) => p.content_id)
  );

  // Count total lessons and completed lessons across all modules
  const allLessons = modules.flatMap(
    (m: { content?: { id: string }[] }) => (m.content || []).map((c: { id: string }) => c.id)
  );
  const totalLessons = allLessons.length;
  const completedLessons = allLessons.filter((id: string) => completedContentIds.has(id)).length;

  const effectiveCheckinConfig = assignedCheckinFormRes.data?.config
    ? normalizeCheckinConfig(assignedCheckinFormRes.data.config)
    : fallbackCheckinFormRes.data?.config
      ? normalizeCheckinConfig(fallbackCheckinFormRes.data.config)
      : null;

  return NextResponse.json({
    userName: userData?.full_name || "",
    profile,
    modules,
    checkins: checkinsRes.data || [],
    businessPlan: planRes.data || null,
    planPhases,
    checkinDay: profile.checkin_day || effectiveCheckinConfig?.checkin_day || "monday",
    recentModules,
    trainingProgress: {
      completedLessons,
      totalLessons,
    },
  });
}
