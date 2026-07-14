import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolveClientLifecycleStatus,
  type ClientLifecycleStatus,
} from "@/lib/client-attention";

export async function getClientLifecycleForUser(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("client_profiles")
    .select("id, lifecycle_status, lifecycle_resumes_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Lifecycle lookup failed: ${error.message}`);
  if (!data) return null;

  let current = data;
  let effectiveStatus = resolveClientLifecycleStatus(current.lifecycle_status, current.lifecycle_resumes_at);
  if (effectiveStatus === "active" && data.lifecycle_status !== "active") {
    const { data: resumed, error: resumeError } = await admin.rpc("resume_client_if_due", {
      p_client_id: data.id,
    });
    if (resumeError) throw new Error(`Automatic lifecycle resume failed: ${resumeError.message}`);
    if (resumed) {
      return { clientId: data.id as string, status: "active" as const, resumesAt: null };
    }

    const { data: refreshed, error: refreshError } = await admin
      .from("client_profiles")
      .select("id, lifecycle_status, lifecycle_resumes_at")
      .eq("id", data.id)
      .maybeSingle();
    if (refreshError || !refreshed) {
      throw new Error(`Lifecycle refresh failed: ${refreshError?.message || "Client not found"}`);
    }
    current = refreshed;
    effectiveStatus = resolveClientLifecycleStatus(current.lifecycle_status, current.lifecycle_resumes_at);
  }

  return {
    clientId: current.id as string,
    status: effectiveStatus as ClientLifecycleStatus,
    resumesAt: (current.lifecycle_resumes_at as string | null) || null,
  };
}

export async function getClientNotificationSuppression(userId: string) {
  let lifecycle;
  try {
    lifecycle = await getClientLifecycleForUser(userId);
  } catch (error) {
    console.error("Unable to verify client lifecycle before notification:", error);
    return {
      suppressed: true as const,
      reason: "Client notification status could not be verified; delivery was suppressed.",
      lifecycleStatus: null,
    };
  }
  if (!lifecycle || lifecycle.status === "active") return null;

  return {
    suppressed: true as const,
    reason: lifecycle.status === "access_frozen"
      ? "Client access is frozen; notifications are suppressed."
      : "Client coaching is paused; notifications are suppressed.",
    lifecycleStatus: lifecycle.status,
  };
}
