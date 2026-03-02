import Link from "next/link";
import Image from "next/image";
import HeroCanvas from "@/components/HeroCanvas";
import ScrollReveal from "@/components/ScrollReveal";
import StatCounter from "@/components/StatCounter";

const problems = [
  { title: "Burning out but terrified to slow down.", desc: "You fear if you put effort into your health, your business will suffer." },
  { title: "Stuck in the all-or-nothing cycle.", desc: "You go hard for a few weeks, life gets loud, and you're back to square one." },
  { title: "Energy and mood have tanked.", desc: "You don't recognise who you are. The drive is gone and the midday slump wins every day." },
  { title: "Tried everything, nothing sticks.", desc: "Plans that only work when life is calm. The second stress hits, it all falls apart." },
  { title: "Health is slipping while business grows.", desc: "Blood work is bad, body image is embarrassing, and you're putting everyone else first." },
];

const pillars = [
  { icon: "I", title: "Identity & Values", desc: "Reconnect with who you are. Align your health goals with what you actually value so discipline becomes automatic." },
  { icon: "M", title: "Mind & Emotional Control", desc: "Build the mental framework to handle stress, pressure, and setbacks without self-sabotaging." },
  { icon: "W", title: "Mission & Work Output", desc: "Structure your work so health and business coexist. No more choosing one over the other." },
  { icon: "S", title: "Self-Worth & Money", desc: "Invest in yourself with the same conviction you invest in your business. You're the asset." },
  { icon: "H", title: "Home Team", desc: "Better relationships, better boundaries. Show up as the person your family actually needs." },
  { icon: "L", title: "Leadership & Social", desc: "Lead by example. Build the social standards that keep you accountable and inspired." },
  { icon: "B", title: "Body & Recovery", desc: "Train smart, recover properly, and build a body that performs under real-life pressure." },
];

const testimonials = [
  {
    quote: "I went from dreading Mondays to actually having energy and drive. Gordy didn't just give me a plan - he rebuilt how I think about health. My business hasn't suffered. It's grown.",
    initials: "JD", role: "Business Owner", location: "UK",
    tags: ["Energy", "Mindset Shift"],
  },
  {
    quote: "I've tried every programme going. The difference with SHIFT is it's built around my actual life - travel weeks, busy seasons, all of it. First time something has stuck past 12 weeks.",
    initials: "MR", role: "Self-Employed", location: "Northern Ireland",
    tags: ["Consistency", "Real Life Results"],
  },
  {
    quote: "Gordy got it immediately. The pressure, the responsibility, the feeling you have to carry everything. He's been there. That's why this works - it's not theory, it's lived experience.",
    initials: "PK", role: "Entrepreneur", location: "Ireland",
    tags: ["Accountability", "Systems"],
  },
];

const steps = [
  { num: "1", title: "Apply", desc: "Fill in a short application. This isn't for everyone - it's for driven professionals ready to stop starting over." },
  { num: "2", title: "Discovery Call", desc: "A straight conversation about where you are and where you want to be. No sales pitch. No pressure." },
  { num: "3", title: "Start SHIFT", desc: "Your personalised 6-month programme begins. 1-to-1 coaching, values alignment, and a system built around your life." },
];

