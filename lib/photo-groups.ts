import { SupabaseClient } from "@supabase/supabase-js";

interface PhotoGroup {
  date: string;
  front?: string;
  back?: string;
  side?: string;
  signedUrls: Record<string, string>;
}

export async function getPhotoGroups(
  admin: SupabaseClient,
  clientId: string
): Promise<{ groups: PhotoGroup[]; error?: string }> {
  const { data: files, error: listError } = await admin.storage
    .from("progress-photos")
    .list(clientId, { sortBy: { column: "name", order: "asc" } });

  if (listError) {
    return { groups: [], error: listError.message };
  }

  if (!files || files.length === 0) {
    return { groups: [] };
  }

  const dateGroups: Record<string, { front?: string; back?: string; side?: string; signedUrls: Record<string, string> }> = {};

  for (const dateFolder of files) {
    if (!dateFolder.id) continue;

    const { data: photoFiles } = await admin.storage
      .from("progress-photos")
      .list(`${clientId}/${dateFolder.name}`);

    if (!photoFiles || photoFiles.length === 0) continue;

    const paths = photoFiles.map((f) => `${clientId}/${dateFolder.name}/${f.name}`);

    const { data: signedData } = await admin.storage
      .from("progress-photos")
      .createSignedUrls(paths, 3600);

    const signedUrls: Record<string, string> = {};
    const angles: { front?: string; back?: string; side?: string } = {};

    for (const signed of signedData || []) {
      if (!signed.path) continue;
      const parts = signed.path.split("/");
      const fileName = parts[parts.length - 1];
      const angle = fileName.replace(/\.[^.]+$/, "");
      signedUrls[angle] = signed.signedUrl;
      if (angle === "front" || angle === "back" || angle === "side") {
        angles[angle] = signed.signedUrl;
      }
    }

    dateGroups[dateFolder.name] = { ...angles, signedUrls };
  }

  const groups = Object.entries(dateGroups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, data]) => ({ date, ...data }));

  return { groups };
}
