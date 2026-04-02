"use client";

import { useState, useRef, useCallback } from "react";

interface PhotoSlot {
  angle: "front" | "back" | "side";
  label: string;
}

const slots: PhotoSlot[] = [
  { angle: "front", label: "Front" },
  { angle: "back", label: "Back" },
  { angle: "side", label: "Side" },
];

interface PhotoUploadProps {
  date: string;
  onPhotosChange: (photos: Record<string, File>) => void;
}

async function resizeImage(file: File, maxWidth = 1200): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
          } else {
            resolve(file);
          }
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export default function PhotoUpload({ date, onPhotosChange }: PhotoUploadProps) {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFile = useCallback(async (angle: string, rawFile: File) => {
    const resized = await resizeImage(rawFile);
    const preview = URL.createObjectURL(resized);
    setPreviews((prev) => {
      if (prev[angle]) URL.revokeObjectURL(prev[angle]);
      return { ...prev, [angle]: preview };
    });
    setFiles((prev) => {
      const updated = { ...prev, [angle]: resized };
      onPhotosChange(updated);
      return updated;
    });
  }, [onPhotosChange]);

  function handleRemove(angle: string) {
    setPreviews((prev) => {
      if (prev[angle]) URL.revokeObjectURL(prev[angle]);
      const next = { ...prev };
      delete next[angle];
      return next;
    });
    setFiles((prev) => {
      const next = { ...prev };
      delete next[angle];
      onPhotosChange(next);
      return next;
    });
    if (inputRefs.current[angle]) inputRefs.current[angle]!.value = "";
  }

  function handleDrop(angle: string, e: React.DragEvent) {
    e.preventDefault();
    setDragging(null);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFile(angle, file);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-text-primary mb-3">Progress Photos</label>
      <p className="text-xs text-text-muted mb-4">Upload front, back, and side photos to track your visual progress.</p>
      <div className="grid grid-cols-3 gap-3">
        {slots.map(({ angle, label }) => {
          const preview = previews[angle];
          const isDragging = dragging === angle;
          return (
            <div key={angle} className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary">{label}</span>
              {preview ? (
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden border border-[#E040D0]/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt={label} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemove(angle)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div
                  className={`aspect-[3/4] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer ${
                    isDragging
                      ? "border-[#E040D0] bg-[#E040D0]/10"
                      : "border-[rgba(0,0,0,0.12)] hover:border-[#E040D0]/40 hover:bg-[rgba(0,0,0,0.02)]"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragging(angle); }}
                  onDragLeave={() => setDragging(null)}
                  onDrop={(e) => handleDrop(angle, e)}
                  onClick={() => inputRefs.current[angle]?.click()}
                >
                  <svg className="w-6 h-6 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-[10px] text-text-muted text-center px-1">Tap or drop</span>
                </div>
              )}
              <input
                ref={(el) => { inputRefs.current[angle] = el; }}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(angle, file);
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
