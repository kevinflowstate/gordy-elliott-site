import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Delete your AT CAPACITY account" };

export default function AccountDeletionPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] px-5 py-10 text-white sm:py-16">
      <article className="mx-auto max-w-2xl space-y-6">
        <Link href="/support" className="text-sm font-semibold text-[#f06be3]">AT CAPACITY support</Link>
        <h1 className="font-heading text-3xl font-bold">Delete your account</h1>
        <p className="leading-7 text-[#c3c4cd]">To delete your AT CAPACITY account and associated coaching data, sign in, open Settings, and choose Delete account. Follow the confirmation steps. This permanently removes your app account.</p>
        <Link href="/login?redirect=%2Fportal%2Fsettings" className="inline-flex min-h-12 items-center rounded-lg bg-[#e040d0] px-5 font-semibold">Sign in to manage your account</Link>
        <h2 className="font-heading text-xl font-bold">If you cannot sign in</h2>
        <p className="leading-7 text-[#c3c4cd]">Email <a href="mailto:kevin@flowstatesystems.ai?subject=AT%20CAPACITY%20account%20deletion%20request" className="text-[#f06be3]">kevin@flowstatesystems.ai</a> with the subject “AT CAPACITY account deletion request” and the email address registered to your account. The support team will verify ownership before deleting anything. Do not send your password.</p>
        <p className="leading-7 text-[#c3c4cd]">Deleting your account removes its associated profile, coaching records and connected calendar data, and revokes supported wearable and calendar connections. Some records may be retained where required by law or to resolve necessary security or legal issues. See the <Link href="/privacy" className="text-[#f06be3]">privacy policy</Link> for the full retention details. Contact Gordy separately about your coaching agreement.</p>
      </article>
    </main>
  );
}
