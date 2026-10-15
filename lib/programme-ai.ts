import { foundationsDayKey } from "@/lib/foundations";
import { monthStartKey, normalizeProgrammeType, programmeConfig } from "@/lib/programmes";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function getShiftAILimit(admin: AdminClient) {
  const { data } = await admin
    .from("form_config")
    .select("config")
    .eq("form_type", "programme_ai_allowances")
    .maybeSingle();
  const configured = Number(data?.config?.shift_monthly_interactions);
  return Number.isInteger(configured) && configured > 0
    ? configured
    : programmeConfig.shift.aiMonthlyLimit!;
}

export async function getProgrammeAIUsage(admin: AdminClient, clientId: string, programme: string) {
  if (programme === "foundations") {
    const day = foundationsDayKey();
    const { data, error } = await admin.from("client_ai_daily_usage").select("answered,reserved_at").eq("client_id", clientId).eq("usage_day", day).maybeSingle();
    if (error) throw new Error("Could not load daily AI allowance");
    const used = data && (data.answered || Date.parse(data.reserved_at) > Date.now() - 300_000) ? 1 : 0;
    return { limited: true, used, limit: 1, remaining: 1-used, period: "day" as const, day };
  }
  if (programme === "boardroom") return { limited: true, used: 0, limit: 0, remaining: 0 };
  if (normalizeProgrammeType(programme) !== "shift") return { limited: false, used: 0, limit: null, remaining: null };
  const limit = await getShiftAILimit(admin);
  const monthStart = monthStartKey();
  const { data } = await admin
    .from("client_ai_monthly_usage")
    .select("successful_interactions")
    .eq("client_id", clientId)
    .eq("month_start", monthStart)
    .maybeSingle();
  const used = data?.successful_interactions || 0;
  return { limited: true, used, limit, remaining: Math.max(0, limit - used), monthStart };
}

export async function claimProgrammeAIInteraction(admin: AdminClient, clientId: string, limit: number) {
  const monthStart = monthStartKey();
  const { data, error } = await admin.rpc("increment_client_ai_monthly_usage", {
    p_client_id: clientId,
    p_month_start: monthStart,
    p_limit: limit,
  });
  if (error?.code === "P0001") return { claimed: false as const, monthStart, used: limit };
  if (error) throw new Error(`AI allowance reservation failed: ${error.message}`);
  return { claimed: true as const, monthStart, used: Number(data) };
}

export async function releaseProgrammeAIInteraction(admin: AdminClient, clientId: string, monthStart: string) {
  await admin.rpc("decrement_client_ai_monthly_usage", {
    p_client_id: clientId,
    p_month_start: monthStart,
  });
}

export async function claimFoundationsAI(admin: AdminClient, clientId: string) {
  const { data, error } = await admin.rpc("claim_foundations_ai", { p_client_id: clientId });
  if (error) throw new Error("Could not reserve daily AI allowance");
  return data as { claimed: boolean; day: string; token: string | null };
}
export async function finishFoundationsAI(admin: AdminClient, clientId: string, claim: { day: string; token: string | null }, success: boolean) {
  const { data, error } = await admin.rpc("finish_foundations_ai", { p_client_id: clientId, p_day: claim.day, p_token: claim.token, p_success: success });
  if (error || (success && data !== true)) throw new Error("Could not save daily AI allowance");
}
