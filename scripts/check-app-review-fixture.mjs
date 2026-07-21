import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const reviewEmail = (process.env.APP_REVIEW_EMAIL || "demo@flowstatesystems.ai").toLowerCase();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before checking the review fixture.");
  process.exit(2);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const failures = [];
const evidence = [];
const scratchCopy = /testing 123|knee fucked|anavar|protein is in paint|dog ran a marathon|shit sleep|sensitive little guy|kevin test|codex scratch/i;

function requireCondition(condition, message) {
  if (!condition) failures.push(message);
}

function requireCleanCopy(value, label) {
  if (scratchCopy.test(JSON.stringify(value || {}))) {
    failures.push(`${label} still contains scratch or inappropriate test copy.`);
  }
}

async function query(label, promise) {
  const { data, error, count } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return { data, count };
}

function ageInYears(dateOfBirth) {
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

try {
  const { data: authUsers } = await query(
    "List authentication users",
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  );
  const authUser = authUsers.users.find((user) => user.email?.toLowerCase() === reviewEmail);
  requireCondition(authUser, `No authentication user exists for ${reviewEmail}.`);

  if (!authUser) throw new Error(failures.at(-1));

  requireCondition(Boolean(authUser.email_confirmed_at), "The review account email is not confirmed.");
  requireCondition(authUser.user_metadata?.app_review_fixture === true, "The account is not marked as an App Review fixture.");

  const { data: userRow } = await query(
    "Load review user",
    supabase.from("users").select("id, full_name, role").eq("id", authUser.id).single(),
  );
  requireCondition(userRow.role === "client", "The review account is not a client account.");
  requireCondition(Boolean(userRow.full_name?.trim()), "The review account has no display name.");

  const { data: profile } = await query(
    "Load review client profile",
    supabase
      .from("client_profiles")
      .select("id, ai_credits, date_of_birth, lifecycle_status, primary_goal, profile_setup_data, consultation_data")
      .eq("user_id", authUser.id)
      .single(),
  );
  const fixtureAge = ageInYears(profile.date_of_birth);
  requireCondition(profile.lifecycle_status === "active", "The review account is paused or frozen.");
  requireCondition((profile.ai_credits || 0) > 0, "The review account cannot use SHIFT AI because it has no credit.");
  requireCondition(fixtureAge !== null && fixtureAge >= 16, "The review account date of birth is missing, invalid, or under 16.");
  requireCondition(Boolean(profile.primary_goal?.trim()), "The review account has no primary coaching goal.");
  requireCleanCopy(profile, "The review client profile");

  const { data: exercisePlans } = await query(
    "Load active exercise plan",
    supabase.from("client_exercise_plans").select("id, name").eq("client_id", profile.id).eq("status", "active"),
  );
  requireCondition(exercisePlans.length === 1, "The review account must have exactly one active exercise plan.");
  requireCleanCopy(exercisePlans, "The active exercise plan");

  const exercisePlanIds = exercisePlans.map((plan) => plan.id);
  const { data: exerciseSessions } = exercisePlanIds.length
    ? await query(
        "Load exercise sessions",
        supabase.from("client_exercise_sessions").select("id, name").in("plan_id", exercisePlanIds),
      )
    : { data: [] };
  requireCondition(exerciseSessions.length >= 2, "The active exercise plan needs at least two sessions.");
  requireCleanCopy(exerciseSessions, "Exercise session names");

  const sessionIds = exerciseSessions.map((session) => session.id);
  const { data: exerciseItems, count: exerciseItemCount = 0 } = sessionIds.length
    ? await query(
        "Load prescribed exercises",
        supabase
          .from("client_exercise_session_items")
          .select("notes, prescription_text, section_label, exercise:exercises(name)", { count: "exact" })
          .in("session_id", sessionIds),
      )
    : { data: [], count: 0 };
  requireCondition((exerciseItemCount || 0) >= 4, "The active exercise plan does not contain enough prescribed exercises.");
  requireCleanCopy(exerciseItems, "Prescribed exercise content");

  const { data: nutritionPlans } = await query(
    "Load active nutrition plan",
    supabase.from("client_nutrition_plans").select("id, name").eq("client_id", profile.id).eq("status", "active"),
  );
  requireCondition(nutritionPlans.length === 1, "The review account must have exactly one active nutrition plan.");
  requireCleanCopy(nutritionPlans, "The active nutrition plan");

  const nutritionPlanIds = nutritionPlans.map((plan) => plan.id);
  const { data: meals } = nutritionPlanIds.length
    ? await query(
        "Load nutrition meals",
        supabase.from("client_nutrition_meals").select("id, name").in("plan_id", nutritionPlanIds),
      )
    : { data: [] };
  requireCondition(meals.length >= 3, "The active nutrition plan needs at least three meals.");
  requireCleanCopy(meals, "Nutrition meal names");

  const recentCutoff = new Date();
  recentCutoff.setUTCDate(recentCutoff.getUTCDate() - 14);
  const { data: metrics } = await query(
    "Load recent daily tracking",
    supabase
      .from("client_daily_metrics")
      .select("tracked_date, notes")
      .eq("client_id", profile.id)
      .gte("tracked_date", recentCutoff.toISOString().slice(0, 10)),
  );
  requireCondition(metrics.length >= 3, "The review account needs at least three Daily Tracker entries from the last 14 days.");
  requireCleanCopy(metrics, "Daily Tracker history");

  const { data: checkins } = await query(
    "Load check-ins",
    supabase.from("checkins").select("mood, wins, challenges, questions, admin_reply, responses").eq("client_id", profile.id),
  );
  requireCondition(checkins.length >= 2, "The review account needs at least two representative check-ins.");
  requireCondition(checkins.some((checkin) => Boolean(checkin.admin_reply)), "The review account has no replied check-in.");
  requireCleanCopy(checkins, "Check-in history");

  const { data: messages } = await query(
    "Load direct messages",
    supabase.from("inbox_messages").select("sender_role, message").eq("client_id", profile.id),
  );
  requireCondition(messages.some((message) => message.sender_role === "client"), "The review account has no client DM sample.");
  requireCondition(messages.some((message) => message.sender_role === "admin"), "The review account has no coach DM sample.");
  requireCleanCopy(messages, "DM history");

  evidence.push(
    `account=${reviewEmail}`,
    `exerciseSessions=${exerciseSessions.length}`,
    `exerciseItems=${exerciseItemCount || 0}`,
    `nutritionMeals=${meals.length}`,
    `recentTrackerEntries=${metrics.length}`,
    `checkins=${checkins.length}`,
    `directMessages=${messages.length}`,
  );
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}

if (failures.length) {
  console.error(`App Review fixture failed ${failures.length} check(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`App Review fixture passed: ${evidence.join(", ")}`);
