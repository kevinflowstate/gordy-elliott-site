const LOCAL_REDIRECT_ORIGIN = "https://shift.local";

export function safeLocalRedirect(value: string | null | undefined, fallback = "/portal") {
  if (!value || !value.startsWith("/")) return fallback;

  try {
    const destination = new URL(value, LOCAL_REDIRECT_ORIGIN);
    if (destination.origin !== LOCAL_REDIRECT_ORIGIN) return fallback;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}
