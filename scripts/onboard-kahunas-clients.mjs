import process from "node:process";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { buildAccountRecoveryUrl } from "../lib/account-links.ts";
import { prepareMigrationWelcomeEmail, sendMigrationWelcomeEmail, sendPreparedMigrationWelcomeEmail } from "../lib/email-templates.ts";
import { assertMigrationRetryWindow, validateLiveMigrationClient, validateMigrationCohort } from "../lib/migration-onboarding.ts";

const args = Object.fromEntries(process.argv.slice(2).map((arg, index, all) => {
  if (!arg.startsWith("--")) return [String(index), arg];
  const [key, inline] = arg.slice(2).split("=", 2);
  const next = all[index + 1];
  return [key, inline ?? (next && !next.startsWith("--") ? next : true)];
}));
const apply = args.apply === true;
const confirmed = args.confirm === "ONBOARD_KAHUNAS_CLIENTS";
const appReady = args["app-store-ready"] === true;
const campaign = "kahunas-onboarding-2026-10-05";

if (args["test-email"]) {
  if (args["test-email"] !== "delivered@resend.dev" || !apply || !confirmed) {
    throw new Error("Synthetic test requires --test-email=delivered@resend.dev --apply --confirm=ONBOARD_KAHUNAS_CLIENTS");
  }
  const id = await sendMigrationWelcomeEmail("delivered@resend.dev", "Alex Example",
    "https://app.onlinegordy.com/auth/callback?token_hash=synthetic-preview-only&type=recovery&redirect=%2Fportal%2Fsettings%3Fsetup%3Dtrue",
    `${campaign}/synthetic/${randomUUID()}`);
  console.log(JSON.stringify({ syntheticEmailAccepted: true, emailId: id, activated: 0 }));
  process.exit(0);
}

const cohortPath = typeof args.cohort === "string" ? args.cohort : "";
const ledgerPath = typeof args.ledger === "string" ? args.ledger : "";
if (!path.isAbsolute(cohortPath) || !path.isAbsolute(ledgerPath) || cohortPath === ledgerPath) {
  throw new Error("Provide distinct absolute --cohort and private --ledger paths");
}
if (apply && (!confirmed || !appReady)) {
  throw new Error("Live onboarding requires --apply --confirm=ONBOARD_KAHUNAS_CLIENTS --app-store-ready");
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase URL and service role key are required for read-only preflight");
}
if (process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://yeflmlcpqdfsfjlxofqy.supabase.co") {
  throw new Error("Refusing a Supabase project other than the verified Gordy production project");
}
if (apply && (process.env.NEXT_PUBLIC_SITE_URL !== "https://app.onlinegordy.com" || !process.env.RESEND_API_KEY)) {
  throw new Error("Live onboarding requires production NEXT_PUBLIC_SITE_URL and RESEND_API_KEY");
}

