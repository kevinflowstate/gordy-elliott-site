import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import {
  normaliseExerciseName,
  parseKahunasPreviewClient,
  validateKahunasPreviewClients,
} from "../lib/kahunas-preview-import.ts";

const args = Object.fromEntries(process.argv.slice(2).map((arg, index, all) => {
  if (!arg.startsWith("--")) return [String(index), arg];
  const [key, inline] = arg.slice(2).split("=", 2);
  const next = all[index + 1];
  return [key, inline ?? (next && !next.startsWith("--") ? next : true)];
}));

const archivePath = typeof args.input === "string" ? path.resolve(args.input) : null;
if (!archivePath) throw new Error("Usage: npm run migration:import-preview -- --input /path/to/archive.zip [--apply --confirm=FROZEN_PREVIEW_IMPORT]");

const apply = args.apply === true || args.apply === "true";
if (apply && args.confirm !== "FROZEN_PREVIEW_IMPORT") {
  throw new Error("Live writes require --confirm=FROZEN_PREVIEW_IMPORT.");
}

const source = await fs.readFile(archivePath);
const sourceSha256 = createHash("sha256").update(source).digest("hex");
if (typeof args.sha256 === "string" && args.sha256 !== sourceSha256) {
  throw new Error("Archive SHA-256 does not match --sha256.");
}

const entries = execFileSync("unzip", ["-Z1", archivePath], { encoding: "utf8" })
  .split("\n")
  .map((entry) => entry.trim())
  .filter((entry) => /\.md$/i.test(entry));
const clients = entries.map((entry) => parseKahunasPreviewClient(
  entry,
  execFileSync("unzip", ["-p", archivePath, entry], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }),
));
const issues = validateKahunasPreviewClients(clients);

const summary = {
  mode: apply ? "APPLY_FROZEN_PREVIEW" : "DRY_RUN",
  archive: path.basename(archivePath),
  sourceSha256,
  clients: clients.length,
  programmes: Object.fromEntries(["capacity", "shift", "in_person"].map((programme) => [
    programme,
    clients.filter((client) => client.programme === programme).length,
  ])),
  withMacros: clients.filter((client) => client.macros).length,
  withTrainingPlans: clients.filter((client) => client.sessions.length > 0).length,
  sessions: clients.reduce((total, client) => total + client.sessions.length, 0),
  exercises: clients.reduce((total, client) => total + client.sessions.reduce((subtotal, session) => subtotal + session.exercises.length, 0), 0),
  prescriptionTypes: clients.flatMap((client) => client.sessions.flatMap((session) => session.exercises))
    .reduce((counts, exercise) => ({ ...counts, [exercise.prescriptionType]: (counts[exercise.prescriptionType] || 0) + 1 }), {}),
  withConsultationData: clients.filter((client) => Object.keys(client.consultationData).length > 0).length,
  issues,
};

if (!apply) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(issues.length > 0 ? 1 : 0);
}

if (issues.length > 0) throw new Error(`Refusing live import with ${issues.length} validation issue(s).`);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --apply.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function previewAuthEmail(email) {
  const digest = createHash("sha256").update(email).digest("hex").slice(0, 24);
  return `preview-${digest}@clients.invalid`;
}

async function must(result, context) {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data;
}

async function waitForProfile(userId) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await admin.from("client_profiles").select("id").eq("user_id", userId).maybeSingle();
    if (result.data?.id) return result.data;
    if (result.error) throw new Error(`Profile lookup failed: ${result.error.message}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Client profile trigger did not complete.");
}

const { data: existingUsers, error: existingUsersError } = await admin
  .from("users")
  .select("id, email")
  .in("email", clients.flatMap((client) => [client.email, previewAuthEmail(client.email)]));
if (existingUsersError) throw new Error(`Existing-user check failed: ${existingUsersError.message}`);
const intendedEmails = new Set(clients.map((client) => client.email));
const existingEmails = new Set((existingUsers || [])
  .map((user) => user.email.toLowerCase())
  .filter((email) => intendedEmails.has(email)));

for (const stale of (existingUsers || []).filter((user) => user.email.endsWith("@clients.invalid"))) {
  const emergencyFreeze = await admin.from("client_profiles").update({
    lifecycle_status: "access_frozen",
    lifecycle_paused_at: new Date().toISOString(),
    lifecycle_resumes_at: null,
  }).eq("user_id", stale.id);
  if (emergencyFreeze.error) throw new Error(`Stale preview account could not be frozen: ${emergencyFreeze.error.message}`);
  const deletion = await admin.auth.admin.deleteUser(stale.id);
  if (deletion.error) throw new Error(`Stale preview account could not be deleted: ${deletion.error.message}`);
}
const clientsToImport = clients.filter((client) => !existingEmails.has(client.email));

async function fetchAllExercises() {
  const rows = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin.from("exercises").select("id, name").range(from, from + pageSize - 1);
    if (error) throw new Error(`Exercise-library read failed: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}
