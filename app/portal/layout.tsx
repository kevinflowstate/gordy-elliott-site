import type { Viewport } from "next";
import Sidebar from "@/components/portal/Sidebar";
import MobileNav from "@/components/portal/MobileNav";
import PushNotificationBanner from "@/components/portal/PushNotificationBanner";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata = {
  title: "Client Portal - Gordy Elliott",
};

// Portal is always dark, regardless of system preference — match status-bar colour
// to the bg-bg-primary token so PWA standalone status bar doesn't flash white.
export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="dark min-h-screen bg-bg-primary text-text-primary">
        <Sidebar />
        <main className="min-h-screen pb-28 sm:pb-32 lg:ml-[260px] lg:pb-0">
          <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
            <PushNotificationBanner />
            {children}
          </div>
        </main>
        <MobileNav />
      </div>
    </ToastProvider>
  );
}
