/** Bounded registration request, including older iPhones without AbortSignal.timeout. */
export async function postPushRegistration(endpoint: "/api/push/native" | "/api/push/subscribe", payload: unknown) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return response.ok;
  } finally {
    clearTimeout(timeout);
  }
}
