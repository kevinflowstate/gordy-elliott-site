import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type AdminClient = ReturnType<typeof createAdminClient>;

async function listStoragePaths(admin: AdminClient, bucket: string, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw error;

    for (const item of data || []) {
      const itemPath = `${prefix}/${item.name}`;
      if (item.id) paths.push(itemPath);
      else paths.push(...await listStoragePaths(admin, bucket, itemPath));
    }

    if (!data || data.length < 1000) break;
    offset += data.length;
  }

  return paths;
}

async function removeStoragePaths(admin: AdminClient, bucket: string, paths: string[]) {
  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await admin.storage.from(bucket).remove(paths.slice(index, index + 100));
    if (error) throw error;
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (body?.confirmation !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm account deletion." }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: account, error: accountError }, { data: profile, error: profileError }] = await Promise.all([
    admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle(),
    admin
      .from("client_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (accountError || profileError) return NextResponse.json({ error: "Unable to verify your account." }, { status: 500 });
  if (account?.role === "admin") {
    return NextResponse.json({ error: "Admin accounts cannot be deleted from the client portal." }, { status: 403 });
  }

  try {
    const avatarPaths = await listStoragePaths(admin, "avatars", user.id);
    await removeStoragePaths(admin, "avatars", avatarPaths);

    if (profile) {
      const [{ data: documents, error: documentsError }, progressPaths] = await Promise.all([
        admin
          .from("client_documents")
          .select("storage_bucket, storage_path")
          .eq("client_id", profile.id),
        listStoragePaths(admin, "progress-photos", profile.id),
      ]);
      if (documentsError) throw documentsError;

      const documentsByBucket = new Map<string, string[]>();
      for (const document of documents || []) {
        documentsByBucket.set(document.storage_bucket, [
          ...(documentsByBucket.get(document.storage_bucket) || []),
          document.storage_path,
        ]);
      }
      await Promise.all([
        removeStoragePaths(admin, "progress-photos", progressPaths),
        ...Array.from(documentsByBucket, ([bucket, paths]) => removeStoragePaths(admin, bucket, paths)),
      ]);
    }
  } catch {
    return NextResponse.json({ error: "Your uploaded files could not be removed. Please try again." }, { status: 500 });
  }

  // Deleting the auth user cascades through the client-owned database records.
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: "Your account could not be deleted. Please try again." }, { status: 500 });

  return NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
