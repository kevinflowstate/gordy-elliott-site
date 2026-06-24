import { getSiteUrl } from "@/lib/site-url";

export function buildAccountRecoveryUrl(tokenHash: string, mode: "setup" | "reset" = "setup"): string {
  const url = new URL("/auth/callback", getSiteUrl());
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", "recovery");
  url.searchParams.set("redirect", `/portal/settings?${mode}=true`);
  return url.toString();
}
