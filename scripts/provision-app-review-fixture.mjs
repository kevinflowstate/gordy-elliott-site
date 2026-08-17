import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.env.PORTAL_QA_ENV_DIR || process.cwd());

const reviewEmail = "demo@flowstatesystems.ai";
const confirmation = (process.env.CONFIRM_APP_REVIEW_FIXTURE_PROVISION || "").toLowerCase();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (confirmation !== reviewEmail) {
  console.error(`Set CONFIRM_APP_REVIEW_FIXTURE_PROVISION=${reviewEmail} to provision only the App Review account.`);
  process.exit(2);
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before provisioning the review fixture.");
  process.exit(2);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function londonDateKey(daysAgo = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function isoDaysAgo(daysAgo) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString();
}

async function unwrap(label, promise) {
  const result = await promise;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function ensureTrainingPlan(clientId) {
  const activePlans = await unwrap(
    "Load active review training plans",
    supabase.from("client_exercise_plans").select("id").eq("client_id", clientId).eq("status", "active"),
  );
  if (activePlans.length === 1) {
    const sessions = await unwrap(
      "Load active review training sessions",
      supabase.from("client_exercise_sessions").select("id").eq("plan_id", activePlans[0].id),
    );
    const items = sessions.length
      ? await unwrap(
          "Load active review exercises",
          supabase.from("client_exercise_session_items").select("id").in("session_id", sessions.map(({ id }) => id)),
        )
      : [];
    if (sessions.length >= 2 && items.length >= 4) return activePlans[0].id;
  }

  const templates = await unwrap(
    "Load training templates",
    supabase.from("exercise_training_templates").select("id, name, description").order("name"),
  );
  const templateIds = templates.map(({ id }) => id);
  const sessions = templateIds.length
    ? await unwrap(
        "Load training template sessions",
        supabase
          .from("exercise_training_sessions")
          .select("id, template_id, name, day_number, notes")
          .in("template_id", templateIds)
          .order("day_number"),
      )
    : [];
  const sessionIds = sessions.map(({ id }) => id);
  const items = sessionIds.length
    ? await unwrap(
        "Load training template exercises",
        supabase.from("exercise_training_session_items").select("*").in("session_id", sessionIds).order("order_index"),
      )
    : [];
  const template = templates.find(({ id }) => {
    const matchingSessions = sessions.filter((session) => session.template_id === id);
    const matchingSessionIds = new Set(matchingSessions.map((session) => session.id));
    return matchingSessions.length >= 2 && items.filter((item) => matchingSessionIds.has(item.session_id)).length >= 4;
  });
  if (!template) throw new Error("No representative training template with at least two sessions and four exercises is available.");

  await unwrap(
    "Archive incomplete review training plans",
    supabase.from("client_exercise_plans").update({ status: "archived" }).eq("client_id", clientId).eq("status", "active"),
  );
  const newPlan = await unwrap(
    "Create review training plan",
    supabase
      .from("client_exercise_plans")
      .insert({
        client_id: clientId,
        template_id: template.id,
        name: template.name,
        description: template.description,
        status: "active",
        start_date: londonDateKey(),
      })
      .select("id")
      .single(),
  );

  for (const session of sessions.filter(({ template_id }) => template_id === template.id)) {
    const newSession = await unwrap(
      "Create review training session",
      supabase
        .from("client_exercise_sessions")
        .insert({ plan_id: newPlan.id, name: session.name, day_number: session.day_number, notes: session.notes })
        .select("id")
        .single(),
    );
    const copiedItems = items.filter(({ session_id }) => session_id === session.id).map((item) => ({
      session_id: newSession.id,
      exercise_id: item.exercise_id,
      order_index: item.order_index,
      sets: item.sets,
      reps: item.reps,
      prescription_type: item.prescription_type || "sets_reps",
      prescription_text: item.prescription_text || null,
      rest_seconds: item.rest_seconds,
      tempo: item.tempo,
      notes: item.notes,
      section_label: item.section_label,
      superset_group: item.superset_group,
    }));
    if (copiedItems.length) {
      await unwrap("Copy review training exercises", supabase.from("client_exercise_session_items").insert(copiedItems));
    }
  }
  return newPlan.id;
}

async function ensureNutritionPlan(clientId) {
  const activePlans = await unwrap(
    "Load active review nutrition plans",
    supabase.from("client_nutrition_plans").select("id").eq("client_id", clientId).eq("status", "active"),
  );
  if (activePlans.length === 1) {
    const meals = await unwrap(
      "Load active review nutrition meals",
      supabase.from("client_nutrition_meals").select("id").eq("plan_id", activePlans[0].id),
    );
    if (meals.length >= 3) return activePlans[0].id;
  }

  const templates = await unwrap(
    "Load nutrition templates",
    supabase.from("nutrition_templates").select("*").order("name"),
  );
  const templateIds = templates.map(({ id }) => id);
  const meals = templateIds.length
    ? await unwrap(
        "Load nutrition template meals",
        supabase.from("nutrition_template_meals").select("*").in("template_id", templateIds).order("order_index"),
      )
    : [];
  const mealIds = meals.map(({ id }) => id);
  const items = mealIds.length
    ? await unwrap(
        "Load nutrition template items",
        supabase.from("nutrition_template_meal_items").select("*").in("meal_id", mealIds).order("order_index"),
      )
    : [];
  const template = templates.find(({ id }) => meals.filter(({ template_id }) => template_id === id).length >= 3);
  if (!template) throw new Error("No representative nutrition template with at least three meals is available.");

  await unwrap(
    "Archive incomplete review nutrition plans",
    supabase.from("client_nutrition_plans").update({ status: "archived" }).eq("client_id", clientId).eq("status", "active"),
  );
  const newPlan = await unwrap(
    "Create review nutrition plan",
    supabase
      .from("client_nutrition_plans")
      .insert({
        client_id: clientId,
        template_id: template.id,
        name: template.name,
        status: "active",
        target_calories: template.target_calories,
        target_protein_g: template.target_protein_g,
        target_carbs_g: template.target_carbs_g,
        target_fat_g: template.target_fat_g,
        target_fibre_g: template.target_fibre_g,
        target_sugar_g: template.target_sugar_g,
        start_date: londonDateKey(),
      })
      .select("id")
      .single(),
  );

  for (const meal of meals.filter(({ template_id }) => template_id === template.id)) {
    const newMeal = await unwrap(
      "Create review nutrition meal",
      supabase
        .from("client_nutrition_meals")
        .insert({ plan_id: newPlan.id, name: meal.name, order_index: meal.order_index, notes: meal.notes })
        .select("id")
        .single(),
    );
    const copiedItems = items.filter(({ meal_id }) => meal_id === meal.id).map((item) => ({
      meal_id: newMeal.id,
      food_id: item.food_id,
      quantity: item.quantity,
      order_index: item.order_index,
      notes: item.notes,
    }));
    if (copiedItems.length) {
      await unwrap("Copy review nutrition items", supabase.from("client_nutrition_meal_items").insert(copiedItems));
    }
  }
  return newPlan.id;
}

async function ensureWorkoutHistory(clientId, planId) {
  const sessions = await unwrap(
    "Load review workout sessions",
    supabase.from("client_exercise_sessions").select("id").eq("plan_id", planId).order("day_number").limit(1),
  );
  if (!sessions.length) return;
  const items = await unwrap(
    "Load review workout items",
    supabase.from("client_exercise_session_items").select("id").eq("session_id", sessions[0].id).order("order_index").limit(2),
  );
  if (!items.length) return;

  const logDate = londonDateKey(2);
  const sets = [
    { set_number: 1, weight: "60", reps: "8", notes: "", completed: true },
    { set_number: 2, weight: "60", reps: "8", notes: "", completed: true },
  ];
  await unwrap(
    "Seed review workout history",
    supabase.from("client_exercise_logs").upsert(
      items.map(({ id }) => ({
        client_id: clientId,
        exercise_item_id: id,
        session_id: sessions[0].id,
        log_date: logDate,
        sets_data: sets,
        completed: true,
        notes: "Fictional App Review workout.",
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "client_id,exercise_item_id,log_date" },
    ),
  );
  await unwrap(
    "Seed review workout summary",
    supabase.from("client_exercise_session_summaries").upsert({
      client_id: clientId,
      session_id: sessions[0].id,
      log_date: logDate,
      started_at: isoDaysAgo(2),
      completed_at: isoDaysAgo(2),
      duration_seconds: 2_400,
      total_tonnage_kg: items.length * 960,
      completed_sets: items.length * 2,
      total_reps: items.length * 16,
      updated_at: new Date().toISOString(),
    }, { onConflict: "client_id,session_id,log_date" }),
  );
}

const authData = await unwrap("List authentication users", supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }));
const authUser = authData.users.find((user) => user.email?.toLowerCase() === reviewEmail);
if (!authUser) throw new Error(`No authentication user exists for ${reviewEmail}.`);

await unwrap(
  "Mark the isolated App Review account",
  supabase.auth.admin.updateUserById(authUser.id, {
    user_metadata: { ...authUser.user_metadata, full_name: "Demo Client", app_review_fixture: true },
  }),
);
await unwrap(
  "Update the review user",
  supabase.from("users").update({ full_name: "Demo Client", role: "client" }).eq("id", authUser.id),
);
const profile = await unwrap(
  "Load the review profile",
  supabase.from("client_profiles").select("id").eq("user_id", authUser.id).single(),
);
await unwrap(
  "Update the review profile",
  supabase.from("client_profiles").update({
    business_name: "Demo Client",
    tier: "premium",
    experience_mode: "ai_coaching",
    lifecycle_status: "active",
    date_of_birth: "1988-06-15",
    primary_goal: "Build consistent strength, energy and training habits.",
    ai_credits: 25,
    profile_setup_data: { source: "app_review_fixture", fictional: true },
    consultation_data: { goals: "Build consistent strength and energy." },
  }).eq("id", profile.id),
);

const trainingPlanId = await ensureTrainingPlan(profile.id);
await ensureNutritionPlan(profile.id);
await ensureWorkoutHistory(profile.id, trainingPlanId);

const trackerEntries = [
  { daysAgo: 0, sleep: 7.8, water: 2.6, energy: 8, stress: 3, nutrition: 8, trained: true },
  { daysAgo: 1, sleep: 7.2, water: 2.4, energy: 7, stress: 4, nutrition: 7, trained: false },
  { daysAgo: 2, sleep: 8.0, water: 2.8, energy: 8, stress: 3, nutrition: 8, trained: true },
].map((entry) => ({
  client_id: profile.id,
  tracked_date: londonDateKey(entry.daysAgo),
  sleep_hours: entry.sleep,
  water_liters: entry.water,
  energy_level: entry.energy,
  stress_level: entry.stress,
  nutrition_score: entry.nutrition,
  training_completed: entry.trained,
  notes: "Fictional App Review daily entry.",
  updated_at: new Date().toISOString(),
}));
await unwrap(
  "Seed review Daily Tracker history",
  supabase.from("client_daily_metrics").upsert(trackerEntries, { onConflict: "client_id,tracked_date" }),
);

const checkins = await unwrap(
  "Load review check-ins",
  supabase.from("checkins").select("id, week_number, admin_reply").eq("client_id", profile.id).order("week_number"),
);
if (checkins.length < 2) {
  const usedWeeks = new Set(checkins.map(({ week_number }) => week_number));
  const rows = [1, 2].filter((week) => !usedWeeks.has(week)).slice(0, 2 - checkins.length).map((week, index) => ({
    client_id: profile.id,
    week_number: week,
    mood: index === 0 ? "good" : "great",
    wins: "Completed the planned sessions and kept meals consistent.",
    challenges: "A busy workday required moving one session.",
    questions: "How should I progress next week?",
    responses: {
      wins: "Completed the planned sessions and kept meals consistent.",
      challenges: "A busy workday required moving one session.",
      questions: "How should I progress next week?",
    },
    admin_reply: index === 0 ? "Strong week. Keep the same structure and add load only where the final reps stayed controlled." : null,
    created_at: isoDaysAgo(14 - index * 7),
  }));
  if (rows.length) await unwrap("Seed review check-ins", supabase.from("checkins").insert(rows));
}
const refreshedCheckins = await unwrap(
  "Reload review check-ins",
  supabase.from("checkins").select("id, admin_reply").eq("client_id", profile.id).order("created_at").limit(1),
);
if (refreshedCheckins.length && !refreshedCheckins[0].admin_reply) {
  await unwrap(
    "Seed a review check-in reply",
    supabase.from("checkins").update({
      admin_reply: "Strong week. Keep the same structure and add load only where the final reps stayed controlled.",
    }).eq("id", refreshedCheckins[0].id),
  );
}
await unwrap("Update review last check-in", supabase.from("client_profiles").update({ last_checkin: isoDaysAgo(7) }).eq("id", profile.id));

const existingMessages = await unwrap(
  "Load review direct messages",
  supabase.from("inbox_messages").select("sender_role").eq("client_id", profile.id),
);
if (!existingMessages.some(({ sender_role }) => sender_role === "client")) {
  await unwrap(
    "Seed review client message",
    supabase.from("inbox_messages").insert({
      client_id: profile.id,
      sender_user_id: authUser.id,
      sender_role: "client",
      message: "The revised session timing worked well this week.",
      read_by_admin: true,
      read_by_client: true,
      created_at: isoDaysAgo(3),
    }),
  );
}
if (!existingMessages.some(({ sender_role }) => sender_role === "admin")) {
  const admins = await unwrap("Load an admin sender", supabase.from("users").select("id").eq("role", "admin").limit(1));
  if (!admins.length) throw new Error("No admin user exists to provide a fictional two-way review conversation.");
  await unwrap(
    "Seed review coach message",
    supabase.from("inbox_messages").insert({
      client_id: profile.id,
      sender_user_id: admins[0].id,
      sender_role: "admin",
      message: "Good adjustment. Keep that slot next week and let me know if recovery changes.",
      read_by_admin: true,
      read_by_client: true,
      created_at: isoDaysAgo(2),
    }),
  );
}

console.log(`Provisioned the isolated fictional App Review fixture for ${reviewEmail}.`);
