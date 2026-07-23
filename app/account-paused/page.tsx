import Image from "next/image";
import NativeSafeSignOutButton from "@/components/native/NativeSafeSignOutButton";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPausedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await createAdminClient()
        .from("client_profiles")
        .select("lifecycle_resumes_at")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const lifecycleResumesAt = profile?.lifecycle_resumes_at || null;
  const resumeLabel = lifecycleResumesAt
    ? new Date(lifecycleResumesAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Europe/London",
      })
    : null;

  return (
    <main className="dark flex min-h-dvh items-center justify-center bg-[#0A0A0A] px-5 py-12 text-white">
      <div className="w-full max-w-lg border-y border-white/10 py-10 text-center">
        <Image src="/images/shift-logo.svg" alt="AT CAPACITY" width={48} height={48} className="mx-auto h-12 w-auto" />
        <div className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#E667D6]">AT CAPACITY</div>
        <h1 className="mt-3 text-2xl font-heading font-bold">Your coaching access is paused</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#b5b7c2]">
          Your history and plans are safe. Contact Gordy when you are ready to resume access.
        </p>
        {resumeLabel && (
          <p className="mt-4 text-sm font-semibold">Scheduled to resume {resumeLabel}</p>
        )}
        <div className="mt-7">
          <NativeSafeSignOutButton />
        </div>
      </div>
    </main>
  );
}
