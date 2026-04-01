"use client";

import { useState, useEffect } from "react";
import PhotoGallery from "@/components/portal/PhotoGallery";

interface PhotoGroup {
  date: string;
  front?: string;
  back?: string;
  side?: string;
  signedUrls: Record<string, string>;
}

export default function GalleryPage() {
  const [groups, setGroups] = useState<PhotoGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/portal/gallery");
        if (res.ok) {
          const data = await res.json();
          setGroups(data.groups || []);
        } else {
          setError("Failed to load photos");
        }
      } catch {
        setError("Failed to load photos");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">Progress Photos</h1>
        <p className="text-text-secondary mt-1">Track your visual transformation over time.</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      <PhotoGallery groups={groups} loading={loading} />
    </div>
  );
}
