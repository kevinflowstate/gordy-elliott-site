import type { StormWarningEvaluation } from "@/lib/storm-warning";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Persist a warning through the database-owned, atomic retention boundary.
 * Both portal evaluations and Gordy's batch scan use this path so neither can
 * bypass the per-client/window audit cap.
 */
export async function persistStormWarning(
  admin: SupabaseClient,
  clientId: string,
  evaluation: StormWarningEvaluation,
) {
  if (!evaluation.warning || evaluation.severity === "none") return null;

  const { error } = await admin.rpc("log_client_storm_warning", {
    p_client_id: clientId,
    p_window_key: evaluation.windowKey,
    p_window_start: evaluation.windowStart,
    p_window_end: evaluation.windowEnd,
    p_severity: evaluation.severity,
    p_triggered_rules: evaluation.rules.filter((rule) => rule.triggered).map((rule) => rule.id),
    p_evaluation: evaluation,
    p_input_hash: evaluation.inputHash,
    p_evaluated_at: evaluation.evaluatedAt,
  });
  return error;
}
