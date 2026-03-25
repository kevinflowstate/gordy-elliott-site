import Link from "next/link";

export default function Footer() {
  return (
    <footer className="pt-20 pb-10 px-8 border-t border-[rgba(255,255,255,0.03)] bg-bg-primary relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(34,114,222,0.15)] to-transparent" />

      <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-3">
          <span className="font-heading font-extrabold text-[0.95rem] text-text-primary">SHIFT Coaching</span>
          <span className="text-text-muted text-[0.85rem]">by Gordy Elliott</span>
        </div>
        <Link href="/login" className="text-text-muted no-underline text-[0.85rem] hover:text-accent-light transition-colors">
          Client Login
        </Link>
      </div>

      <div className="max-w-[1200px] mx-auto mt-8 pt-6 border-t border-[rgba(255,255,255,0.03)] text-center text-[0.78rem] text-text-muted">
        <span>2026 Gordy Elliott. All rights reserved.</span>
      </div>
    </footer>
  );
}
