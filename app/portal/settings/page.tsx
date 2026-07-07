"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import CyclingStatusText from "@/components/ui/CyclingStatusText";
import { Suspense } from "react";
import type { ClientKeyDate } from "@/lib/types";

type ClientSexInput = "" | "female" | "male" | "prefer_not_to_say";

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}

async function resizeAvatarImage(file: File, maxWidth = 900): Promise<File> {
  if (!file.type.startsWith("image/") || file.type.includes("heic") || file.type.includes("heif")) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(1, maxWidth / img.width);
      if (ratio >= 1) {
        resolve(file);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.88
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

function SettingsContent() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSetup, setIsSetup] = useState(false);
  const [isReset, setIsReset] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState<ClientSexInput>("");
  const [cycleTrackingEnabled, setCycleTrackingEnabled] = useState(false);
  const [keyDates, setKeyDates] = useState<Array<Pick<ClientKeyDate, "label" | "date" | "recurring">>>([]);
  const [newKeyDate, setNewKeyDate] = useState({ label: "", date: "", recurring: true });

  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("setup") === "true") setIsSetup(true);
    if (searchParams.get("reset") === "true") setIsReset(true);
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/portal/me");
        if (res.ok) {
          const data = await res.json();
          setFullName(data.fullName || "");
          setAvatarUrl(data.avatarUrl || null);
          setDateOfBirth(data.profile?.date_of_birth || "");
          setSex(data.profile?.sex || "");
          setCycleTrackingEnabled(Boolean(data.profile?.sex === "female" && data.profile?.cycle_tracking_enabled));
          setKeyDates((data.keyDates || []).map((item: ClientKeyDate) => ({
            label: item.label,
            date: item.date,
            recurring: item.recurring,
          })));
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setAvatarMessage(null);
    setUploadingAvatar(true);

    try {
      const file = await resizeAvatarImage(selectedFile);
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("File too large. Maximum 10MB.");
      }

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/portal/avatar", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setAvatarUrl(data.avatarUrl);
        setAvatarMessage({ type: "success", text: "Profile photo updated." });
        toast("Profile photo updated");
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to upload avatar. Please try another photo.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload avatar. Please try another photo.";
      setAvatarMessage({ type: "error", text: message });
      toast(message, "error");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const res = await fetch("/api/portal/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        dateOfBirth,
        sex,
        cycleTrackingEnabled: sex === "female" && cycleTrackingEnabled,
        keyDates,
      }),
    });

    setSaving(false);
    if (res.ok) {
      setSaved(true);
      toast("Settings saved successfully");
      setTimeout(() => setSaved(false), 3000);
    } else {
      toast("Failed to save settings. Please try again.");
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function addKeyDate() {
    if (!newKeyDate.label.trim() || !newKeyDate.date) return;
    setKeyDates((prev) => [...prev, { ...newKeyDate, label: newKeyDate.label.trim() }]);
    setNewKeyDate({ label: "", date: "", recurring: true });
  }

  if (loading) return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="mb-8">
        <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-lg h-8 w-32 mb-2" />
        <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-lg h-4 w-56" />
      </div>
      <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-6">
        <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-lg h-5 w-32 mb-4" />
        <div className="flex items-center gap-5">
          <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-full w-20 h-20" />
          <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-xl h-9 w-28" />
        </div>
      </div>
      <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-6 space-y-5">
        <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-lg h-5 w-24" />
        <div>
          <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-lg h-4 w-20 mb-2" />
          <div className="animate-pulse bg-[rgba(0,0,0,0.06)] rounded-xl h-12 border border-[rgba(0,0,0,0.08)]" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-2xl pb-24 sm:pb-0">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">Settings</h1>
        <p className="text-text-secondary mt-1">Update your profile information.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile Picture */}
        <div className="app-card rounded-2xl p-6">
          <h2 className="text-lg font-heading font-bold text-text-primary mb-4">Profile Picture</h2>
          <div className="flex items-center gap-5">
            <div className="relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover border-2 border-[rgba(0,0,0,0.06)]"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-accent/10 border-2 border-[rgba(0,0,0,0.06)] flex items-center justify-center">
                  <span className="text-2xl font-heading font-bold text-accent-bright">
                    {fullName ? fullName.charAt(0).toUpperCase() : "?"}
                  </span>
                </div>
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="px-4 py-2 text-sm font-medium text-accent-bright bg-accent/10 rounded-xl hover:bg-accent/20 transition-colors disabled:opacity-40 cursor-pointer"
              >
                <CyclingStatusText active={uploadingAvatar} idle="Change Photo" messages={["Uploading...", "Optimising photo...", "Saving profile...", "Nearly there..."]} />
              </button>
              <p className="text-xs text-text-muted mt-1.5">JPG, PNG, WebP or iPhone HEIC. Max 10MB.</p>
              {avatarMessage && (
                <p className={`mt-2 text-xs font-semibold ${avatarMessage.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
                  {avatarMessage.text}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="app-card rounded-2xl p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-heading font-bold text-text-primary">Connected Apps</h2>
              <p className="mt-1 text-sm text-text-secondary">Link wearables and nutrition apps for sleep, recovery and nutrition signals.</p>
            </div>
            <Link
              href="/portal/connected-apps"
              className="inline-flex items-center justify-center rounded-xl border border-accent/20 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent-bright no-underline transition-colors hover:bg-accent/15"
            >
              Manage apps
            </Link>
          </div>
        </div>

        <div className="app-card rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-heading font-bold text-text-primary">Profile</h2>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>
        </div>

        <div className="app-card rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-heading font-bold text-text-primary">Your Details</h2>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Date of Birth</label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Sex</label>
            <select
              value={sex}
              onChange={(e) => {
                const value = e.target.value as ClientSexInput;
                setSex(value);
                if (value !== "female") setCycleTrackingEnabled(false);
              }}
              className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent/40 transition-colors"
            >
              <option value="">Select...</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>

          {sex === "female" && (
            <button
              type="button"
              onClick={() => setCycleTrackingEnabled((prev) => !prev)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                cycleTrackingEnabled
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-[rgba(0,0,0,0.08)] bg-bg-primary"
              }`}
            >
              <span className="block text-sm font-semibold text-text-primary">Cycle tracking</span>
              <span className="mt-1 block text-xs text-text-secondary">
                {cycleTrackingEnabled ? "On - cycle tools will appear in your portal." : "Off - cycle tools stay hidden."}
              </span>
            </button>
          )}

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Key Dates</label>
            <div className="space-y-2">
              {keyDates.map((item, index) => (
                <div key={`${item.label}-${item.date}-${index}`} className="flex items-center gap-2 rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-text-primary">{item.label}</div>
                    <div className="text-xs text-text-muted">{item.date}{item.recurring ? " · repeats yearly" : ""}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setKeyDates((prev) => prev.filter((_, i) => i !== index))}
                    className="px-2 py-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {keyDates.length === 0 && (
                <div className="rounded-xl border border-dashed border-[rgba(0,0,0,0.08)] px-3 py-3 text-xs text-text-muted">
                  No key dates saved yet.
                </div>
              )}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_160px_auto]">
              <input
                type="text"
                value={newKeyDate.label}
                onChange={(e) => setNewKeyDate((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="Wedding, competition..."
                className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
              />
              <input
                type="date"
                value={newKeyDate.date}
                onChange={(e) => setNewKeyDate((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent/40 transition-colors"
              />
              <button
                type="button"
                onClick={addKeyDate}
                disabled={!newKeyDate.label.trim() || !newKeyDate.date}
                className="px-4 py-3 text-sm font-semibold text-white gradient-accent rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Password section */}
        <div className="app-card rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-heading font-bold text-text-primary">
            {isSetup ? "Set Your Password" : isReset ? "Reset Your Password" : "Change Password"}
          </h2>
          {isSetup && (
            <p className="text-sm text-accent-bright">Welcome! Set a password to secure your account.</p>
          )}
          {isReset && !isSetup && (
            <p className="text-sm text-accent-bright">Choose a new password for your portal account.</p>
          )}

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Type it again"
              className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>

          {passwordMessage && (
            <div className={`text-sm px-4 py-2.5 rounded-xl ${
              passwordMessage.type === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
            }`}>
              {passwordMessage.text}
            </div>
          )}

          <button
            type="button"
            disabled={!newPassword || newPassword.length < 8 || newPassword !== confirmPassword || passwordSaving}
            onClick={async () => {
              setPasswordSaving(true);
              setPasswordMessage(null);
              try {
                const supabase = createClient();
                const payload: { password: string; data?: Record<string, unknown> } = { password: newPassword };
                if (isSetup) {
                  payload.data = { requires_password_setup: false };
                }
                const { error } = await supabase.auth.updateUser(payload);
                if (error) {
                  setPasswordMessage({ type: "error", text: error.message });
                } else {
                  setPasswordMessage({
                    type: "success",
                    text: isSetup
                      ? "Password updated. Taking you to your consultation..."
                      : isReset
                        ? "Password reset. Taking you to your dashboard..."
                        : "Password updated successfully",
                  });
                  setNewPassword("");
                  setConfirmPassword("");
                  setIsSetup(false);
                  setIsReset(false);
                  if (isSetup) {
                    setTimeout(() => router.push("/portal/consultation?setup=true"), 900);
                  } else if (isReset) {
                    setTimeout(() => router.push("/portal"), 900);
                  }
                }
              } catch {
                setPasswordMessage({ type: "error", text: "Something went wrong" });
              } finally {
                setPasswordSaving(false);
              }
            }}
            className="px-6 py-2.5 gradient-accent text-white rounded-xl text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-opacity"
          >
            {passwordSaving ? "Updating..." : isSetup ? "Set Password" : isReset ? "Reset Password" : "Update Password"}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 gradient-accent text-white rounded-xl text-sm font-semibold disabled:opacity-40 cursor-pointer transition-opacity"
          >
            {saving ? "Saving..." : saved ? (
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Saved
              </span>
            ) : "Save Changes"}
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="px-6 py-3 text-sm text-red-400 hover:text-red-300 transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </form>
    </div>
  );
}
