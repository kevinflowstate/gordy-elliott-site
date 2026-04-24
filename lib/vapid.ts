export function normalizeVapidKey(key: string | undefined) {
  if (!key) return "";

  return key
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\s/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
