const LOCAL_REDIRECT_ORIGIN = "https://shift.local";

function normaliseLocalPath(value: string | null | undefined) {
  if (
    !value
    || !value.startsWith("/")
    || value.startsWith("//")
    || value.includes("\\")
    || /[\u0000-\u001f\u007f]/.test(value)
  ) return null;

  try {
    const destination = new URL(value, LOCAL_REDIRECT_ORIGIN);
    if (
      destination.origin !== LOCAL_REDIRECT_ORIGIN
      || !destination.pathname.startsWith("/")
      || destination.pathname.startsWith("//")
    ) return null;

    const localPath = `${destination.pathname}${destination.search}${destination.hash}`;
    return localPath.startsWith("//") ? null : localPath;
  } catch {
    return null;
  }
}

export function safeLocalRedirect(value: string | null | undefined, fallback = "/portal") {
  const safeFallback = normaliseLocalPath(fallback) ?? "/portal";
  return normaliseLocalPath(value) ?? safeFallback;
}
