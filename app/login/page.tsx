"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/portal";
  const callbackError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Fetch role via API to bypass RLS
      const roleRes = await fetch("/api/portal/me");
      const roleData = roleRes.ok ? await roleRes.json() : null;
      const role = roleData?.role;

      if (role === "admin") {
        router.push("/admin");
      } else {
        router.push(redirect);
      }
    }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    setResetMessage("");
    setError("");

    try {
      const res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't request a reset link.");
      } else {
        setResetMessage(data.message || "If that email belongs to a portal account, a reset link will be sent.");
      }
    } catch {
      setError("Couldn't request a reset link.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-[400px] w-full">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-4">
            <Image src="/images/shift-logo.svg" alt="SHIFT" width={48} height={48} className="h-12 w-auto mx-auto" />
          </Link>
          <h1 className="font-heading text-2xl font-black mb-2">Client Portal</h1>
          <p className="text-text-secondary text-sm">{resetMode ? "Reset your password" : "Sign in to access your dashboard"}</p>
        </div>

        <form onSubmit={resetMode ? handlePasswordReset : handleSubmit} className="bg-bg-card border border-[rgba(0,0,0,0.08)] rounded-[20px] p-8">
          {callbackError === "setup_link_invalid" && !error && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-sm">
              That setup link has expired or is invalid. Please ask Gordy to resend your setup email.
            </div>
          )}
          {resetMessage && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
              {resetMessage}
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          {resetMode ? (
            <>
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-secondary mb-2">Email</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full h-11 bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 text-text-primary text-sm focus:outline-none focus:border-accent/40 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full h-11 gradient-accent rounded-xl flex items-center justify-center text-white font-semibold text-sm disabled:opacity-60 transition-opacity"
              >
                {resetLoading ? "Sending..." : "Send Reset Link"}
              </button>
            </>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-text-secondary mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full h-11 bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 text-text-primary text-sm focus:outline-none focus:border-accent/40 transition-colors"
                />
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium text-text-secondary mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full h-11 bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 text-text-primary text-sm focus:outline-none focus:border-accent/40 transition-colors"
                />
              </div>

              <div className="mb-6 text-right">
                <button
                  type="button"
                  onClick={() => {
                    setResetMode(true);
                    setResetEmail(email);
                    setError("");
                    setResetMessage("");
                  }}
                  className="text-xs font-semibold text-[#E040D0] hover:text-[#b830a8]"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 gradient-accent rounded-xl flex items-center justify-center text-white font-semibold text-sm disabled:opacity-60 transition-opacity"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </>
          )}
        </form>

        <p className="text-center text-text-muted text-xs mt-6">
          {resetMode ? (
            <button
              type="button"
              onClick={() => {
                setResetMode(false);
                setError("");
                setResetMessage("");
              }}
              className="text-text-muted hover:text-text-secondary transition-colors"
            >
              Back to sign in
            </button>
          ) : (
            <Link href="/" className="text-text-muted hover:text-text-secondary transition-colors no-underline">
              Back to main site
            </Link>
          )}
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
