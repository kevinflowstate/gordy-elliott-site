"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  SUPPORT_AREAS,
  SUPPORT_IMPACTS,
  type SupportInput,
} from "@/lib/support-contract";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { AI_CONTENT_REPORT_KEY, aiReportDescription } from "@/lib/ai-content-report";

export type SupportSubmit = (
  form: FormData,
) => Promise<{ reference: string; attachmentSaved: boolean }>;
export default function SupportReportForm({
  onSubmit,
}: {
  onSubmit?: SupportSubmit;
}) {
  const [key, setKey] = useState("");
  const [device, setDevice] = useState("");
  const [page, setPage] = useState("");
  const [area, setArea] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{
    reference: string;
    attachmentSaved: boolean;
  } | null>(null);
  useEffect(() => {
    setKey(crypto.randomUUID());
    if (new URLSearchParams(window.location.search).get("source") === "ai") {
      setArea("Other");
      setPage("/portal/ai");
      try {
        const raw = sessionStorage.getItem(AI_CONTENT_REPORT_KEY);
        sessionStorage.removeItem(AI_CONTENT_REPORT_KEY);
        const draft = raw ? aiReportDescription(JSON.parse(raw)) : null;
        if (draft) setDescription(draft);
      } catch { /* Clients can describe the reply themselves. */ }
    }
    const platform = Capacitor.getPlatform();
    if (Capacitor.isNativePlatform())
      void App.getInfo()
        .then((info) =>
          setDevice(`${platform} · ${info.version} (${info.build})`),
        )
        .catch(() => setDevice(platform));
    else
      setDevice(
        /Android/i.test(navigator.userAgent)
          ? "Android browser"
          : /iPhone|iPad/i.test(navigator.userAgent)
            ? "iPhone/iPad browser"
            : "Web browser",
      );
    try {
      const referrer = new URL(document.referrer);
      if (
        referrer.origin === window.location.origin &&
        referrer.pathname.startsWith("/portal")
      )
        setPage(referrer.pathname);
    } catch {
      /* A direct/opened link has no referrer. */
    }
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      let result;
      if (onSubmit) result = await onSubmit(form);
      else {
        const response = await fetch("/api/support/reports", {
          method: "POST",
          body: form,
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error || "Your report could not be saved. Please try again.",
          );
        result = data;
      }
      setReceipt(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Connection lost. Your answers are still here. Please try again.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const control =
    "mt-2 min-h-12 w-full rounded-lg border border-white/20 bg-[#17171d] px-3 py-3 text-base text-white outline-none focus:border-[#f06be3] focus:ring-2 focus:ring-[#f06be3]/25";
  if (receipt)
    return (
      <section
        className="rounded-xl border border-[#f06be3]/35 bg-[#f06be3]/5 p-6"
        aria-live="polite"
      >
        <p className="text-sm font-semibold text-[#f06be3]">REPORT RECEIVED</p>
        <h2 className="mt-3 font-heading text-2xl font-bold">
          Thanks for letting us know.
        </h2>
        <p className="mt-3 leading-7 text-[#c3c4cd]">
          Your report is with the app support team. Keep this reference if you
          need to follow up.
        </p>
        <p className="mt-5 break-all font-mono text-xl font-semibold text-white">
          {receipt.reference}
        </p>
        {!receipt.attachmentSaved && (
          <p role="status" className="mt-4 text-sm leading-6 text-amber-200">
            Your written report is saved, but the screenshot could not be
            attached. You can email it to kevin@flowstatesystems.ai with this
            reference.
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-5">
          <Link href="/login" className="text-[#f06be3]">
            Return to the app
          </Link>
          <button
            type="button"
            onClick={() => {
              setReceipt(null);
              setKey(crypto.randomUUID());
            }}
            className="text-[#c3c4cd] underline underline-offset-4"
          >
            Report something else
          </button>
        </div>
      </section>
    );
  return (
    <form onSubmit={submit} className="space-y-6">
      <input type="hidden" name="submission_key" value={key} />
      <div aria-hidden="true" className="absolute -left-[10000px]">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          Your name
          <input
            name="name"
            required
            maxLength={100}
            autoComplete="name"
            className={control}
          />
        </label>
        <label className="block text-sm font-semibold">
          Email for follow-up
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            className={control}
          />
        </label>
      </div>
      <label className="block text-sm font-semibold">
        Where did it happen?
        <select name="area" required value={area} onChange={(event) => setArea(event.target.value)} className={control}>
          <option value="" disabled>
            Choose an area
          </option>
          {SUPPORT_AREAS.map((area) => (
            <option key={area}>{area}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold">
        What happened?
        <span className="mt-1 block font-normal leading-6 text-[#b9bac4]">
          Tell us what you were trying to do and what went wrong.
        </span>
        <textarea
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
          maxLength={4000}
          rows={4}
          className={`${control} resize-y`}
        />
      </label>
      <label className="block text-sm font-semibold">
        How is this affecting you?
        <select name="impact" required defaultValue="" className={control}>
          <option value="" disabled>
            Choose the impact
          </option>
          {SUPPORT_IMPACTS.map((impact) => (
            <option key={impact}>{impact}</option>
          ))}
        </select>
      </label>
      <details className="rounded-lg border border-white/15 px-4 py-3">
        <summary className="min-h-7 cursor-pointer text-sm font-semibold text-[#c3c4cd]">
          Add more detail (optional)
        </summary>
        <div className="mt-5 space-y-5">
          <label className="block text-sm font-semibold">
            What did you expect?
            <textarea
              name="expected"
              maxLength={1000}
              rows={2}
              className={control}
            />
          </label>
          <label className="block text-sm font-semibold">
            Page or feature
            <input
              name="page"
              value={page}
              onChange={(event) => setPage(event.target.value)}
              maxLength={200}
              placeholder="For example /portal/exercise-plan"
              className={control}
            />
          </label>
        </div>
      </details>
      <label className="block text-sm font-semibold">
        Screenshot (optional)
        <span className="mt-1 block font-normal leading-6 text-[#b9bac4]">
          One JPEG, PNG or WebP under 2MB. Crop out unrelated personal or health
          information.
        </span>
        <input
          name="screenshot"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="mt-3 block max-w-full text-sm text-[#c3c4cd] file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-white/20 file:bg-[#17171d] file:px-3 file:text-white"
        />
      </label>
      <label className="block text-sm font-semibold">
        Device or app version
        <span className="mt-1 block font-normal leading-6 text-[#b9bac4]">
          We include this to help reproduce the problem. You can correct it.
        </span>
        <input
          name="device"
          value={device}
          onChange={(event) => setDevice(event.target.value)}
          maxLength={200}
          className={control}
        />
      </label>
      <p className="text-sm leading-6 text-[#b9bac4]">
        Reports and screenshots are private to Gordy and the authorised
        Flowstate support team. We record the submission time and page path.
        Please keep coaching or health questions in your private DM.{" "}
        <Link
          href="/privacy"
          className="text-[#f06be3] underline underline-offset-4"
        >
          Privacy policy
        </Link>
      </p>
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm leading-6 text-red-200"
        >
          {error}
        </div>
      )}
      <button
        disabled={busy || !key}
        className="min-h-12 w-full rounded-lg bg-[#e040d0] px-5 py-3 font-semibold text-white transition-colors hover:bg-[#bd24ac] disabled:opacity-50 sm:w-auto"
      >
        {busy ? "Sending report…" : "Send report"}
      </button>
      <p className="text-sm leading-6 text-[#b9bac4]">
        If you cannot submit, email{" "}
        <a
          href="mailto:kevin@flowstatesystems.ai"
          className="break-all text-[#f06be3]"
        >
          kevin@flowstatesystems.ai
        </a>
        .
      </p>
    </form>
  );
}
export function supportInputFromForm(form: FormData): SupportInput {
  return Object.fromEntries(
    [...form.entries()].filter(([key]) => key !== "screenshot"),
  ) as unknown as SupportInput;
}
