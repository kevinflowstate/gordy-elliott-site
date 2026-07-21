import { SupabaseClient } from "@supabase/supabase-js";

interface PhotoGroup {
  date: string;
  front?: string;
  back?: string;
  side?: string;
  signedUrls: Record<string, string>;
}

export function getProgressPhotoDateFolders(files: Array<{ name: string }>) {
  return files
    .map((file) => file.name)
    .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name));
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

  for (const folderName of getProgressPhotoDateFolders(files)) {
    const { data: photoFiles, error: photoListError } = await admin.storage
      .from("progress-photos")
      .list(`${clientId}/${folderName}`);

    if (photoListError || !photoFiles || photoFiles.length === 0) continue;

    const paths = photoFiles
      .filter((file) => Boolean(file.id) && !file.name.startsWith("."))
      .map((file) => `${clientId}/${folderName}/${file.name}`);

    if (paths.length === 0) continue;

    const { data: signedData, error: signedUrlError } = await admin.storage
      .from("progress-photos")
      .createSignedUrls(paths, 3600);

    if (signedUrlError) continue;

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

    if (Object.keys(signedUrls).length > 0) {
      dateGroups[folderName] = { ...angles, signedUrls };
    }
  }

  const groups = Object.entries(dateGroups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, data]) => ({ date, ...data }));

  return { groups };
}
