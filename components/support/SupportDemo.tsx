"use client";
import { useState } from "react";
import SupportReportForm, { supportInputFromForm } from "./SupportReportForm";
import SupportQueue from "./SupportQueue";
import {
  validateSupportInput,
  validateSupportUpdate,
  type SupportTicket,
} from "@/lib/support-contract";
const timestamp = "2026-10-05T08:00:00.000Z";
const seed: SupportTicket = {
  submission_key: "4a82969a-4a6d-4311-b4f8-7b90ab820c11",
  id: "4a82969a-4a6d-4311-b4f8-7b90ab820c11",
  reference: "AC-DEMO-001",
  name: "Alex Example",
  email: "alex@example.invalid",
  area: "Training",
  description:
    "I finished the last set, but the session still shows as incomplete when I return to the plan.",
  expected: "The completed workout should show a tick.",
  impact: "Something looks wrong",
  device: "iPhone · fictional demo",
  page: "/portal/exercise-plan",
  created_at: timestamp,
  updated_at: timestamp,
  status: "New",
  priority: "Normal",
  owner: "",
  internal_notes: "Fictional example for reviewing the support workflow.",
  resolution: "",
  image_path: null,
};
export default function SupportDemo() {
  const [tickets, setTickets] = useState<SupportTicket[]>([seed]);
  const [tab, setTab] = useState("Client form");
  return (
    <main className="min-h-screen bg-[#0a0a0a] px-5 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <p className="rounded-lg border border-amber-300/30 bg-amber-300/5 p-4 text-sm leading-6 text-amber-200">
          LOCAL DEMO — fictional data only. Reports stay in this page’s memory;
          refreshing resets them. No accounts, database records or messages are
          changed.
        </p>
        <div className="my-6 flex flex-wrap gap-3">
          {["Client form", "Support queue"].map((v) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={`min-h-12 rounded-lg border px-4 ${tab === v ? "border-[#f06be3] text-[#f06be3]" : "border-white/20"}`}
            >
              {v}
            </button>
          ))}
        </div>
        {tab === "Client form" ? (
          <div className="mx-auto max-w-2xl">
            <h1 className="font-heading text-3xl font-bold">
              Report an app problem
            </h1>
            <p className="mb-8 mt-4 leading-7 text-[#c3c4cd]">
              Send it straight to the app support team, even if you cannot sign
              in.
            </p>
            <SupportReportForm
              onSubmit={async (form) => {
                const input = validateSupportInput({
                  ...supportInputFromForm(form),
                });
                const existing = tickets.find(
                  (t) => t.submission_key === input.submission_key,
                );
                if (existing)
                  return {
                    reference: existing.reference,
                    attachmentSaved: true,
                  };
                const now = new Date().toISOString();
                const id = crypto.randomUUID();
                const reference = `AC-DEMO-${tickets.length + 1}`;
                const image = form.get("screenshot");
                let imageUrl: null | string = null;
                if (image instanceof File && image.size) {
                  if (
                    image.size > 2 * 1024 * 1024 ||
                    !["image/jpeg", "image/png", "image/webp"].includes(
                      image.type,
                    )
                  )
                    throw new Error(
                      "Choose a JPEG, PNG or WebP screenshot under 2MB.",
                    );
                  imageUrl = URL.createObjectURL(image);
                }
                setTickets((prev) => [
                  {
                    ...input,
                    id,
                    reference,
                    created_at: now,
                    updated_at: now,
                    status: "New",
                    priority: "Normal",
                    owner: "",
                    internal_notes: "",
                    resolution: "",
                    image_path: null,
                    image_url: imageUrl,
                  },
                  ...prev,
                ]);
                return { reference, attachmentSaved: true };
              }}
            />
          </div>
        ) : (
          <SupportQueue
            initialTickets={tickets}
            onSave={async (ticket) => {
              validateSupportUpdate({ ...ticket });
              const updated = {
                ...ticket,
                updated_at: new Date().toISOString(),
              };
              setTickets((prev) =>
                prev.map((t) => (t.id === updated.id ? updated : t)),
              );
              return updated;
            }}
          />
        )}
      </div>
    </main>
  );
}
