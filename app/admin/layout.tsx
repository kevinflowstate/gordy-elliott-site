import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminBackground from "@/components/admin/AdminBackground";
import PortalKeyboardState from "@/components/portal/PortalKeyboardState";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata = {
  title: "Admin - Gordy Elliott",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <PortalKeyboardState />
      <div className="admin-shell min-h-screen bg-bg-primary text-text-primary relative">
        <AdminBackground />
        <AdminSidebar />
        <main className="admin-main lg:ml-[260px] min-h-screen relative z-[1]">
          <div className="admin-page-frame w-full max-w-7xl mx-auto px-6 pb-8 pt-20 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
