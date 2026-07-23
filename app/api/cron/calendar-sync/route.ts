import { syncCalendarConnection } from "@/lib/composio/calendar";
import type { CalendarConnection } from "@/lib/composio/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.COMPOSIO_API_KEY) {
    return NextResponse.json({ error: "Composio is not configured" }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: connections, error } = await admin
    .from("client_calendar_connections")
    .select("*")
    .eq("status", "connected")
    .not("composio_connected_account_id", "is", null)
    .order("last_sync_at", { ascending: true, nullsFirst: true })
    .limit(40);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: Array<{ id: string; ok: boolean; eventCount?: number }> = [];
  const pending = connections || [];
  for (let index = 0; index < pending.length; index += 5) {
    const batch = pending.slice(index, index + 5);
    const batchResults = await Promise.all(batch.map(async (connection) => {
      try {
        const result = await syncCalendarConnection(admin, connection as CalendarConnection);
        return { id: connection.id, ok: true, eventCount: result.eventCount };
      } catch {
        return { id: connection.id, ok: false };
      }
    }));
    results.push(...batchResults);
  }

  return NextResponse.json({
    attempted: results.length,
    succeeded: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
  });
}
