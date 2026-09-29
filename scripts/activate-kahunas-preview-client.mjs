import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const args = Object.fromEntries(process.argv.slice(2).map((arg, index, all) => {
  if (!arg.startsWith("--")) return [String(index), arg];
  const [key, inline] = arg.slice(2).split("=", 2);
  const next = all[index + 1];
  return [key, inline ?? (next && !next.startsWith("--") ? next : true)];
}));

const email = typeof args.email === "string" ? args.email.trim().toLowerCase() : "";
if (!email || !email.includes("@")) throw new Error("Provide one imported client with --email.");
if (args.confirm !== "ACTIVATE_FROZEN_PREVIEW") {
  throw new Error("Activation requires --confirm=ACTIVATE_FROZEN_PREVIEW.");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: appUser, error: appUserError } = await admin
  .from("users")
  .select("id, email")
  .eq("email", email)
  .maybeSingle();
if (appUserError || !appUser) throw new Error(appUserError?.message || "Imported client was not found.");

const { data: authData, error: authReadError } = await admin.auth.admin.getUserById(appUser.id);
if (authReadError || !authData.user) throw new Error(authReadError?.message || "Auth identity was not found.");
const authMetadata = authData.user.user_metadata || {};
const hasFrozenIdentity = authData.user.email?.endsWith("@clients.invalid")
  && authMetadata.preview_import_frozen === true;
const hasPendingIdentity = authData.user.email?.toLowerCase() === email
  && authMetadata.preview_activation_pending === true;
if (!hasFrozenIdentity && !hasPendingIdentity) {
  throw new Error("Refusing activation: this is not a frozen Kahunas preview identity.");
}

const { data: profile, error: profileError } = await admin
  .from("client_profiles")
  .select("id, lifecycle_status")
  .eq("user_id", appUser.id)
  .maybeSingle();
if (profileError || !profile) throw new Error(profileError?.message || "Client profile was not found.");
if (profile.lifecycle_status !== "access_frozen" && !(hasPendingIdentity && profile.lifecycle_status === "active")) {
  throw new Error("Refusing activation: the client is not in a resumable preview state.");
}

const now = new Date().toISOString();
async function updateAuth(attributes, context) {
  try {
    const result = await admin.auth.admin.updateUserById(appUser.id, attributes);
    if (result.error) throw result.error;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${context}: ${message}`);
  }
}

if (hasFrozenIdentity) {
  await updateAuth({
    email,
    email_confirm: true,
    ban_duration: "none",
    user_metadata: {
      ...authMetadata,
      preview_import_frozen: true,
      preview_activation_pending: true,
      requires_password_setup: true,
    },
  }, "Auth promotion failed; the profile remains frozen");
}

if (profile.lifecycle_status === "access_frozen") {
  const { error: activateError } = await admin.from("client_profiles").update({
    lifecycle_status: "active",
    onboarding_status: "active",
    lifecycle_paused_at: null,
    lifecycle_resumes_at: null,
    activated_at: now,
  }).eq("id", profile.id);
  if (activateError) throw new Error(`Client lifecycle activation failed; rerun to resume: ${activateError.message}`);
}

await updateAuth({
  user_metadata: {
    ...authMetadata,
    preview_import_frozen: false,
    preview_activation_pending: false,
    requires_password_setup: true,
  },
}, "Activation metadata finalisation failed; rerun to resume");

console.log(JSON.stringify({
  activated: true,
  email,
  setupEmailSent: false,
  nextStep: "Use the existing admin Send setup link action when Gordy is ready to contact this client.",
}, null, 2));
