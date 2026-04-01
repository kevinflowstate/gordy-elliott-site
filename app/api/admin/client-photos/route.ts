import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Verify admin role
  const { data: adminUser } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!adminUser || adminUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  // List all files in the client's folder
  const { data: files, error: listError } = await admin.storage
    .from("progress-photos")
    .list(clientId, { sortBy: { column: "name", order: "asc" } });

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  if (!files || files.length === 0) {
    return NextResponse.json({ groups: [] });
  }

  // Each "file" here is actually a date folder - list files within each date folder
  const dateGroups: Record<string, { front?: string; back?: string; side?: string; signedUrls: Record<string, string> }> = {};

  for (const dateFolder of files) {
    if (!dateFolder.id) continue; // skip if not a folder

    const { data: photoFiles } = await admin.storage
      .from("progress-photos")
      .list(`${clientId}/${dateFolder.name}`);

    if (!photoFiles || photoFiles.length === 0) continue;

    const paths = photoFiles.map((f) => `${clientId}/${dateFolder.name}/${f.name}`);

    const { data: signedData } = await admin.storage
      .from("progress-photos")
      .createSignedUrls(paths, 3600); // 1 hour expiry

    const signedUrls: Record<string, string> = {};
    const angles: { front?: string; back?: string; side?: string } = {};

    for (const signed of signedData || []) {
      if (!signed.path) continue;
      const parts = signed.path.split("/");
      const fileName = parts[parts.length - 1];
      const angle = fileName.replace(".jpg", "");
      signedUrls[angle] = signed.signedUrl;
      if (angle === "front" || angle === "back" || angle === "side") {
        angles[angle] = signed.signedUrl;
      }
    }

    dateGroups[dateFolder.name] = { ...angles, signedUrls };
  }

  // Sort by date descending
  const groups = Object.entries(dateGroups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, data]) => ({ date, ...data }));

  return NextResponse.json({ groups });
}
