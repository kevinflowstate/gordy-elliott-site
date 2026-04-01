"use client";

import { useState } from "react";

interface PhotoGroup {
  date: string;
  front?: string;
  back?: string;
  side?: string;
  signedUrls: Record<string, string>;
}

interface PhotoGalleryProps {
  groups: PhotoGroup[];
  loading?: boolean;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

const angleLabels = ["front", "back", "side"] as const;

export default function PhotoGallery({ groups, loading }: PhotoGalleryProps) {
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);
  const [compareA, setCompareA] = useState<string>("");
  const [compareB, setCompareB] = useState<string>("");
  const [showCompare, setShowCompare] = useState(false);

  const dates = groups.map((g) => g.date);
  const groupByDate = Object.fromEntries(groups.map((g) => [g.date, g]));

  const compareGroupA = compareA ? groupByDate[compareA] : null;
  const compareGroupB = compareB ? groupByDate[compareB] : null;

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-6">
            <div className="animate-pulse bg-[rgba(0,0,0,0.06)] h-4 w-32 rounded mb-4" />
            <div className="grid grid-cols-3 gap-3">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="animate-pulse bg-[rgba(0,0,0,0.05)] aspect-[3/4] rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[rgba(0,0,0,0.03)] flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-base font-heading font-bold text-text-primary mb-2">No Progress Photos Yet</h3>
        <p className="text-sm text-text-muted max-w-sm mx-auto">Progress photos will appear here once uploaded during check-ins.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Compare toggle */}
      {groups.length >= 2 && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">{groups.length} check-in{groups.length !== 1 ? "s" : ""} with photos</h3>
          <button
            type="button"
            onClick={() => {
              setShowCompare(!showCompare);
              if (!showCompare && dates.length >= 2) {
                setCompareA(dates[0]);
                setCompareB(dates[1]);
              }
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all cursor-pointer ${
              showCompare
                ? "bg-[#E2B830]/10 border-[#E2B830]/40 text-[#E2B830]"
                : "border-[rgba(0,0,0,0.08)] text-text-muted hover:border-[rgba(0,0,0,0.12)]"
            }`}
          >
            Compare
          </button>
        </div>
      )}

      {/* Compare panel */}
      {showCompare && (
        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-text-primary">Side-by-Side Comparison</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Date A</label>
              <select
                value={compareA}
                onChange={(e) => setCompareA(e.target.value)}
                className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-[#E2B830]/40"
              >
                {dates.map((d) => (
                  <option key={d} value={d}>{formatDate(d)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Date B</label>
              <select
                value={compareB}
                onChange={(e) => setCompareB(e.target.value)}
                className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-[#E2B830]/40"
              >
                {dates.map((d) => (
                  <option key={d} value={d}>{formatDate(d)}</option>
                ))}
              </select>
            </div>
          </div>

          {compareGroupA && compareGroupB && (
            <div className="space-y-3">
              {angleLabels.map((angle) => {
                const urlA = compareGroupA[angle];
                const urlB = compareGroupB[angle];
                if (!urlA && !urlB) return null;
                return (
                  <div key={angle}>
                    <div className="text-xs font-medium text-text-muted capitalize mb-2">{angle}</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="text-[10px] text-text-muted">{formatDate(compareA)}</div>
                        {urlA ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={urlA}
                            alt={`${angle} - ${compareA}`}
                            className="w-full aspect-[3/4] object-cover rounded-xl cursor-pointer"
                            onClick={() => setLightbox({ url: urlA, label: `${angle} - ${formatDate(compareA)}` })}
                          />
                        ) : (
                          <div className="w-full aspect-[3/4] rounded-xl bg-[rgba(0,0,0,0.04)] flex items-center justify-center">
                            <span className="text-xs text-text-muted">No photo</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] text-text-muted">{formatDate(compareB)}</div>
                        {urlB ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={urlB}
                            alt={`${angle} - ${compareB}`}
                            className="w-full aspect-[3/4] object-cover rounded-xl cursor-pointer"
                            onClick={() => setLightbox({ url: urlB, label: `${angle} - ${formatDate(compareB)}` })}
                          />
                        ) : (
                          <div className="w-full aspect-[3/4] rounded-xl bg-[rgba(0,0,0,0.04)] flex items-center justify-center">
                            <span className="text-xs text-text-muted">No photo</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Photo groups by date */}
      {groups.map((group) => (
        <div key={group.date} className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-semibold text-text-primary">{formatDate(group.date)}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {angleLabels.map((angle) => {
              const url = group[angle];
              return (
                <div key={angle} className="space-y-1.5">
                  <div className="text-xs font-medium text-text-secondary capitalize">{angle}</div>
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={`${angle} - ${group.date}`}
                      className="w-full aspect-[3/4] object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity border border-[rgba(0,0,0,0.06)]"
                      onClick={() => setLightbox({ url, label: `${angle} - ${formatDate(group.date)}` })}
                    />
                  ) : (
                    <div className="w-full aspect-[3/4] rounded-xl bg-[rgba(0,0,0,0.03)] border border-dashed border-[rgba(0,0,0,0.08)] flex items-center justify-center">
                      <span className="text-[10px] text-text-muted">No photo</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.url} alt={lightbox.label} className="w-full rounded-2xl" />
            <div className="mt-3 text-center text-white/70 text-sm capitalize">{lightbox.label}</div>
          </div>
        </div>
      )}
    </div>
  );
}
