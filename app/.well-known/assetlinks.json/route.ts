import { NextResponse } from "next/server";
import { createAndroidAppLinks } from "@/lib/android-app-links";

export const dynamic = 'force-dynamic';

export function GET() {
  // Use Google Play's app-signing certificate, not just the upload certificate.
  return NextResponse.json(createAndroidAppLinks(process.env.ANDROID_APP_LINKS_SHA256_FINGERPRINTS), {
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
  });
}
