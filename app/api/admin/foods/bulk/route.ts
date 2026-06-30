import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

type ParsedFood = {
  name: string;
  category: string;
  serving_size: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
  sugar_g: number;
  photo_url: string | null;
};

function normaliseKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function toNumber(value: string | undefined): number {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function splitLine(line: string): string[] {
  const delimiter = line.includes("\t") ? "\t" : ",";
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseFoods(raw: string): { rows: ParsedFood[]; errors: string[] } {
  const rows: ParsedFood[] = [];
  const errors: string[] = [];
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  for (const [idx, line] of lines.entries()) {
    const cols = splitLine(line);
    const [nameRaw, categoryRaw, servingRaw, caloriesRaw, proteinRaw, carbsRaw, fatRaw, fibreRaw, sugarRaw, photoRaw] = cols;
    if (idx === 0 && normaliseKey(nameRaw || "") === "name") continue;

    const name = nameRaw?.trim();
    if (!name) {
      errors.push(`Line ${idx + 1}: missing food name`);
      continue;
    }

    rows.push({
      name,
      category: categoryRaw?.trim() || "other",
      serving_size: servingRaw?.trim() || "100g",
      calories: toNumber(caloriesRaw),
      protein_g: toNumber(proteinRaw),
      carbs_g: toNumber(carbsRaw),
      fat_g: toNumber(fatRaw),
      fibre_g: toNumber(fibreRaw),
      sugar_g: toNumber(sugarRaw),
      photo_url: photoRaw?.trim() || null,
    });
  }

  return { rows, errors };
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const raw = typeof body.text === "string" ? body.text : "";
  if (!raw.trim()) return NextResponse.json({ error: "Paste at least one food row" }, { status: 400 });

  const parsed = parseFoods(raw);
  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: "No valid food rows found", errors: parsed.errors }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("foods")
    .select("name")
    .eq("is_active", true);

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  const seen = new Set((existing || []).map((food) => normaliseKey(food.name)));
  const toInsert: ParsedFood[] = [];
  const skipped: string[] = [];

  for (const row of parsed.rows) {
    const key = normaliseKey(row.name);
    if (seen.has(key)) {
      skipped.push(row.name);
      continue;
    }
    seen.add(key);
    toInsert.push(row);
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ imported: [], skipped, errors: parsed.errors });
  }

  const { data, error } = await admin
    .from("foods")
    .insert(toInsert)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ imported: data || [], skipped, errors: parsed.errors });
}
