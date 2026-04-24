import { requireAdmin } from "@/lib/admin-auth";
import { sendPushToUser } from "@/lib/push";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { userId, title, body, url, tag } = await request.json();

  if (!userId || !title) {
    return NextResponse.json({ error: "userId and title are required" }, { status: 400 });
  }

  try {
    const result = await sendPushToUser(userId, { title, body, url, tag });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({
      sent: 0,
      failed: 0,
      reason: err instanceof Error ? err.message : "Push send failed before delivery.",
      subscriptionCount: 0,
    }, { status: 500 });
  }
}
