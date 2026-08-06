import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.env.PORTAL_QA_ENV_DIR || process.cwd());

const reviewEmail = (process.env.APP_REVIEW_EMAIL || "demo@flowstatesystems.ai").toLowerCase();
const confirmation = (process.env.CONFIRM_APP_REVIEW_FIXTURE_REFRESH || "").toLowerCase();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (confirmation !== reviewEmail) {
  console.error(`Set CONFIRM_APP_REVIEW_FIXTURE_REFRESH=${reviewEmail} to refresh only the marked App Review account.`);
  process.exit(2);
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before refreshing the review fixture.");
  process.exit(2);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function londonDateKey(daysAgo) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (authError) throw authError;

const authUser = authData.users.find((user) => user.email?.toLowerCase() === reviewEmail);
if (!authUser || authUser.user_metadata?.app_review_fixture !== true) {
  throw new Error(`Refusing to refresh ${reviewEmail}: the authentication user is not marked as the App Review fixture.`);
}

const { data: profile, error: profileError } = await supabase
  .from("client_profiles")
  .select("id, lifecycle_status")
  .eq("user_id", authUser.id)
  .single();
if (profileError) throw profileError;
if (profile.lifecycle_status !== "active") {
  throw new Error("Refusing to refresh the App Review fixture while the client profile is paused or frozen.");
}

const updatedAt = new Date().toISOString();
const entries = [
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
  updated_at: updatedAt,
}));

const { error: upsertError } = await supabase
  .from("client_daily_metrics")
  .upsert(entries, { onConflict: "client_id,tracked_date" });
if (upsertError) throw upsertError;

console.log(`Refreshed ${entries.length} fictional Daily Tracker entries for the marked App Review account.`);
