import appIdentity from "@/config/app-identity.json";

function normaliseSiteUrl(value: string | undefined, allowBareHost = false) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const candidate = allowBareHost && !/^https?:\/\//i.test(trimmed)
    ? `https://${trimmed}`
    : trimmed;

  try {
    const url = new URL(candidate);
    if (
      !["http:", "https:"].includes(url.protocol)
      || !url.hostname
      || url.username
      || url.password
    ) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getSiteUrl(): string {
  const configuredSiteUrl = normaliseSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (configuredSiteUrl) return configuredSiteUrl;

  const vercelUrl = normaliseSiteUrl(process.env.VERCEL_URL, true);
  if (vercelUrl) return vercelUrl;

  return normaliseSiteUrl(appIdentity.productionUrl) || appIdentity.productionUrl;
}
