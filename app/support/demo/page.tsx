import { notFound } from "next/navigation";
import SupportDemo from "@/components/support/SupportDemo";
export const dynamic = "force-dynamic";
export default function DemoPage() {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.SUPPORT_DEMO !== "true"
  )
    notFound();
  return <SupportDemo />;
}
