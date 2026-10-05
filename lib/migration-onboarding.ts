import { createHash } from "node:crypto";

type AppUser = { id: string; email: string; role: string; full_name?: string };
type AuthUser = {
  id: string;
  email?: string;
  last_sign_in_at?: string | null;
  banned_until?: string | null;
  user_metadata?: Record<string, unknown>;
};
export type MigrationCohortClient = {
  id: string;
  user_id: string;
  user: AppUser;
  auth_email: string;
  last_sign_in_at: string | null;
  metadata: Record<string, unknown>;
};
type LiveClient = {
  id: string;
  user_id: string;
  lifecycle_status: string;
  onboarding_status: string;
  user: AppUser;
};
export type ActivationState = { activationStartedAt?: string; activatedAt?: string };

export function previewMigrationEmail(email: string): string {
  return `preview-${createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 24)}@clients.invalid`;
}

export function validateMigrationCohort(cohort: MigrationCohortClient[]): void {
  if (!Array.isArray(cohort) || cohort.length !== 54) throw new Error("Cohort must contain exactly 54 imported clients");
  const ids = new Set<string>();
  const userIds = new Set<string>();
  const emails = new Set<string>();
  for (const client of cohort) {
    const email = client.user?.email?.trim().toLowerCase();
    if (!client.id || !client.user_id || client.user?.id !== client.user_id || client.user.role !== "client"
      || !email || !email.includes("@") || email.endsWith(".invalid") || !client.user.full_name
      || client.auth_email !== previewMigrationEmail(email) || client.last_sign_in_at
      || client.metadata?.preview_import_frozen !== true || client.metadata?.role !== "client"
      || client.metadata?.app_name !== "gordy-elliott-portal") {
      throw new Error("Cohort contains an unverified imported identity");
    }
    if (ids.has(client.id) || userIds.has(client.user_id) || emails.has(email)) throw new Error("Cohort contains a duplicate identity");
    ids.add(client.id); userIds.add(client.user_id); emails.add(email);
  }
}

export function validateLiveMigrationClient(
  snapshot: MigrationCohortClient,
  profile: LiveClient,
  auth: AuthUser,
  ledger: ActivationState = {},
): "frozen" | "pending" | "activated" {
  const email = snapshot.user.email.trim().toLowerCase();
  const metadata = auth.user_metadata || {};
  if (profile.id !== snapshot.id || profile.user_id !== snapshot.user_id || auth.id !== snapshot.user_id
    || profile.user?.id !== snapshot.user_id || profile.user.role !== "client"
    || profile.user.email.toLowerCase() !== email || metadata.role !== "client"
    || metadata.app_name !== "gordy-elliott-portal") throw new Error("Live client identity does not match the approved cohort");
  const frozen = auth.email === previewMigrationEmail(email) && metadata.preview_import_frozen === true;
  const pending = auth.email?.toLowerCase() === email && metadata.preview_activation_pending === true;
  const activated = auth.email?.toLowerCase() === email
    && metadata.preview_import_frozen === false && metadata.preview_activation_pending === false;
  if (frozen || pending) {
    if (auth.last_sign_in_at) throw new Error("Frozen/pending client has already signed in; manual review required");
    if (!["access_frozen", "active"].includes(profile.lifecycle_status)) throw new Error("Unexpected client lifecycle state");
    return frozen ? "frozen" : "pending";
  }
  if (activated && ledger.activationStartedAt && profile.lifecycle_status === "active" && profile.onboarding_status === "active") {
    if (auth.banned_until && Date.parse(auth.banned_until) > Date.now()) throw new Error("Activated auth identity is still banned");
    return "activated";
  }
  throw new Error("Client is not a frozen or resumable activation from this campaign");
}

export function assertMigrationRetryWindow(entry: { status?: string; sendStartedAt?: string }, now = Date.now()): void {
  if (!entry.sendStartedAt || entry.status === "accepted") return;
  const elapsed = now - Date.parse(entry.sendStartedAt);
  // Resend deduplicates a provider key for 24 hours. Leave a margin so a
  // time-boundary retry cannot become a second accepted send.
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= 23 * 60 * 60 * 1000) {
    throw new Error("Uncertain/rejected send is outside the safe retry window; manual review required");
  }
}
