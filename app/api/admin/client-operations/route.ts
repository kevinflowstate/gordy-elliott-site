import {
  ATTENTION_SIGNALS,
  CLIENT_LIFECYCLE_STATUSES,
  MONITORING_FIELDS,
} from "@/lib/client-attention";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const LIFECYCLE_STATUSES = new Set<string>(CLIENT_LIFECYCLE_STATUSES);

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const clientId = typeof body.client_id === "string" ? body.client_id : null;
  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

  const admin = createAdminClient();
  const updatesSettings = Boolean(body.lifecycle || body.monitoring);
  const updatesSnooze = Boolean(body.snooze);
  if (updatesSettings && updatesSnooze) {
    return NextResponse.json({ error: "Update settings and attention snoozes separately" }, { status: 400 });
  }

  if (updatesSettings) {
    if (!body.lifecycle || typeof body.lifecycle !== "object") {
      return NextResponse.json({ error: "lifecycle is required when updating client settings" }, { status: 400 });
    }
    const status = String(body.lifecycle.status || "");
    if (!LIFECYCLE_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid lifecycle status" }, { status: 400 });
    }

    const requestedResume = typeof body.lifecycle.resumes_at === "string" && body.lifecycle.resumes_at
      ? new Date(body.lifecycle.resumes_at)
      : null;
    if (requestedResume && Number.isNaN(requestedResume.getTime())) {
      return NextResponse.json({ error: "Invalid resume date" }, { status: 400 });
    }
    const resumesAt = requestedResume?.toISOString() || null;
    const note = typeof body.lifecycle.note === "string" ? body.lifecycle.note.trim().slice(0, 500) : null;
    let monitoring: Record<string, boolean> | null = null;
    if (body.monitoring) {
      if (typeof body.monitoring !== "object") {
        return NextResponse.json({ error: "Invalid monitoring settings" }, { status: 400 });
      }
      monitoring = {};
      for (const field of MONITORING_FIELDS) {
        if (typeof body.monitoring[field] !== "boolean") {
          return NextResponse.json({ error: `Invalid monitoring setting: ${field}` }, { status: 400 });
        }
        monitoring[field] = body.monitoring[field];
      }
    }

    const { error } = await admin.rpc("update_client_operations", {
      p_client_id: clientId,
      p_status: status,
      p_resumes_at: status === "active" ? null : resumesAt,
      p_note: status === "active" ? null : note,
      p_monitoring: monitoring,
    });
    if (error) {
      const statusCode = error.message.includes("Client not found") ? 404 : 500;
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }
  }

  if (body.snooze) {
    const signal = String(body.snooze.signal || "");
    const mode = String(body.snooze.mode || "");
    if (!ATTENTION_SIGNALS.includes(signal as (typeof ATTENTION_SIGNALS)[number])) {
      return NextResponse.json({ error: "Invalid attention signal" }, { status: 400 });
    }

    if (mode === "clear") {
      const { error } = await admin
        .from("client_attention_snoozes")
        .delete()
        .eq("client_id", clientId)
        .eq("signal", signal);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else if (mode === "ignore" || mode === "snooze") {
      const requestedUntil = mode === "snooze" && body.snooze.until
        ? new Date(String(body.snooze.until))
        : null;
      if (requestedUntil && Number.isNaN(requestedUntil.getTime())) {
        return NextResponse.json({ error: "Invalid snooze date" }, { status: 400 });
      }
      const until = requestedUntil?.toISOString() || null;
      if (mode === "snooze" && !until) {
        return NextResponse.json({ error: "A snooze date is required" }, { status: 400 });
      }
      const { error } = await admin
        .from("client_attention_snoozes")
        .upsert({
          client_id: clientId,
          signal,
          ignored: mode === "ignore",
          snoozed_until: until,
          reason: typeof body.snooze.reason === "string" ? body.snooze.reason.trim().slice(0, 300) : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "client_id,signal" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      return NextResponse.json({ error: "Invalid snooze mode" }, { status: 400 });
    }
  }

  if (!updatesSettings && !updatesSnooze) {
    return NextResponse.json({ error: "No client operation was provided" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
