import Link from "next/link";
import HeroCanvas from "@/components/HeroCanvas";

export default function HomePage() {
  return (
    <main className="relative min-h-screen flex items-center justify-center bg-[#1a1a1a]">
      <HeroCanvas />
      <div className="relative z-10 text-center px-6 max-w-2xl mx-auto">
        <h1 className="font-heading text-4xl md:text-6xl font-black text-white tracking-tight leading-[1.1] mb-6">
          <span className="text-accent-bright">AT</span> CAPACITY
        </h1>
        <p className="text-[#b0b4c8] text-lg md:text-xl leading-relaxed mb-10 max-w-xl mx-auto">
          Online fitness coaching by Gordy Elliott. Transform your training, nutrition, and mindset.
        </p>
        <Link
          href="/login"
          className="inline-block gradient-accent text-white font-semibold px-8 py-4 rounded-xl text-lg no-underline hover:opacity-90 transition-opacity"
        >
          Client Login
        </Link>
      </div>
      <nav aria-label="Legal" className="absolute bottom-6 left-0 right-0 z-10 flex justify-center gap-5 text-sm text-[#aeb0bb]">
        <Link href="/privacy" className="text-inherit no-underline hover:text-white">Privacy</Link>
        <Link href="/support" className="text-inherit no-underline hover:text-white">Support</Link>
      </nav>
    </main>
  );
}