const existingExercises = await fetchAllExercises();
const exerciseIds = new Map(existingExercises.map((exercise) => [normaliseExerciseName(exercise.name), exercise.id]));
const sourceExerciseNames = new Map();
for (const client of clientsToImport) {
  for (const session of client.sessions) {
    for (const exercise of session.exercises) {
      const key = normaliseExerciseName(exercise.name);
      if (!exerciseIds.has(key) && !sourceExerciseNames.has(key)) sourceExerciseNames.set(key, exercise.name);
    }
  }
}

if (sourceExerciseNames.size > 0) {
  const created = await must(await admin.from("exercises").insert(
    [...sourceExerciseNames.values()].map((name) => ({
      name,
      muscle_group: "Imported",
      equipment: "Review",
      description: "Imported from Kahunas for frozen client preview; review before reusing.",
      is_active: false,
    })),
  ).select("id, name"), "Imported exercise creation failed");
  for (const exercise of created || []) exerciseIds.set(normaliseExerciseName(exercise.name), exercise.id);
}

const { data: modules, error: modulesError } = await admin
  .from("training_modules")
  .select("id, programme_audiences")
  .eq("is_published", true);
if (modulesError) throw new Error(`Training-module read failed: ${modulesError.message}`);

const results = { ...summary, created: 0, skippedExisting: existingEmails.size, failed: [] };

