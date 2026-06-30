"use client";

import { useEffect, useState } from "react";
import type { ClientDocument } from "@/lib/types";

function formatBytes(value?: number | null) {
  if (!value) return "";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PortalDocumentsPage() {
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("bloodwork");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setError("");
    try {
      const res = await fetch("/api/portal/documents");
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setError("Document vault is only available for VIP clients.");
        return;
      }
      if (!res.ok) {
        setError(data.error || "Couldn't load documents.");
        return;
      }
      setDocuments(data.documents || []);
    } catch {
      setError("Couldn't reach the document vault.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function uploadDocument() {
    if (!file || !title.trim() || uploading) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("title", title.trim());
      formData.set("category", category);
      formData.set("notes", notes.trim());

      const res = await fetch("/api/portal/documents", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't upload document.");
        return;
      }
      setTitle("");
      setCategory("bloodwork");
      setNotes("");
      setFile(null);
      await load();
    } catch {
      setError("Couldn't upload document.");
    } finally {
      setUploading(false);
    }
  }

  async function deleteDocument(document: ClientDocument) {
    if (!confirm(`Delete "${document.title}"?`)) return;
    const res = await fetch("/api/portal/documents", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: document.id }),
    });
    if (res.ok) setDocuments((prev) => prev.filter((item) => item.id !== document.id));
    else setError("Couldn't delete that document.");
  }

  return (
    <div className="mx-auto w-full max-w-4xl pb-28 sm:pb-0">
      <div className="mb-6">
        <h1 className="text-3xl font-heading font-bold text-text-primary">Document Vault</h1>
        <p className="mt-1 text-sm text-text-secondary">Private VIP storage for bloodwork and health documents.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          {error}
        </div>
      )}

      {!error.includes("VIP") && (
        <div className="mb-6 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-5">
          <h2 className="mb-4 text-sm font-heading font-bold text-text-primary">Upload Document</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Title</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="June bloodwork"
                className="w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Category</label>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-3 py-2 text-sm text-text-primary"
              >
                <option value="bloodwork">Bloodwork</option>
                <option value="scan">Scan</option>
                <option value="medical">Medical</option>
                <option value="progress">Progress</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-text-secondary">File</label>
              <input
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-text-secondary">Notes</label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-3 py-2 text-sm text-text-primary"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={uploadDocument}
              disabled={!file || !title.trim() || uploading}
              className="rounded-xl gradient-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-card overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-text-secondary">Loading...</div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-text-primary">No documents yet.</p>
            <p className="mt-1 text-xs text-text-muted">Uploaded PDFs and images will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-[rgba(0,0,0,0.06)]">
            {documents.map((document) => (
              <div key={document.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-text-primary">{document.title}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-text-muted">
                    <span>{document.category}</span>
                    <span>{document.file_name}</span>
                    <span>{formatBytes(document.file_size_bytes)}</span>
                    <span>{new Date(document.created_at).toLocaleDateString("en-GB")}</span>
                  </div>
                  {document.notes && <p className="mt-1 text-sm text-text-secondary">{document.notes}</p>}
                </div>
                <div className="flex gap-2">
                  {document.signed_url && (
                    <a
                      href={document.signed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-[rgba(0,0,0,0.08)] px-3 py-2 text-xs font-semibold text-text-secondary no-underline"
                    >
                      View
                    </a>
                  )}
                  <button
                    onClick={() => deleteDocument(document)}
                    className="rounded-xl border border-red-500/20 px-3 py-2 text-xs font-semibold text-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