const cohortSource = readFileSync(cohortPath, "utf8");
const cohort = JSON.parse(cohortSource);
validateMigrationCohort(cohort);
const cohortSha256 = createHash("sha256").update(cohortSource).digest("hex");
let ledger = { version: 1, campaign, cohortSha256, createdAt: new Date().toISOString(), clients: {} };
if (existsSync(ledgerPath)) {
  if ((statSync(ledgerPath).mode & 0o077) !== 0) throw new Error("Existing ledger must be owner-only (chmod 600)");
  ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
  if (ledger.version !== 1 || ledger.campaign !== campaign || ledger.cohortSha256 !== cohortSha256 || !ledger.clients) {
    throw new Error("Ledger does not match this exact campaign/cohort snapshot");
  }
  if (Object.keys(ledger.clients).some((id) => !cohort.some((client) => client.id === id))) throw new Error("Ledger contains recipients outside the cohort");
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
async function must(promise, context) {
  const result = await promise;
  if (result.error) throw new Error(context);
  return result.data;
}
async function readClient(client) {
  const profile = await must(admin.from("client_profiles")
    .select("id,user_id,lifecycle_status,onboarding_status,user:users!client_profiles_user_id_fkey(id,email,full_name,role)")
    .eq("id", client.id).maybeSingle(), "Live client profile read failed");
  const authData = await must(admin.auth.admin.getUserById(client.user_id), "Live auth identity read failed");
  if (!profile || !authData?.user) throw new Error("Live client identity was not found");
  profile.user = Array.isArray(profile.user) ? profile.user[0] : profile.user;
  const state = validateLiveMigrationClient(client, profile, authData.user, ledger.clients[client.id]);
  return { profile, auth: authData.user, state };
}

// First inspect the entire approved cohort. A bad row prevents starting the batch.
const counts = { frozen: 0, pending: 0, activated: 0, alreadyAccepted: 0, eligibleToSend: 0 };
for (const client of cohort) {
  const entry = ledger.clients[client.id];
  if (entry?.status === "accepted" && !entry.emailId) throw new Error("Accepted ledger record has no provider email ID");
  assertMigrationRetryWindow(entry || {});
  const { state } = await readClient(client);
  counts[state] += 1;
  if (entry?.status === "accepted") counts.alreadyAccepted += 1;
  else counts.eligibleToSend += 1;
}
if (!apply) {
  console.log(JSON.stringify({ dryRun: true, campaign, cohortCount: cohort.length, ...counts, accountMutations: 0, emailsSent: 0 }, null, 2));
  process.exit(0);
}

mkdirSync(path.dirname(ledgerPath), { recursive: true, mode: 0o700 });
const lockPath = `${ledgerPath}.lock`;
let lock;
try { lock = openSync(lockPath, "wx", 0o600); }
catch { throw new Error(`Batch lock already exists; inspect the owning process before retrying: ${lockPath}`); }
writeFileSync(lock, JSON.stringify({ pid: process.pid, campaign, createdAt: new Date().toISOString() }));
closeSync(lock);

function saveLedger() {
  const temp = `${ledgerPath}.tmp-${randomUUID()}`;
  const fd = openSync(temp, "wx", 0o600);
  try {
    writeFileSync(fd, JSON.stringify(ledger, null, 2));
    fsyncSync(fd);
  } finally { closeSync(fd); }
  renameSync(temp, ledgerPath);
}

async function activate(client, entry) {
  let live = await readClient(client);
  if (live.state === "activated") return;
  entry.activationStartedAt ||= new Date().toISOString();
  saveLedger();
  const metadata = live.auth.user_metadata || {};
  if (live.state === "frozen") {
    await must(admin.auth.admin.updateUserById(client.user_id, {
      email: client.user.email.trim().toLowerCase(), email_confirm: true, ban_duration: "none",
      user_metadata: { ...metadata, preview_import_frozen: true, preview_activation_pending: true, requires_password_setup: true },
    }), "Auth promotion failed; stop and rerun this batch to resume");
    entry.authPromotedAt = new Date().toISOString();
    saveLedger();
  }
  live = await readClient(client);
  if (live.profile.lifecycle_status === "access_frozen" || live.profile.onboarding_status !== "active") {
    await must(admin.from("client_profiles").update({
      lifecycle_status: "active", onboarding_status: "active", lifecycle_paused_at: null,
      lifecycle_resumes_at: null, activated_at: new Date().toISOString(),
    }).eq("id", client.id).eq("user_id", client.user_id), "Client profile activation failed; rerun to resume");
    entry.profileActivatedAt = new Date().toISOString();
    saveLedger();
  }
  const currentAuth = await must(admin.auth.admin.getUserById(client.user_id), "Auth finalisation read failed");
  await must(admin.auth.admin.updateUserById(client.user_id, {
    user_metadata: { ...currentAuth.user.user_metadata, preview_import_frozen: false, preview_activation_pending: false, requires_password_setup: true },
  }), "Auth finalisation failed; rerun to resume");
  entry.activatedAt = new Date().toISOString();
  saveLedger();
  const verification = await readClient(client);
  if (verification.state !== "activated") throw new Error("Client activation did not verify");
}

let acceptedThisRun = 0;
try {
  saveLedger();
  for (const client of cohort) {
    let entry = ledger.clients[client.id];
    if (entry?.status === "accepted") continue;
    entry ||= ledger.clients[client.id] = { userId: client.user_id, status: "activation_pending", idempotencyKey: `${campaign}/${client.id}` };
    if (entry.userId !== client.user_id || entry.idempotencyKey !== `${campaign}/${client.id}`) throw new Error("Ledger recipient binding is invalid");
    assertMigrationRetryWindow(entry);
    await activate(client, entry);
    const verified = await readClient(client);
    if (verified.state !== "activated") throw new Error("Client is not active before sending");
    if (!entry.payload) {
      if (verified.auth.last_sign_in_at && !entry.sendStartedAt) throw new Error("Client signed in before email; manual review required");
      const link = await must(admin.auth.admin.generateLink({ type: "recovery", email: client.user.email.trim().toLowerCase() }), "Setup link generation failed");
      if (!link.properties?.hashed_token || link.user?.id !== client.user_id) throw new Error("Generated setup link is not bound to this client");
      const setupUrl = buildAccountRecoveryUrl(link.properties.hashed_token, "setup");
      entry.payload = {
        to: client.user.email.trim().toLowerCase(), name: client.user.full_name, setupUrl,
        message: prepareMigrationWelcomeEmail(client.user.email.trim().toLowerCase(), client.user.full_name, setupUrl),
      };
      entry.payloadSha256 = createHash("sha256").update(JSON.stringify(entry.payload)).digest("hex");
      entry.payloadCreatedAt = new Date().toISOString();
      entry.status = "payload_ready";
      saveLedger();
    }
    if (entry.payload.to !== client.user.email.trim().toLowerCase() || entry.payload.name !== client.user.full_name
      || entry.payload.message?.to !== entry.payload.to
      || entry.payloadSha256 !== createHash("sha256").update(JSON.stringify(entry.payload)).digest("hex")) {
      throw new Error("Ledger email payload does not match approved recipient or original message");
    }
    entry.sendStartedAt ||= new Date().toISOString();
    entry.status = "sending";
    saveLedger();
    let emailId;
    try {
      emailId = await sendPreparedMigrationWelcomeEmail(entry.payload.message, entry.idempotencyKey);
    } catch {
      entry.status = "unknown_or_rejected";
      entry.lastAttemptAt = new Date().toISOString();
      saveLedger();
      throw new Error(`Email acceptance is uncertain or rejected for client ${client.id}; batch stopped. Retry only with this ledger and unchanged payload within the safe window.`);
    }
    entry.status = "accepted"; entry.emailId = emailId; entry.acceptedAt = new Date().toISOString();
    // Persist acceptance before removing the retry payload. If this write fails,
    // the durable 'sending' record still contains the original message and key.
    saveLedger();
    delete entry.payload;
    saveLedger();
    acceptedThisRun += 1;
    console.log(JSON.stringify({ accepted: acceptedThisRun, previouslyAccepted: counts.alreadyAccepted, total: cohort.length, clientId: client.id, emailId }));
    // Keep below Resend's ordinary two requests/second rate.
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  console.log(JSON.stringify({ complete: true, cohortCount: cohort.length, acceptedThisRun, previouslyAccepted: counts.alreadyAccepted }));
} finally {
  unlinkSync(lockPath);
}