for (let index = 0; index < clients.length; index += 1) {
  const client = clients[index];
  if (existingEmails.has(client.email)) continue;
  let userId = null;
  try {
    const authData = await must(await admin.auth.admin.createUser({
      email: previewAuthEmail(client.email),
      email_confirm: true,
      ban_duration: "876000h",
      password: `Preview!${randomUUID().replaceAll("-", "")}aA1`,
      user_metadata: {
        full_name: client.name,
        role: "client",
        app_name: "gordy-elliott-portal",
        requires_password_setup: true,
        preview_import_frozen: true,
      },
    }), "Auth user creation failed");
    userId = authData.user.id;
    const profile = await waitForProfile(userId);
    const noteLines = [
      "FROZEN PREVIEW — imported from Kahunas; do not activate or contact until Gordy approves.",
      `Source: ${client.sourcePath}`,
      `Archive SHA-256: ${sourceSha256}`,
      `Original programme: ${client.programme}`,
      client.flags.length > 0 ? `Flags: ${client.flags.join(" | ")}` : null,
    ].filter(Boolean);

    await must(await admin.from("client_profiles").update({
      lifecycle_status: "access_frozen",
      lifecycle_paused_at: new Date().toISOString(),
      lifecycle_resumes_at: null,
      experience_mode: client.profile.experience_mode,
      programme_type: client.programme,
      onboarding_status: "invited",
      tier: client.profile.tier,
      checkin_day: client.checkinDay,
      start_weight: client.startWeightKg,
      primary_goal: client.consultationData.primary_goal || null,
      coach_notes: noteLines.join("\n"),
      consultation_data: client.consultationData,
    }).eq("id", profile.id), "Profile freeze/configuration failed");

    await must(await admin.from("client_coaching_notes").insert({
      client_id: profile.id,
      source_type: "other",
      source_title: "Kahunas migration source — frozen preview",
      source_date: new Date().toISOString().slice(0, 10),
      raw_notes: client.sourceMarkdown,
      coach_summary: "Full Kahunas export retained for Gordy's private review before activation.",
      coach_notes: noteLines.join("\n"),
      risk_flags: client.flags,
      client_visible: false,
    }), "Private source-note import failed");

    if (client.latestWeightKg && client.latestWeightDate) {
      await must(await admin.from("client_body_measurements").insert({
        client_id: profile.id,
        measured_date: client.latestWeightDate,
        weight_kg: client.latestWeightKg,
        notes: "Imported latest Kahunas check-in weight.",
      }), "Latest measurement import failed");
    }

    if (client.macros) {
      await must(await admin.from("client_nutrition_plans").insert({
        client_id: profile.id,
        name: "Kahunas macro targets — review",
        status: "active",
        target_calories: client.macros.calories,
        target_protein_g: client.macros.protein,
        target_carbs_g: client.macros.carbs,
        target_fat_g: client.macros.fat,
        start_date: new Date().toISOString().slice(0, 10),
      }), "Macro target import failed");
    }

    if (client.sessions.length > 0) {
      const plan = await must(await admin.from("client_exercise_plans").insert({
        client_id: profile.id,
        name: client.trainingPlanName || "Kahunas training plan — review",
        description: "Imported from Kahunas for frozen preview. Exercise names and prescriptions require Gordy's review before activation.",
        status: "active",
        start_date: new Date().toISOString().slice(0, 10),
      }).select("id").single(), "Training plan import failed");

      for (let sessionIndex = 0; sessionIndex < client.sessions.length; sessionIndex += 1) {
        const session = client.sessions[sessionIndex];
        const savedSession = await must(await admin.from("client_exercise_sessions").insert({
          plan_id: plan.id,
          name: session.name,
          day_number: sessionIndex + 1,
          notes: "Imported from Kahunas; review before activation.",
        }).select("id").single(), "Training session import failed");
        await must(await admin.from("client_exercise_session_items").insert(session.exercises.map((exercise, exerciseIndex) => ({
          session_id: savedSession.id,
          exercise_id: exerciseIds.get(normaliseExerciseName(exercise.name)),
          order_index: exerciseIndex,
          sets: exercise.sets,
          reps: exercise.reps,
          prescription_type: exercise.prescriptionType,
          prescription_text: exercise.prescriptionText,
          rest_seconds: exercise.restSeconds,
          notes: exercise.notes,
          section_label: exercise.sectionLabel,
          superset_group: exercise.supersetGroup,
        }))), "Training prescription import failed");
      }
    }

    const moduleRows = (modules || [])
      .filter((module) => !Array.isArray(module.programme_audiences) || module.programme_audiences.includes(client.programme))
      .map((module) => ({ client_id: profile.id, module_id: module.id, status: "locked" }));
    if (moduleRows.length > 0) {
      await must(await admin.from("client_modules").upsert(moduleRows, { onConflict: "client_id,module_id", ignoreDuplicates: true }), "Module assignment failed");
    }

    await must(await admin.from("users").update({ email: client.email }).eq("id", userId), "Admin-facing email update failed");

    results.created += 1;
    console.log(`Imported frozen preview ${index + 1}/${clients.length}`);
  } catch (error) {
    let cleanup = "No auth user was created.";
    if (userId) {
      const emergencyFreeze = await admin.from("client_profiles").update({
        lifecycle_status: "access_frozen",
        lifecycle_paused_at: new Date().toISOString(),
        lifecycle_resumes_at: null,
      }).eq("user_id", userId).select("id").maybeSingle();
      const deletion = await admin.auth.admin.deleteUser(userId);
      if (deletion.error) {
        cleanup = `CLEANUP FAILED for auth user ${userId}: ${deletion.error.message}. Emergency freeze ${emergencyFreeze.error || !emergencyFreeze.data ? "could not be verified" : "was verified"}.`;
      } else {
        cleanup = "Created auth user and cascading profile data were deleted.";
      }
    }
    results.failed.push({
      sourcePath: client.sourcePath,
      error: error instanceof Error ? error.message : String(error),
      cleanup,
    });
    console.error(`Frozen preview import failed at ${index + 1}/${clients.length}`);
    break;
  }
}

console.log(JSON.stringify(results, null, 2));
if (results.failed.length > 0) process.exit(1);
