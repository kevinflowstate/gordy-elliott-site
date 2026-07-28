import {
  buildEarlyWinView,
  londonDateKey,
  type EarlyWin,
  type EarlyWinView,
} from "@/lib/early-win";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

function normalizeEarlyWin(row: Record<string, unknown>): EarlyWin {
  return {
    ...(row as EarlyWin),
    starting_value: Number(row.starting_value),
    target_value: Number(row.target_value),
    start_date: String(row.start_date).slice(0, 10),
  };
}

async function loadCurrentReading(
  admin: AdminClient,
  earlyWin: EarlyWin,
  now = new Date(),
): Promise<{ value: number | null; date: string | null }> {
  const today = londonDateKey(now);

  if (earlyWin.source === "wearable") {
    const { data, error } = await admin
      .from("client_wearable_daily_summaries")
      .select(`summary_date, ${earlyWin.metric_key}`)
      .eq("client_id", earlyWin.client_id)
      .not(earlyWin.metric_key, "is", null)
      .gte("summary_date", earlyWin.start_date)
      .lte("summary_date", today)
      .order("summary_date", { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = (data?.[0] || null) as Record<string, unknown> | null;
    const value = row?.[earlyWin.metric_key];
    return {
      value: value === null || value === undefined ? null : Number(value),
      date: row ? String(row.summary_date) : null,
    };
  }

  if (earlyWin.source === "body_measurement") {
    const { data, error } = await admin
      .from("client_body_measurements")
      .select(`measured_date, ${earlyWin.metric_key}`)
      .eq("client_id", earlyWin.client_id)
      .not(earlyWin.metric_key, "is", null)
      .gte("measured_date", earlyWin.start_date)
      .lte("measured_date", today)
      .order("measured_date", { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = (data?.[0] || null) as Record<string, unknown> | null;
    const value = row?.[earlyWin.metric_key];
    return {
      value: value === null || value === undefined ? null : Number(value),
      date: row ? String(row.measured_date) : null,
    };
  }

  const { data, error } = await admin
    .from("client_early_win_entries")
    .select("entry_date, value")
    .eq("early_win_id", earlyWin.id)
    .lte("entry_date", today)
    .order("entry_date", { ascending: false })
    .limit(1);
  if (error) throw error;
  const entry = data?.[0] || null;
  return {
    value: entry === null ? null : Number(entry.value),
    date: entry === null ? null : String(entry.entry_date),
  };
}

export async function loadActiveEarlyWinView(
  admin: AdminClient,
  clientId: string,
  now = new Date(),
): Promise<EarlyWinView | null> {
  const { data, error } = await admin
    .from("client_early_wins")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const earlyWin = normalizeEarlyWin(data);
  const reading = await loadCurrentReading(admin, earlyWin, now);
  return buildEarlyWinView(earlyWin, reading, now);
}

export async function loadCompletedEarlyWins(admin: AdminClient, clientId: string): Promise<EarlyWin[]> {
  const { data, error } = await admin
    .from("client_early_wins")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "completed")
    .order("reviewed_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeEarlyWin);
}
