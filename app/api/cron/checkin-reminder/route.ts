import { createAdminClient } from "@/lib/supabase/admin";
import { notifyClientProfile } from "@/lib/client-notifications";
import { sendPushToUser } from "@/lib/push";
import { sendCheckinReminderEmail } from "@/lib/email-templates";
import { NextResponse } from "next/server";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized calls
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const today = DAYS[now.getDay()];
  const todayIso = now.toISOString().split("T")[0];
  const todayMonthDay = todayIso.slice(5);
  const currentYear = now.getFullYear();

  // Get the configured check-in day
  const { data: formConfig } = await admin
    .from("form_config")
    .select("config")
    .eq("form_type", "checkin")
    .maybeSingle();

  const checkinDay = formConfig?.config?.checkin_day || "monday";

  // Get all client users (not admins)
  const { data: clients } = await admin
    .from("users")
    .select("id, full_name")
    .eq("role", "client");

  // Get client_profiles to map user_id -> client_id
  const { data: profiles } = await admin
    .from("client_profiles")
    .select("id, user_id, date_of_birth");

  const userToClientId = new Map(
    (profiles || []).map((p) => [p.user_id, p.id])
  );

  const nameByUserId = new Map((clients || []).map((client) => [client.id, client.full_name || "there"]));
  const userIdByClientId = new Map((profiles || []).map((profile) => [profile.id, profile.user_id]));

  const { data: keyDates } = await admin
    .from("client_key_dates")
    .select("id, client_id, label, date, recurring");

  const wishEvents = [
    ...(profiles || [])
      .filter((profile) => profile.date_of_birth?.slice(5) === todayMonthDay)
      .map((profile) => ({
        clientId: profile.id,
        tag: `birthday-${profile.id}-${currentYear}`,
        title: `Happy birthday, ${(nameByUserId.get(profile.user_id) || "there").split(" ")[0]}.`,
        message: "Have a good one - then get back to work tomorrow. - Gordy",
      })),
    ...(keyDates || [])
      .filter((item) => item.recurring ? item.date.slice(5) === todayMonthDay : item.date === todayIso)
      .map((item) => {
        const userId = userIdByClientId.get(item.client_id);
        const firstName = (userId ? nameByUserId.get(userId) : "there")?.split(" ")[0] || "there";
        return {
          clientId: item.client_id,
          tag: `key-date-${item.id}-${item.recurring ? currentYear : item.date}`,
          title: `${item.label} today, ${firstName}.`,
          message: "Mark it, then keep moving. - Gordy",
        };
      }),
  ];

  let keyDateWishes = 0;
  for (const event of wishEvents) {
    const userId = userIdByClientId.get(event.clientId);
    if (!userId) continue;
    const { data: existing } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("tag", event.tag)
      .maybeSingle();
    if (existing?.id) continue;

    await notifyClientProfile(event.clientId, {
      title: event.title,
      message: event.message,
      link: "/portal",
      tag: event.tag,
    });
    keyDateWishes++;
  }

  // Send push + email to clients who haven't checked in yet
  let pushSent = 0;
  let emailSent = 0;
  let skipped = 0;

  if (today === checkinDay && clients && clients.length > 0) {
    // Check which clients have already checked in this week
    const startOfWeek = new Date();
    const dayOfWeek = startOfWeek.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const { data: recentCheckins } = await admin
      .from("checkins")
      .select("client_id")
      .gte("created_at", startOfWeek.toISOString());

    const checkedInClientIds = new Set(
      (recentCheckins || []).map((c) => c.client_id)
    );

    // Get week number for email
    const { data: profilesWithStart } = await admin
      .from("client_profiles")
      .select("id, user_id, start_date");
    const clientStartDates = new Map(
      (profilesWithStart || []).map((p: { user_id: string; start_date: string }) => [p.user_id, p.start_date])
    );

    for (const client of clients) {
      const clientId = userToClientId.get(client.id);
      if (clientId && checkedInClientIds.has(clientId)) {
        skipped++;
        continue;
      }

      // Push notification
      const result = await sendPushToUser(client.id, {
        title: "Time for your weekly check-in",
        body: "Take 2 minutes to share your wins, challenges, and questions.",
        url: "/portal/checkin",
        tag: "checkin-reminder",
      });
      if (result.sent > 0) pushSent++;

      // Email fallback
      const startDate = clientStartDates.get(client.id);
      const weekNum = startDate
        ? Math.ceil((Date.now() - new Date(startDate).getTime()) / (7 * 24 * 60 * 60 * 1000))
        : 1;

      try {
        // Get client email
        const { data: userData } = await admin.auth.admin.getUserById(client.id);
        if (userData?.user?.email) {
          await sendCheckinReminderEmail(
            userData.user.email,
            client.full_name || "there",
            weekNum
          );
          emailSent++;
        }
      } catch {
        // Email send failed - push was the primary anyway
      }
    }
  }

  return NextResponse.json({
    message: today === checkinDay ? "Daily cron complete" : `Not check-in day. Today: ${today}, check-in day: ${checkinDay}`,
    today,
    checkinDay,
    checkinReminders: pushSent,
    keyDateWishes,
    pushSent,
    emailSent,
    skipped,
    totalClients: clients?.length || 0,
  });
}
