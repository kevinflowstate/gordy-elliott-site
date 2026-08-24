import { safeLocalRedirect } from "@/lib/safe-redirect";

export type NativeAppLink =
  | { action: "navigate"; href: string }
  | { action: "open-browser"; href: string };

export function isNativeAppRoute(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/auth/callback" ||
    pathname === "/portal" ||
    pathname.startsWith("/portal/")
  );
}

export function resolveNativeAppLink(value: string, appHost: string): NativeAppLink | null {
  try {
    const destination = new URL(value);

    if (["atcapacity:", "shiftcoaching:"].includes(destination.protocol)) {
      const path = `/${destination.host}${destination.pathname}`.replace(/\/{2,}/g, "/");
      if (!isNativeAppRoute(path)) return null;

      if (path === "/login") {
        const query = new URLSearchParams({
          redirect: safeLocalRedirect(destination.searchParams.get("redirect")),
        });
        return { action: "navigate", href: `/login?${query}` };
      }

      return {
        action: "navigate",
        href: `${path}${destination.search}${destination.hash}`,
      };
    }

    if (!["http:", "https:"].includes(destination.protocol) || destination.host !== appHost) {
      return null;
    }

    if (!isNativeAppRoute(destination.pathname)) {
      return { action: "open-browser", href: destination.href };
    }

    return {
      action: "navigate",
      href: `${destination.pathname}${destination.search}${destination.hash}`,
    };
  } catch {
    return null;
  }
}
