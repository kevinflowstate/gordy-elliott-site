"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[1000] backdrop-blur-[24px] backdrop-saturate-[1.2] px-8 transition-colors duration-300 ${
        scrolled
          ? "bg-[rgba(5,5,7,0.95)] border-b border-[rgba(34,114,222,0.1)]"
          : "bg-[rgba(5,5,7,0.8)] border-b border-[rgba(255,255,255,0.04)]"
      }`}
    >
      <div className="max-w-[1200px] mx-auto flex justify-between items-center h-[72px]">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <span className="font-heading font-extrabold text-[1.1rem] text-text-primary tracking-[-0.5px]">
            SHIFT <span className="text-accent-light">COACHING</span>
          </span>
        </Link>

        <Link
          href="/login"
          className="bg-accent text-white px-6 py-2.5 rounded-lg font-semibold text-[0.85rem] no-underline transition-all duration-300 hover:bg-accent-light hover:-translate-y-px hover:shadow-[0_0_20px_rgba(34,114,222,0.4)]"
        >
          Client Login
        </Link>
      </div>
    </nav>
  );
}
