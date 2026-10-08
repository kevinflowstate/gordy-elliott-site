import type { CreateEmailResponse } from "resend";
import { createAdminClient } from "./supabase/admin";
import type { EmailKind } from "./email-delivery";

export class TrackedEmailError extends Error {
  constructor(public readonly sendStatus: "failed" | "unknown", message: string) { super(message); }
}

// A send is attempted only after its tracking row is durable. Completion failure
// after provider acceptance must not turn an accepted send into a failed send or
// encourage duplicate emails. Its pre-send row remains available for diagnosis.
export async function sendTrackedClientEmail(
  to: string, kind: EmailKind, send: (idempotencyKey: string) => Promise<CreateEmailResponse>,
  clientId?: string, idempotencyKey?: string,
): Promise<CreateEmailResponse> {
  return trackClientEmailSend(createAdminClient(), to, kind, send, clientId, idempotencyKey);
}

export async function trackClientEmailSend(
  admin: ReturnType<typeof createAdminClient>, to: string, kind: EmailKind,
  send: (idempotencyKey: string) => Promise<CreateEmailResponse>, clientId?: string, idempotencyKey?: string,
): Promise<CreateEmailResponse> {
  if (!clientId) {
    const { data: user, error: userError } = await admin.from("users").select("id, role").eq("email", to.trim().toLowerCase()).maybeSingle();
    if (userError) throw new TrackedEmailError("failed", "Email tracking identity lookup failed");
    // An admin resetting their own password is outside client onboarding.
    if (user?.role === "admin") return send(idempotencyKey || crypto.randomUUID());
    const { data: profile, error } = await admin.from("client_profiles").select("id").eq("user_id", user?.id || "00000000-0000-0000-0000-000000000000").maybeSingle();
    if (error || !profile) throw new TrackedEmailError("failed", "Client email tracking identity could not be resolved");
    clientId = profile.id;
  }
  const { data: identity, error: identityError } = await admin.from("client_profiles")
    .select("id, user:users!client_profiles_user_id_fkey(email, role)").eq("id", clientId).maybeSingle();
  const identityUser = Array.isArray(identity?.user) ? identity.user[0] : identity?.user;
  if (identityError || !identityUser || identityUser.role !== "client" || identityUser.email?.trim().toLowerCase() !== to.trim().toLowerCase()) {
    throw new TrackedEmailError("failed", "Client email tracking identity does not match this recipient");
  }
  const attemptId = crypto.randomUUID();
  const key = idempotencyKey || `client-email/${attemptId}`;
  const { error: insertError } = await admin.from("client_email_attempts").upsert({
    id: attemptId, client_id: clientId, kind, idempotency_key: key, status: "sending",
  }, { onConflict: "idempotency_key", ignoreDuplicates: true });
  if (insertError) throw new TrackedEmailError("failed", "Email tracking is unavailable; no email was attempted");
  const { data: attempt, error: attemptError } = await admin.from("client_email_attempts")
    .select("id, client_id, kind, status, provider_email_id").eq("idempotency_key", key).single();
  if (attemptError || !attempt || attempt.client_id !== clientId || attempt.kind !== kind) {
    throw new TrackedEmailError("failed", "Email tracking identity does not match this send");
  }
  if (attempt.status === "accepted" && attempt.provider_email_id) {
    return { data: { id: attempt.provider_email_id }, error: null, headers: null };
  }
  let result: CreateEmailResponse;
  try { result = await send(key); }
  catch {
    await admin.from("client_email_attempts").update({ status: "unknown" }).eq("id", attempt.id).is("provider_email_id", null);
    throw new TrackedEmailError("unknown", "Email provider acceptance is uncertain; check delivery tracking before retrying");
  }
  if (result.error || !result.data?.id) {
    await admin.from("client_email_attempts").update({ status: "failed" }).eq("id", attempt.id).is("provider_email_id", null);
    throw new TrackedEmailError("failed", "Email provider rejected the send");
  }
  try {
    const { error: completionError } = await admin.from("client_email_attempts").update({
      status: "accepted", provider_email_id: result.data.id, accepted_at: new Date().toISOString(),
    }).eq("id", attempt.id);
    if (completionError) throw completionError;
  } catch {
    console.error("[CLIENT_EMAIL] Accepted by provider but tracking completion failed", { attemptId: attempt.id, emailId: result.data.id });
  }
  return result;
}
