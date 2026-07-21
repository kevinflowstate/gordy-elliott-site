"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { unregisterNativePushDevice } from "@/lib/native-push-client";

export default function NativeSafeSignOutButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await unregisterNativePushDevice();
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={signingOut}
      className="min-h-11 border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/5 disabled:opacity-60"
    >
      {signingOut ? "Signing out..." : "Sign out"}
    </button>
  );
}
