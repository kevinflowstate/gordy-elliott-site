"use client";

import Link from "next/link";
import ValuesExercise from "@/components/portal/ValuesExercise";

export default function ValuesDiscoveryPage() {
  return (
    <>
      <Link
        href="/portal/training"
        className="text-text-muted text-sm hover:text-text-secondary transition-colors no-underline inline-flex items-center gap-1 mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Education Hub
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-heading font-bold text-text-primary">Values Determination</h1>
        <p className="text-sm text-text-muted mt-1">Adapted from Dr John Demartini&apos;s Value Determination Process</p>
      </div>

      <ValuesExercise />
    </>
  );
}
