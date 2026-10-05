import type { Metadata } from "next";
import Link from "next/link";
import SupportReportForm from "@/components/support/SupportReportForm";
export const metadata: Metadata = {
  title: "Report an app problem",
  description:
    "Send technical feedback directly to the AT CAPACITY support team.",
};
export default function ReportPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] px-5 py-8 text-white sm:py-14">
      <article className="mx-auto max-w-2xl">
        <Link href="/support" className="text-sm font-semibold text-[#f06be3]">
          ← AT CAPACITY support
        </Link>
        <p className="mt-9 text-xs font-semibold tracking-[0.16em] text-[#f06be3]">
          HELP US MAKE IT BETTER
        </p>
        <h1 className="mt-3 font-heading text-3xl font-bold sm:text-4xl">
          Report an app problem
        </h1>
        <p className="mb-8 mt-4 leading-7 text-[#c3c4cd]">
          Something getting in your way? Send it straight to the app support
          team. You can use this form even if you cannot sign in.
        </p>
        <SupportReportForm />
      </article>
    </main>
  );
}
