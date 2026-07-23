import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How AT CAPACITY handles client information.",
};

const sections = [
  {
    title: "Information AT CAPACITY handles",
    body: "AT CAPACITY stores account and contact details, coaching plans, messages, check-ins, progress photos, training and nutrition logs, consultation answers, and any health, injury or cycle information you choose to provide. If you connect a supported app through Terra, AT CAPACITY may also receive sleep, recovery, activity and nutrition summaries from that provider.",
  },
  {
    title: "How information is used",
    body: "Your information is used to deliver and personalise coaching, show your plans and progress, support messaging and reminders, identify useful coaching trends, secure the service, and resolve technical problems. Connected-health data informs coaching suggestions only; it does not automatically change your programme and is not used for medical diagnosis or emergency care.",
  },
  {
    title: "AI-assisted features",
    body: "AT CAPACITY may send relevant coaching context to contracted AI service providers to produce summaries or suggestions. Gordy remains responsible for coaching decisions. AI output can be incomplete or wrong and should not be treated as medical advice.",
  },
  {
    title: "Who receives information",
    body: "Information is available to Gordy and authorised service providers needed to operate AT CAPACITY, such as hosting, authentication, database, email, notification, AI and connected-app providers. Information is not sold. Providers are given only the access needed to deliver their service.",
  },
  {
    title: "Retention and deletion",
    body: "Information is kept while your account is active and for as long as reasonably required for coaching, security, dispute resolution or legal obligations. You can permanently delete your account and associated coaching data from Settings in the client portal. Some records may be retained where the law requires it.",
  },
  {
    title: "Your choices",
    body: "You can update profile information, disconnect supported apps, turn optional cycle tracking off, and request access to or correction of your information. You can also delete your account in Settings. Disconnecting a provider stops new syncs but does not by itself delete information already received.",
  },
  {
    title: "Security and age",
    body: "AT CAPACITY uses access controls and encrypted connections to protect information, but no online service can promise absolute security. AT CAPACITY is intended for Gordy's coaching clients and is not directed to children under 16.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] px-5 py-10 text-white sm:px-8 sm:py-16">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold text-[#f06be3] no-underline">AT CAPACITY</Link>
        <h1 className="mt-6 font-heading text-4xl font-bold">Privacy Policy</h1>
        <p className="mt-3 text-sm text-[#aeb0bb]">Effective 20 July 2026</p>
        <p className="mt-8 text-base leading-7 text-[#d3d4dc]">
          This policy explains how AT CAPACITY by Gordy Elliott handles information when you use the website, PWA or iOS app.
        </p>

        <div className="mt-10 space-y-9">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="font-heading text-xl font-bold">{section.title}</h2>
              <p className="mt-3 text-[15px] leading-7 text-[#c3c4cd]">{section.body}</p>
            </section>
          ))}
          <section>
            <h2 className="font-heading text-xl font-bold">Contact</h2>
            <p className="mt-3 text-[15px] leading-7 text-[#c3c4cd]">
              AI Coaching clients can contact Gordy through DM in AT CAPACITY. Founder Dashboard clients should use their agreed WhatsApp channel. For account-access help, visit the <Link href="/support" className="text-[#f06be3]">support page</Link>.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
