import Image from "next/image";

export default function PortalLoading() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center" role="status" aria-live="polite">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-accent/20 bg-accent/10">
        <div className="absolute inset-0 animate-ping rounded-3xl border border-accent/20" />
        <Image src="/images/shift-logo.svg" alt="" width={40} height={40} className="relative h-10 w-auto" priority />
      </div>
      <div className="mt-5 font-heading text-xl font-bold text-text-primary">Loading your portal</div>
      <div className="mt-1 text-sm text-text-secondary">Getting your latest plan and updates ready.</div>
    </div>
  );
}
