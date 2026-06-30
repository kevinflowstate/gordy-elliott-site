import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const ALLOWED_CATEGORIES = new Set(["bloodwork", "scan", "medical", "progress", "other"]);

async function getVipClientContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id, tier")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return { error: NextResponse.json({ error: "Client profile not found" }, { status: 404 }) };
  if (profile.tier !== "vip") return { error: NextResponse.json({ error: "Document vault is VIP only" }, { status: 403 }) };
  return { admin, user, profile };
}

export async function GET() {
  const ctx = await getVipClientContext();
  if (ctx.error) return ctx.error;
  const { admin, profile } = ctx;

  const { data, error } = await admin
    .from("client_documents")
    .select("*")
    .eq("client_id", profile.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const documents = await Promise.all((data || []).map(async (doc) => {
    const { data: signed } = await admin.storage
      .from(doc.storage_bucket)
      .createSignedUrl(doc.storage_path, 60 * 10);
    return { ...doc, signed_url: signed?.signedUrl || null };
  }));

  return NextResponse.json({ documents });
}

export async function POST(request: Request) {
  const ctx = await getVipClientContext();
  if (ctx.error) return ctx.error;
  const { admin, user, profile } = ctx;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const title = String(formData.get("title") || "").trim();
  const categoryRaw = String(formData.get("category") || "bloodwork");
  const category = ALLOWED_CATEGORIES.has(categoryRaw) ? categoryRaw : "other";
  const notes = String(formData.get("notes") || "").trim();

  if (!file) return NextResponse.json({ error: "File is required" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (file.size > MAX_DOCUMENT_BYTES) return NextResponse.json({ error: "File is too large. Maximum 20MB." }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: `File type not allowed: ${file.type}` }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const storagePath = `${profile.id}/${safeName}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await admin.storage
    .from("client-documents")
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data, error } = await admin
    .from("client_documents")
    .insert({
      client_id: profile.id,
      uploaded_by: user.id,
      title,
      category,
      storage_bucket: "client-documents",
      storage_path: storagePath,
      file_name: file.name,
      file_type: file.type,
      file_size_bytes: file.size,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: data });
}

export async function DELETE(request: Request) {
  const ctx = await getVipClientContext();
  if (ctx.error) return ctx.error;
  const { admin, profile } = ctx;

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { data: doc } = await admin
    .from("client_documents")
    .select("storage_bucket, storage_path")
    .eq("id", id)
    .eq("client_id", profile.id)
    .maybeSingle();

  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  await admin.storage.from(doc.storage_bucket).remove([doc.storage_path]);
  const { error } = await admin
    .from("client_documents")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("client_id", profile.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
