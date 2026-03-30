"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Suspense } from "react";
import type { BodyMeasurement } from "@/lib/types";

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [goals, setGoals] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSetup, setIsSetup] = useState(false);

  // Body measurements state
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [mWeight, setMWeight] = useState("");
  const [mHeight, setMHeight] = useState("");
  const [mBodyFat, setMBodyFat] = useState("");
  const [mChest, setMChest] = useState("");
  const [mWaist, setMWaist] = useState("");
  const [mHip, setMHip] = useState("");
  const [mNotes, setMNotes] = useState("");
  const [mSaving, setMSaving] = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("setup") === "true") setIsSetup(true);
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/portal/me");
        if (res.ok) {
          const data = await res.json();
          setFullName(data.fullName || "");
          setAvatarUrl(data.avatarUrl || null);
          if (data.profile) {
            setPhone(data.profile.phone || "");
            setBusinessName(data.profile.business_name || "");
            setBusinessType(data.profile.business_type || "");
            setGoals(data.profile.goals || "");
          }
        }
      } finally {
        setLoading(false);
      }
    }
    async function loadMeasurements() {
      try {
        const res = await fetch("/api/portal/body-measurements");
        if (res.ok) {
          const data = await res.json();
          setMeasurements(data.measurements || []);
          // Pre-fill form with most recent measurement
          if (data.measurements?.length > 0) {
            const latest = data.measurements[0];
            setMWeight(latest.weight_kg ? String(Number(latest.weight_kg)) : "");
            setMHeight(latest.height_cm ? String(Number(latest.height_cm)) : "");
            setMBodyFat(latest.body_fat_percent ? String(Number(latest.body_fat_percent)) : "");
            setMChest(latest.chest_cm ? String(Number(latest.chest_cm)) : "");
            setMWaist(latest.waist_cm ? String(Number(latest.waist_cm)) : "");
            setMHip(latest.hip_cm ? String(Number(latest.hip_cm)) : "");
          }
        }
      } catch {
        // Non-critical
      }
    }
    load();
    loadMeasurements();
  }, []);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast("File too large. Maximum 2MB.");
      return;
    }
    setUploadingAvatar(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/portal/avatar", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setAvatarUrl(data.avatarUrl);
      } else {
        toast("Failed to upload avatar. Please try again.");
      }
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const res = await fetch("/api/portal/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, phone, businessName, businessType, goals }),
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

  if (loading) return (
    <div className="max-w-2xl space-y-6">
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
      {[...Array(2)].map((_, i) => (
        <div key={i} className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-6 space-y-5">
          <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-lg h-5 w-24" />
          {[...Array(2)].map((_, j) => (
            <div key={j}>
              <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-lg h-4 w-20 mb-2" />
              <div className="animate-pulse bg-[rgba(0,0,0,0.06)] rounded-xl h-12 border border-[rgba(0,0,0,0.08)]" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">Settings</h1>
        <p className="text-text-secondary mt-1">Update your profile information.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile Picture */}
        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-6">
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
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="px-4 py-2 text-sm font-medium text-accent-bright bg-accent/10 rounded-xl hover:bg-accent/20 transition-colors disabled:opacity-40 cursor-pointer"
              >
                {uploadingAvatar ? "Uploading..." : "Change Photo"}
              </button>
              <p className="text-xs text-text-muted mt-1.5">JPG, PNG. Max 2MB.</p>
            </div>
          </div>
        </div>

        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-6 space-y-5">
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

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>
        </div>

        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-heading font-bold text-text-primary">Business Details</h2>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Business Type</label>
            <input
              type="text"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="e.g. e.g. Weight Loss, Strength, Lifestyle"
              className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Goals</label>
            <textarea
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              rows={3}
              placeholder="What are you looking to achieve?"
              className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors resize-none"
            />
          </div>
        </div>

        {/* Body Measurements */}
        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-heading font-bold text-text-primary">Body Measurements</h2>
            <button
              type="button"
              onClick={() => setShowMeasurementForm(!showMeasurementForm)}
              className="text-xs text-accent-bright font-medium cursor-pointer"
            >
              {showMeasurementForm ? "Hide" : measurements.length > 0 ? "Update" : "Add"}
            </button>
          </div>

          {showMeasurementForm && (
            <div className="space-y-4 animate-in fade-in">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={mWeight}
                    onChange={(e) => setMWeight(e.target.value)}
                    placeholder="e.g. 85.0"
                    className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Height (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={mHeight}
                    onChange={(e) => setMHeight(e.target.value)}
                    placeholder="e.g. 178"
                    className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Body Fat %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={mBodyFat}
                    onChange={(e) => setMBodyFat(e.target.value)}
                    placeholder="e.g. 18.5"
                    className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Chest (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={mChest}
                    onChange={(e) => setMChest(e.target.value)}
                    placeholder="e.g. 100"
                    className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Waist (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={mWaist}
                    onChange={(e) => setMWaist(e.target.value)}
                    placeholder="e.g. 82"
                    className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Hip (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={mHip}
                    onChange={(e) => setMHip(e.target.value)}
                    placeholder="e.g. 95"
                    className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Notes <span className="text-text-muted text-xs">optional</span></label>
                <input
                  type="text"
                  value={mNotes}
                  onChange={(e) => setMNotes(e.target.value)}
                  placeholder="e.g. Measured first thing in the morning"
                  className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
                />
              </div>
              <button
                type="button"
                disabled={mSaving || (!mWeight && !mBodyFat && !mChest && !mWaist && !mHip)}
                onClick={async () => {
                  setMSaving(true);
                  try {
                    const res = await fetch("/api/portal/body-measurements", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        weight_kg: mWeight ? parseFloat(mWeight) : null,
                        height_cm: mHeight ? parseFloat(mHeight) : null,
                        body_fat_percent: mBodyFat ? parseFloat(mBodyFat) : null,
                        chest_cm: mChest ? parseFloat(mChest) : null,
                        waist_cm: mWaist ? parseFloat(mWaist) : null,
                        hip_cm: mHip ? parseFloat(mHip) : null,
                        notes: mNotes || null,
                      }),
                    });
                    if (res.ok) {
                      toast("Measurements saved");
                      setShowMeasurementForm(false);
                      // Refresh measurements
                      const mRes = await fetch("/api/portal/body-measurements");
                      if (mRes.ok) {
                        const mData = await mRes.json();
                        setMeasurements(mData.measurements || []);
                      }
                    } else {
                      toast("Failed to save measurements");
                    }
                  } catch {
                    toast("Failed to save measurements");
                  } finally {
                    setMSaving(false);
                  }
                }}
                className="px-6 py-2.5 gradient-accent text-[#1a1a1a] rounded-xl text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-opacity"
              >
                {mSaving ? "Saving..." : "Save Measurements"}
              </button>
            </div>
          )}

          {/* Measurement History */}
          {measurements.length > 0 && !showMeasurementForm && (
            <div className="space-y-3">
              {measurements.slice(0, 5).map((m) => (
                <div key={m.id} className="flex items-start justify-between py-3 border-b border-[rgba(0,0,0,0.04)] last:border-0">
                  <div>
                    <span className="text-sm font-medium text-text-primary">
                      {new Date(m.measured_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                      {m.weight_kg && <span className="text-xs text-text-secondary">{Number(m.weight_kg)} kg</span>}
                      {m.body_fat_percent && <span className="text-xs text-text-secondary">{Number(m.body_fat_percent)}% BF</span>}
                      {m.chest_cm && <span className="text-xs text-text-secondary">Chest: {Number(m.chest_cm)}cm</span>}
                      {m.waist_cm && <span className="text-xs text-text-secondary">Waist: {Number(m.waist_cm)}cm</span>}
                      {m.hip_cm && <span className="text-xs text-text-secondary">Hip: {Number(m.hip_cm)}cm</span>}
                    </div>
                    {m.notes && <p className="text-xs text-text-muted mt-1 italic">{m.notes}</p>}
                  </div>
                </div>
              ))}
              {measurements.length > 5 && (
                <p className="text-xs text-text-muted text-center">+ {measurements.length - 5} more entries</p>
              )}
            </div>
          )}

          {measurements.length === 0 && !showMeasurementForm && (
            <p className="text-sm text-text-muted">No measurements recorded yet. Tap &quot;Add&quot; to log your first entry.</p>
          )}
        </div>

        {/* Password section */}
        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-heading font-bold text-text-primary">
            {isSetup ? "Set Your Password" : "Change Password"}
          </h2>
          {isSetup && (
            <p className="text-sm text-accent-bright">Welcome! Set a password to secure your account.</p>
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
                const { error } = await supabase.auth.updateUser({ password: newPassword });
                if (error) {
                  setPasswordMessage({ type: "error", text: error.message });
                } else {
                  setPasswordMessage({ type: "success", text: "Password updated successfully" });
                  setNewPassword("");
                  setConfirmPassword("");
                  setIsSetup(false);
                }
              } catch {
                setPasswordMessage({ type: "error", text: "Something went wrong" });
              } finally {
                setPasswordSaving(false);
              }
            }}
            className="px-6 py-2.5 gradient-accent text-[#1a1a1a] rounded-xl text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-opacity"
          >
            {passwordSaving ? "Updating..." : isSetup ? "Set Password" : "Update Password"}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 gradient-accent text-[#1a1a1a] rounded-xl text-sm font-semibold disabled:opacity-40 cursor-pointer transition-opacity"
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
