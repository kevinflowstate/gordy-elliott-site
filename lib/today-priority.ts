import { calendarEventOccursOnDate } from "@/lib/calendar-occurrence";
import type { CalendarEvent } from "@/lib/types";
import type { WearableDailySummary } from "@/lib/wearable-insights";

export type ImmediateTodayPriority = {
  label: string;
  body: string;
  href: string;
  cta: string;
};

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function getImmediateTodayPriority({
  calendarEvents,
  wearableSummary,
  todayTraining,
  now = new Date(),
}: {
  calendarEvents: CalendarEvent[];
  wearableSummary: WearableDailySummary | null;
  todayTraining: string | null;
  now?: Date;
}): ImmediateTodayPriority | null {
  const timedEventsToday = calendarEvents.filter(
    (event) => !event.all_day && calendarEventOccursOnDate(event, now),
  ).length;
  const recovery = wearableSummary?.summary_date === localDateKey(now)
    ? wearableSummary.recovery_status
    : null;
  const actionHref = todayTraining ? "/portal/exercise-plan" : "/portal/daily-tracker";
  const actionCta = todayTraining ? "Review today's session" : "Open daily tracker";

  if (recovery === "reduce_intensity" && timedEventsToday >= 3) {
    return {
      label: "Give today some breathing room",
      body: `Recovery is under pressure and you have ${timedEventsToday} timed events. Keep training controlled and simplify what you can.`,
      href: actionHref,
      cta: actionCta,
    };
  }
  if (recovery === "reduce_intensity") {
    return {
      label: todayTraining ? "Keep today's session controlled" : "Protect recovery today",
      body: todayTraining
        ? "Your fresh recovery signals are lower today. Train technically and leave personal bests for another day."
        : "Your fresh recovery signals are lower today. Protect the basics and avoid adding unnecessary load.",
      href: actionHref,
      cta: actionCta,
    };
  }
  if (timedEventsToday >= 5) {
    return {
      label: todayTraining ? "Protect today's training window" : "Busy day: protect the basics",
      body: `You have ${timedEventsToday} timed events today. Keep the plan realistic and protect the essentials around them.`,
      href: actionHref,
      cta: actionCta,
    };
  }
  if (recovery === "watch" && timedEventsToday >= 3) {
    return {
      label: "Keep today flexible",
      body: `Recovery needs a little attention and you have ${timedEventsToday} timed events. Stay responsive rather than forcing the day.`,
      href: actionHref,
      cta: actionCta,
    };
  }
  if (recovery === "watch" && todayTraining) {
    return {
      label: "Train, but stay responsive",
      body: "Today's recovery signals are a little lower. Keep the session, but adjust effort if execution starts to drop.",
      href: "/portal/exercise-plan",
      cta: "Review today's session",
    };
  }
  return null;
}
