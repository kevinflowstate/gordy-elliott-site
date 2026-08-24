import Link from "next/link";

export default function OnboardingWaitingPage() {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-2xl items-center px-4 py-10">
      <section className="w-full rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(224,64,208,0.12),rgba(255,255,255,0.025))] p-7 text-center shadow-2xl sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/25 bg-accent/15 text-accent-bright">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div className="mt-5 text-[11px] font-bold uppercase tracking-[0.2em] text-accent-bright">Consultation received</div>
        <h1 className="mt-3 text-3xl font-heading font-extrabold text-white">Gordy is building your plan</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-text-secondary">Your answers are safely in. Gordy will review them, prepare your coaching setup and switch your full portal access on when everything is ready.</p>
        <div className="mt-7 rounded-2xl border border-white/8 bg-black/20 px-5 py-4 text-left">
          <div className="text-xs font-bold uppercase tracking-[0.15em] text-white/55">What happens next</div>
          <ol className="mt-3 space-y-3 text-sm text-white/80">
            <li className="flex gap-3"><span className="font-bold text-accent-bright">1</span> Gordy reviews your consultation.</li>
            <li className="flex gap-3"><span className="font-bold text-accent-bright">2</span> Your training, nutrition and coaching setup are prepared.</li>
            <li className="flex gap-3"><span className="font-bold text-accent-bright">3</span> You’ll be notified when AT CAPACITY is ready to use.</li>
          </ol>
        </div>
        <Link href="/portal/settings" className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-white no-underline">View account settings</Link>
      </section>
    </div>
  );
}
