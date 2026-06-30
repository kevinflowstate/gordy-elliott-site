import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

type ParsedExercise = {
  name: string;
  muscle_group: string;
  equipment: string;
  description: string | null;
  video_url: string | null;
};

function normaliseKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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

function parseExercises(raw: string): { rows: ParsedExercise[]; errors: string[] } {
  const rows: ParsedExercise[] = [];
  const errors: string[] = [];
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  for (const [idx, line] of lines.entries()) {
    const cols = splitLine(line);
    const [nameRaw, muscleRaw, equipmentRaw, descriptionRaw, videoRaw] = cols;
    if (idx === 0 && normaliseKey(nameRaw || "") === "name") continue;

    const name = nameRaw?.trim();
    const muscle_group = muscleRaw?.trim() || "full_body";
    if (!name) {
      errors.push(`Line ${idx + 1}: missing exercise name`);
      continue;
    }

    rows.push({
      name,
      muscle_group,
      equipment: equipmentRaw?.trim() || "bodyweight",
      description: descriptionRaw?.trim() || null,
      video_url: videoRaw?.trim() || null,
    });
  }

  return { rows, errors };
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const raw = typeof body.text === "string" ? body.text : "";
  if (!raw.trim()) return NextResponse.json({ error: "Paste at least one exercise row" }, { status: 400 });

  const parsed = parseExercises(raw);
  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: "No valid exercise rows found", errors: parsed.errors }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("exercises")
    .select("name")
    .eq("is_active", true);

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  const seen = new Set((existing || []).map((exercise) => normaliseKey(exercise.name)));
  const toInsert: ParsedExercise[] = [];
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
    .from("exercises")
    .insert(toInsert)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ imported: data || [], skipped, errors: parsed.errors });
}
