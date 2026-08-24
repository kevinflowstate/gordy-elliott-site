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
