import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support",
  description: "Help with the AT CAPACITY client app.",
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] px-5 py-10 text-white sm:px-8 sm:py-16">
      <article className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm font-semibold text-[#f06be3] no-underline">AT CAPACITY</Link>
        <h1 className="mt-6 font-heading text-4xl font-bold">Support</h1>
        <p className="mt-5 text-base leading-7 text-[#c3c4cd]">
          AT CAPACITY is for existing Gordy Elliott coaching clients. Use the options below if you need help with the app or your account.
        </p>

        <div className="mt-10 space-y-6">
          <section className="border-t border-white/10 pt-6">
            <h2 className="font-heading text-xl font-bold">Report an app problem</h2>
            <p className="mt-3 text-[15px] leading-7 text-[#c3c4cd]">Send technical problems directly to the app support team. You can report an issue even if you cannot sign in.</p>
            <Link href="/support/report" className="mt-4 inline-flex min-h-12 items-center rounded-lg bg-[#e040d0] px-5 font-semibold text-white no-underline">Report an app problem</Link>
          </section>
          <section className="border-t border-white/10 pt-6">
            <h2 className="font-heading text-xl font-bold">Coaching questions</h2>
            <p className="mt-3 text-[15px] leading-7 text-[#c3c4cd]">Sign in and open DM to message Gordy about your coaching, training or nutrition.</p>
            <Link href="/login" className="mt-4 inline-flex min-h-12 items-center rounded-lg bg-[#e040d0] px-5 font-semibold text-white no-underline">Open client login</Link>
          </section>

          <section className="border-t border-white/10 pt-6">
            <h2 className="font-heading text-xl font-bold">Cannot sign in</h2>
            <p className="mt-3 text-[15px] leading-7 text-[#c3c4cd]">Use the password-reset option on the login screen. For technical or account-access help, email <a href="mailto:kevin@flowstatesystems.ai" className="text-[#f06be3]">kevin@flowstatesystems.ai</a>.</p>
          </section>

          <section className="border-t border-white/10 pt-6">
            <h2 className="font-heading text-xl font-bold">Privacy and account deletion</h2>
            <p className="mt-3 text-[15px] leading-7 text-[#c3c4cd]">You can disconnect apps or permanently delete your account from Settings after signing in.</p>
            <Link href="/account-deletion" className="mt-3 inline-block text-[#f06be3]">Account deletion options</Link>
            <Link href="/privacy" className="mt-3 ml-5 inline-block text-[#f06be3]">Read the privacy policy</Link>
          </section>
        </div>
      </article>
    </main>
  );
}
