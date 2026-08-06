import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function createAppReviewBrowserCookies({
  baseUrl,
  reviewEmail = (process.env.APP_REVIEW_EMAIL || "demo@flowstatesystems.ai").toLowerCase(),
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error(
      "Set PORTAL_QA_STORAGE_STATE or provide the Supabase QA credentials needed for temporary App Review authentication.",
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authError) throw authError;

  const authUser = authData.users.find((user) => user.email?.toLowerCase() === reviewEmail);
  if (!authUser || authUser.user_metadata?.app_review_fixture !== true) {
    throw new Error(`Refusing temporary QA authentication: ${reviewEmail} is not marked as the App Review fixture.`);
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: reviewEmail,
  });
  if (linkError || (!link.properties?.hashed_token && !link.properties?.email_otp)) {
    throw new Error(linkError?.message || "Could not create temporary App Review authentication.");
  }

  const authCookies = [];
  const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => [],
      setAll: (cookies) => authCookies.push(...cookies),
    },
  });
  const verifyOptions = link.properties.email_otp
    ? { email: reviewEmail, token: link.properties.email_otp, type: "email" }
    : { token_hash: link.properties.hashed_token, type: "magiclink" };
  const { error: verifyError } = await authClient.auth.verifyOtp(verifyOptions);
  if (verifyError) throw new Error(`Could not authenticate the App Review fixture: ${verifyError.message}`);

  const secure = new URL(baseUrl).protocol === "https:";
  return authCookies.map(({ name, value, options }) => ({
    name,
    value,
    url: baseUrl,
    httpOnly: options?.httpOnly,
    secure,
    sameSite: options?.sameSite === "strict"
      ? "Strict"
      : options?.sameSite === "none"
        ? "None"
        : "Lax",
  }));
}
