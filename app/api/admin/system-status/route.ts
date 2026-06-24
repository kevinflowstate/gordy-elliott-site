import { requireAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

type StatusLevel = "ok" | "warning" | "blocked";

function envStatus(key: string): StatusLevel {
  return process.env[key] ? "ok" : "blocked";
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const emailReady = envStatus("RESEND_API_KEY");
  const pushReady = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? "ok" : "blocked";
  const brainReady = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY ? "ok" : "blocked";

  return NextResponse.json({
    checks: [
      {
        key: "site-url",
        label: "Canonical site URL",
        status: envStatus("NEXT_PUBLIC_SITE_URL"),
        detail: process.env.NEXT_PUBLIC_SITE_URL ? "Configured for links and callbacks." : "NEXT_PUBLIC_SITE_URL is missing.",
      },
      {
        key: "supabase",
        label: "Supabase connection",
        status: process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY ? "ok" : "blocked",
        detail: "Public URL, anon key, and service role key are checked without exposing values.",
      },
      {
        key: "email",
        label: "Resend email",
        status: emailReady,
        detail: emailReady === "ok" ? "API key is configured. Domain verification is still the launch gate for branded sending." : "RESEND_API_KEY is missing.",
      },
      {
        key: "push",
        label: "Push notifications",
        status: pushReady,
        detail: pushReady === "ok" ? "VAPID public and private keys are configured." : "VAPID keys are missing.",
      },
      {
        key: "cron",
        label: "Daily cron protection",
        status: envStatus("CRON_SECRET"),
        detail: "Vercel cron calls the check-in reminder endpoint; CRON_SECRET protects it.",
      },
      {
        key: "ai",
        label: "Admin/client AI",
        status: process.env.ANTHROPIC_API_KEY ? "ok" : "blocked",
        detail: process.env.ANTHROPIC_API_KEY ? "Anthropic key is configured." : "ANTHROPIC_API_KEY is missing.",
      },
      {
        key: "brain",
        label: "SHIFT Brain retrieval",
        status: brainReady,
        detail: brainReady === "ok" ? "Embedding provider key is configured." : "OPENROUTER_API_KEY or OPENAI_API_KEY is missing.",
      },
      {
        key: "auth-signups",
        label: "Public Supabase signups",
        status: "warning",
        detail: "Confirm hosted Supabase Auth email signups are disabled in the dashboard. This setting is outside SQL migrations.",
      },
    ],
  });
}