export default function Home() {
  return (
    <main>
      <ScrollReveal />
      <StatCounter />

      {/* HERO */}
      <section className="min-h-screen flex items-center pt-[120px] pb-20 px-8 relative overflow-hidden">
        <HeroCanvas />
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 70% 40%, rgba(16,185,129,0.07) 0%, transparent 55%), radial-gradient(ellipse at 20% 80%, rgba(16,185,129,0.04) 0%, transparent 40%), radial-gradient(ellipse at 50% 100%, rgba(5,5,7,1) 0%, transparent 50%)",
          }}
        />

        <div className="max-w-[1400px] mx-auto w-full grid grid-cols-1 lg:grid-cols-2 items-center relative z-[2]">
          <div className="max-w-[600px] lg:pl-8">
            <div className="inline-flex items-center gap-2 bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.2)] rounded-full px-[18px] py-[7px] text-[0.78rem] font-semibold text-accent-bright mb-6 tracking-[0.5px] uppercase animate-[fadeInUp_0.8s_cubic-bezier(0.16,1,0.3,1)_0.2s_both]">
              <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent),0_0_20px_rgba(16,185,129,0.3)] animate-[pulse-dot_2s_ease-in-out_infinite]" />
              Private 1-to-1 Coaching
            </div>

            <h1 className="font-heading text-[2.1rem] md:text-[3.5rem] font-black leading-[1.08] tracking-[-2px] mb-6 animate-[fadeInUp_0.8s_cubic-bezier(0.16,1,0.3,1)_0.35s_both]">
              Stop Self-Sabotaging Your{" "}
              <span className="text-accent-bright relative">
                Health & Performance
                <span className="absolute bottom-0.5 left-0 right-0 h-[3px] gradient-accent rounded-sm opacity-50" />
              </span>
            </h1>

            <p className="text-[1.1rem] text-text-secondary leading-[1.8] mb-10 max-w-[500px] animate-[fadeInUp_0.8s_cubic-bezier(0.16,1,0.3,1)_0.5s_both]">
              Private coaching for driven professionals and business owners who want to take control of their health, mindset, and physique - without the burnout or plans that don&apos;t fit their lives.
            </p>

            <div className="flex gap-4 items-center flex-wrap animate-[fadeInUp_0.8s_cubic-bezier(0.16,1,0.3,1)_0.65s_both]">
              <Link href="/apply" className="btn-primary inline-flex items-center gap-2 bg-accent text-white px-9 py-4 rounded-[10px] font-bold text-base no-underline transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_10px_40px_rgba(16,185,129,0.4),0_0_60px_rgba(16,185,129,0.15)]">
                Apply for SHIFT
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
              <a href="#shift-system" className="inline-flex items-center gap-2 bg-transparent text-text-primary px-7 py-4 rounded-[10px] font-semibold text-[0.95rem] no-underline border border-border-light transition-all duration-300 hover:border-accent hover:bg-[rgba(16,185,129,0.05)] hover:shadow-[0_0_30px_rgba(16,185,129,0.08)]">
                The SHIFT System
              </a>
            </div>

            <div className="flex gap-4 items-center mt-10 pt-8 border-t border-[rgba(255,255,255,0.05)] animate-[fadeInUp_0.8s_cubic-bezier(0.16,1,0.3,1)_0.8s_both]">
              <a href="#" className="flex items-center gap-2.5 text-text-secondary no-underline text-[0.85rem] font-medium px-[18px] py-2.5 rounded-[10px] border border-[rgba(255,255,255,0.05)] bg-[rgba(12,12,18,0.6)] backdrop-blur-[10px] transition-all duration-300 hover:text-text-primary hover:border-[rgba(16,185,129,0.3)] hover:bg-[rgba(16,185,129,0.05)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(16,185,129,0.1)] group">
                <svg className="w-[22px] h-[22px] opacity-70 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                Instagram
              </a>
              <a href="#" className="flex items-center gap-2.5 text-text-secondary no-underline text-[0.85rem] font-medium px-[18px] py-2.5 rounded-[10px] border border-[rgba(255,255,255,0.05)] bg-[rgba(12,12,18,0.6)] backdrop-blur-[10px] transition-all duration-300 hover:text-text-primary hover:border-[rgba(16,185,129,0.3)] hover:bg-[rgba(16,185,129,0.05)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(16,185,129,0.1)] group">
                <svg className="w-[22px] h-[22px] opacity-70 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                LinkedIn
              </a>
            </div>
          </div>

          <div className="relative hidden lg:flex justify-end items-center -mr-8 animate-[fadeIn_1.5s_cubic-bezier(0.16,1,0.3,1)_0.3s_both]">
            <div className="absolute w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(16,185,129,0.1)_0%,transparent_70%)] rounded-full top-[40%] right-[15%] -translate-y-1/2 pointer-events-none animate-[breathe_5s_ease-in-out_infinite] z-0" />
            <Image
              src="/images/gordy-hero.jpg"
              alt="Gordy Elliott"
              width={800}
              height={900}
              className="w-[115%] max-w-none h-[90vh] min-h-[600px] object-cover object-[center_top] relative z-[1] brightness-[0.85] contrast-[1.1]"
              style={{
                WebkitMaskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.4) 15%, rgba(0,0,0,0.8) 40%, rgba(0,0,0,1) 60%, rgba(0,0,0,0.6) 90%, transparent 100%), linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,1) 20%, rgba(0,0,0,1) 70%, transparent 100%)",
                WebkitMaskComposite: "source-in",
                maskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.4) 15%, rgba(0,0,0,0.8) 40%, rgba(0,0,0,1) 60%, rgba(0,0,0,0.6) 90%, transparent 100%), linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,1) 20%, rgba(0,0,0,1) 70%, transparent 100%)",
                maskComposite: "intersect",
              }}
              priority
            />
          </div>
        </div>
      </section>

      {/* STAT BAR */}
      <div className="border-t border-[rgba(255,255,255,0.03)] border-b border-b-[rgba(255,255,255,0.03)] bg-bg-secondary py-12 px-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(16,185,129,0.3)] to-transparent" />
        <div className="max-w-[1200px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "0+", count: "12", label: "Years Military Service", suffix: "+" },
            { value: "0+", count: "600", label: "GEHQ Community Members", suffix: "+" },
            { value: "0+", count: "15", label: "Years Coaching Experience", suffix: "+" },
            { value: "7", label: "Areas SHIFT Transforms" },
          ].map((stat, i) => (
            <div key={i} className={`relative reveal ${i > 0 ? `reveal-delay-${i}` : ""}`}>
              {i < 3 && (
                <div className="hidden md:block absolute right-0 top-[10%] h-[80%] w-px bg-gradient-to-b from-transparent via-[rgba(255,255,255,0.06)] to-transparent" />
              )}
              <div
                className="font-heading text-[2.5rem] font-black gradient-text mb-1"
                {...(stat.count ? { "data-count": stat.count } : {})}
              >
                {stat.value}
              </div>
              <div className="text-[0.82rem] text-text-muted font-medium tracking-[0.5px]">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PROBLEM */}
      <section className="py-[120px] px-8 bg-bg-secondary relative">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 80% 20%, rgba(220,80,80,0.03) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(16,185,129,0.03) 0%, transparent 50%)" }} />
        <div className="max-w-[1200px] mx-auto relative">
          <div className="reveal">
            <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">The Reality</div>
            <div className="font-heading text-[1.85rem] md:text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-6">Sound Familiar?</div>
            <div className="section-divider" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-12">
            <div className="text-[1.05rem] text-text-secondary leading-[2] reveal">
              <p className="mb-6">You&apos;re up at 6am, running a business, carrying everything. The phone doesn&apos;t stop. Decisions all day. By evening you&apos;re too drained to even think about your own health.</p>
              <p className="mb-6">You know what to do. You&apos;ve read the books. You&apos;ve had the motivation. But something always derails you. Stress hits, sleep slips, and suddenly you&apos;re back to takeaways and missed sessions.</p>
              <p className="mb-6">You&apos;ve tried the all-or-nothing approach. It can&apos;t be sustained. You&apos;ve tried willpower. It runs out.</p>
              <p className="text-text-primary font-semibold">That&apos;s not a discipline problem. That&apos;s a design problem. And it&apos;s exactly what SHIFT fixes.</p>
            </div>

            <div className="flex flex-col gap-3">
              {problems.map((p, i) => (
                <div key={i} className={`flex items-start gap-4 bg-[rgba(12,12,18,0.8)] border border-[rgba(255,255,255,0.04)] rounded-[14px] px-6 py-5 backdrop-blur-[10px] transition-all duration-300 hover:border-[rgba(220,80,80,0.2)] hover:translate-x-1 hover:shadow-[-4px_0_20px_rgba(220,80,80,0.05)] reveal ${i > 0 ? `reveal-delay-${Math.min(i, 4)}` : ""}`}>
                  <div className="w-9 h-9 min-w-[36px] bg-[rgba(220,80,80,0.08)] border border-[rgba(220,80,80,0.12)] rounded-[10px] flex items-center justify-center text-[#e05555] text-[0.85rem] font-bold">!</div>
                  <div className="text-[0.9rem] text-text-secondary leading-[1.6]">
                    <strong className="text-text-primary font-semibold">{p.title}</strong> {p.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SHIFT SYSTEM */}
      <section id="shift-system" className="py-[120px] px-8 relative">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.04) 0%, transparent 60%)" }} />
        <div className="max-w-[1200px] mx-auto relative">
          <div className="text-center max-w-[700px] mx-auto mb-12 reveal">
            <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">The Programme</div>
            <div className="font-heading text-[1.85rem] md:text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-6">The SHIFT System</div>
            <div className="section-divider mx-auto" />
            <div className="text-[1.05rem] text-text-secondary max-w-[600px] mx-auto leading-[1.8]">
              One operating system that transforms 7 areas of your life. Not a meal plan. Not a 12-week challenge. A framework that holds under pressure - built from 12 years in the military and a decade of coaching.
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 mt-12">
            {pillars.map((p, i) => (
              <div key={i} className={`bg-[rgba(12,12,18,0.6)] border border-[rgba(255,255,255,0.04)] rounded-[18px] px-5 py-8 text-center backdrop-blur-[10px] transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] relative overflow-hidden group hover:-translate-y-1.5 hover:border-[rgba(16,185,129,0.3)] hover:shadow-[0_15px_40px_rgba(16,185,129,0.1),0_0_0_1px_rgba(16,185,129,0.1)] reveal ${i > 0 ? `reveal-delay-${Math.min(i, 4)}` : ""} ${i === 6 ? "col-span-2 md:col-span-1 lg:col-span-4 lg:max-w-[280px] lg:mx-auto" : ""}`}>
                <div className="absolute top-0 left-0 right-0 h-0.5 gradient-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(16,185,129,0.06)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-14 h-14 bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.12)] rounded-[14px] flex items-center justify-center mx-auto mb-5 text-[1.4rem] font-heading font-black text-accent-bright relative z-[1] transition-all duration-300 group-hover:bg-[rgba(16,185,129,0.15)] group-hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]">{p.icon}</div>
                <h3 className="font-heading text-[0.95rem] font-bold mb-3 relative z-[1]">{p.title}</h3>
                <p className="text-[0.82rem] text-text-secondary leading-[1.6] relative z-[1]">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="results" className="py-[120px] px-8 bg-bg-secondary relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(16,185,129,0.2)] to-transparent" />
        <div className="max-w-[1200px] mx-auto">
          <div className="reveal">
            <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">Results</div>
            <div className="font-heading text-[1.85rem] md:text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-6">What Clients Are Saying</div>
            <div className="section-divider" />
            <div className="text-[1.05rem] text-text-secondary max-w-[600px] leading-[1.8]">Real outcomes from professionals who stopped starting over and built something that lasts.</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            {testimonials.map((t, i) => (
              <div key={i} className={`bg-[rgba(12,12,18,0.6)] border border-[rgba(255,255,255,0.04)] rounded-[18px] p-8 backdrop-blur-[10px] transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] relative overflow-hidden hover:-translate-y-1 hover:border-[rgba(16,185,129,0.2)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.3),0_0_40px_rgba(16,185,129,0.06)] reveal ${i > 0 ? `reveal-delay-${i}` : ""}`}>
                <div className="absolute top-[10px] left-5 font-heading text-[6rem] font-black text-[rgba(16,185,129,0.06)] leading-none">&ldquo;</div>
                <div className="text-[0.93rem] italic text-text-secondary leading-[1.8] mb-6 pl-5 border-l-2 border-accent relative z-[1]">
                  &ldquo;{t.quote}&rdquo;
                </div>
                <div className="flex items-center gap-3 relative z-[1]">
                  <div className="w-[42px] h-[42px] bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] rounded-full flex items-center justify-center font-bold text-[0.85rem] text-accent-bright">{t.initials}</div>
                  <div className="text-[0.85rem]">
                    <strong className="block text-text-primary">{t.role}</strong>
                    <span className="text-text-muted">{t.location}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap mt-4 relative z-[1]">
                  {t.tags.map((tag, j) => (
                    <span key={j} className="bg-[rgba(16,185,129,0.06)] border border-[rgba(16,185,129,0.12)] rounded-full px-3 py-1 text-[0.72rem] font-semibold text-accent-light tracking-[0.3px]">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="py-[120px] px-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="reveal">
            <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">About</div>
            <div className="font-heading text-[1.85rem] md:text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-6">About Gordy</div>
            <div className="section-divider" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-16 mt-12">
            <div className="rounded-[20px] overflow-hidden border border-[rgba(255,255,255,0.06)] relative shadow-[0_30px_80px_rgba(0,0,0,0.4)] reveal">
              <Image src="/images/gordy-about.jpg" alt="Gordy Elliott" width={500} height={667} className="w-full block object-cover" />
              <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-bg-primary to-transparent pointer-events-none" />
            </div>

            <div>
              <p className="text-text-secondary mb-4 leading-[1.85] text-[0.95rem] reveal">12 years in the military. An international online business. A gym with 600+ members. Gordy&apos;s built it all - and nearly lost himself in the process.</p>
              <p className="text-text-secondary mb-4 leading-[1.85] text-[0.95rem] reveal">When he opened his own gym, the pressure, responsibility, and constant decision-making nearly broke him. He hit a point where he realised: if he kept living like that, he&apos;d build a successful business and lose himself in the process.</p>
              <p className="text-text-secondary mb-4 leading-[1.85] text-[0.95rem] reveal">That breakdown is why SHIFT exists. Trained by Dr. John Demartini, Gordy uses a values-based approach to remove self-sabotage at the source and build habits that actually last.</p>

              <h3 className="font-heading text-[1.15rem] font-bold mt-8 mb-4 text-accent-bright reveal">His Approach</h3>
              <p className="text-text-secondary mb-4 leading-[1.85] text-[0.95rem] reveal">Calm authority. Not hype. Direct and honest - he&apos;ll tell you what you need to hear, not what sells. Supportive but not soft. Systems-first: track, feedback, refine, repeat.</p>

              <h3 className="font-heading text-[1.15rem] font-bold mt-8 mb-4 text-accent-bright reveal">Who This Is For</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                {[
                  "Self-employed and business owners aged 30-45",
                  "Driven professionals stuck in all-or-nothing cycles",
                  "People whose energy, mood, and health have slipped",
                  "Anyone done relying on motivation and willpower",
                ].map((item, i) => (
                  <div key={i} className={`flex items-start gap-3 text-[0.88rem] text-text-secondary p-4 bg-[rgba(12,12,18,0.6)] border border-[rgba(255,255,255,0.04)] rounded-xl backdrop-blur-[10px] transition-all duration-300 hover:border-[rgba(16,185,129,0.2)] hover:bg-[rgba(16,185,129,0.03)] reveal ${i > 0 ? `reveal-delay-${i}` : ""}`}>
                    <span className="text-accent font-bold min-w-[16px]">-</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-[120px] px-8 bg-bg-secondary relative">
        <div className="max-w-[1200px] mx-auto text-center">
          <div className="reveal">
            <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">Process</div>
            <div className="font-heading text-[1.85rem] md:text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-6">How It Works</div>
            <div className="section-divider mx-auto" />
            <div className="text-[1.05rem] text-text-secondary mx-auto leading-[1.8]">Three steps. No fluff. No 47-page application.</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 relative">
            <div className="hidden md:block absolute top-12 left-[calc(16.66%+24px)] right-[calc(16.66%+24px)] h-0.5 bg-gradient-to-r from-accent via-[rgba(16,185,129,0.2)] to-accent" />
            {steps.map((s, i) => (
              <div key={i} className={`text-center relative reveal ${i > 0 ? `reveal-delay-${i}` : ""}`}>
                <div className="w-24 h-24 bg-bg-primary border-2 border-accent rounded-full flex items-center justify-center mx-auto mb-7 font-heading text-[2rem] font-black text-accent-bright relative z-[1] shadow-[0_0_30px_rgba(16,185,129,0.15),inset_0_0_20px_rgba(16,185,129,0.05)] transition-all duration-300 hover:shadow-[0_0_50px_rgba(16,185,129,0.25),inset_0_0_30px_rgba(16,185,129,0.1)] hover:scale-105">
                  {s.num}
                </div>
                <h3 className="font-heading text-[1.15rem] font-bold mb-3">{s.title}</h3>
                <p className="text-sm text-text-secondary leading-[1.7] max-w-[280px] mx-auto">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLIENT PORTAL PREVIEW */}
      <section id="portal-preview" className="py-[120px] px-8 bg-bg-secondary relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(16,185,129,0.2)] to-transparent" />
        <div className="max-w-[1200px] mx-auto">
          <div className="reveal">
            <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">Exclusive to Members</div>
            <div className="font-heading text-[1.85rem] md:text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-6">Your Personal SHIFT Portal</div>
            <div className="section-divider" />
            <div className="text-[1.05rem] text-text-secondary max-w-[600px] leading-[1.8]">Every client gets their own private dashboard with the full SHIFT framework, progress tracking, check-ins, and direct access to Gordy. Everything in one place.</div>
          </div>

          <div className="mt-12 bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-[20px] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.4),0_0_60px_rgba(16,185,129,0.04)] relative reveal">
            <div className="absolute -top-px left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-[rgba(16,185,129,0.4)] to-transparent" />
            <div className="px-6 py-4 bg-[rgba(16,185,129,0.03)] border-b border-[rgba(255,255,255,0.04)] flex justify-between items-center">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#e05555]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#e0a030]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#30b050]" />
              </div>
              <span className="text-[0.82rem] font-semibold text-text-muted font-mono">portal.gordyelliott.com</span>
            </div>

            <div className="p-10">
              <div className="font-heading text-xl font-bold mb-6">Welcome back, James.</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label: "SHIFT Areas Active", value: "7", sub: "All systems go" },
                  { label: "Weekly Check-Ins", value: "14", sub: "Next due Friday" },
                  { label: "Coaching Calls", value: "5", sub: "Next: Thursday 6pm" },
                  { label: "Week Rating", value: "8/10", sub: "Trending up" },
                ].map((card, i) => (
                  <div key={i} className="bg-bg-primary border border-[rgba(255,255,255,0.04)] rounded-[14px] p-6 transition-all duration-300 hover:border-[rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.05)]">
                    <div className="text-[0.72rem] font-semibold text-text-muted uppercase tracking-[1.5px] mb-2">{card.label}</div>
                    <div className="font-heading text-[2.25rem] font-black gradient-text">{card.value}</div>
                    <div className="text-[0.78rem] text-text-muted mt-1">{card.sub}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <div className="flex justify-between text-[0.85rem] mb-2">
                  <span className="text-text-secondary">6-Month Programme Progress</span>
                  <span className="text-accent-bright font-bold">42%</span>
                </div>
                <div className="h-2.5 bg-[rgba(255,255,255,0.03)] rounded-full overflow-hidden border border-[rgba(255,255,255,0.04)]">
                  <div className="h-full w-[42%] gradient-accent rounded-full animate-[progressGlow_2s_ease-in-out_infinite]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="apply-section" className="py-[120px] px-8 bg-bg-secondary text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(16,185,129,0.08) 0%, transparent 60%), radial-gradient(ellipse at 30% 100%, rgba(16,185,129,0.04) 0%, transparent 40%)" }} />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(16,185,129,0.3)] to-transparent" />
        <div className="relative z-[1] max-w-[700px] mx-auto reveal">
          <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">Get Started</div>
          <div className="font-heading text-[1.85rem] md:text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-4">Ready to Stop Starting Over?</div>
          <div className="section-divider mx-auto" />
          <div className="text-[1.05rem] text-text-secondary mx-auto mb-10 leading-[1.8]">Apply for SHIFT coaching. If it&apos;s a fit, you&apos;ll hear back directly from Gordy.</div>
          <Link href="/apply" className="btn-primary inline-flex items-center gap-2 bg-accent text-white px-11 py-[18px] rounded-[10px] font-bold text-[1.1rem] no-underline transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_10px_40px_rgba(16,185,129,0.4),0_0_60px_rgba(16,185,129,0.15)]">
            Apply for SHIFT
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </Link>
        </div>
      </section>
    </main>
  );
}
