import { requireAdmin } from "@/lib/admin-auth";
import { dbError } from "@/lib/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

type KeyDateInput = {
  id?: string;
  label?: string;
  date?: string;
  recurring?: boolean;
};

function normalizeKeyDates(clientId: string, keyDates: KeyDateInput[]) {
  return keyDates
    .map((item) => ({
      client_id: clientId,
      label: item.label?.trim() || "",
      date: item.date || "",
      recurring: item.recurring !== false,
    }))
    .filter((item) => item.label && item.date);
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("client_key_dates")
    .select("id, client_id, label, date, recurring, created_at")
    .eq("client_id", clientId)
    .order("date", { ascending: true });

  if (error) return dbError(error, "Couldn't load key dates. Try again.");
  return NextResponse.json({ key_dates: data || [] });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { client_id, key_dates } = await request.json();
  if (!client_id) return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  if (!Array.isArray(key_dates)) return NextResponse.json({ error: "key_dates array is required" }, { status: 400 });

  const admin = createAdminClient();
  const { error: deleteError } = await admin.from("client_key_dates").delete().eq("client_id", client_id);
  if (deleteError) return dbError(deleteError, "Couldn't save key dates. Try again.");

  const rows = normalizeKeyDates(client_id, key_dates);
  if (rows.length > 0) {
    const { error: insertError } = await admin.from("client_key_dates").insert(rows);
    if (insertError) return dbError(insertError, "Couldn't save key dates. Try again.");
  }

  const { data } = await admin
    .from("client_key_dates")
    .select("id, client_id, label, date, recurring, created_at")
    .eq("client_id", client_id)
    .order("date", { ascending: true });

  return NextResponse.json({ success: true, key_dates: data || [] });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("client_key_dates").delete().eq("id", id);
  if (error) return dbError(error, "Couldn't delete that key date. Try again.");

  return NextResponse.json({ success: true });
}
