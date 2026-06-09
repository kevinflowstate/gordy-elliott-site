// Coach-led "note of the day" lines in Gordy's SHIFT voice.
// Direct, earned, no cheesy generic motivation. One is surfaced per day,
// chosen by day-of-year so it stays stable through the day and a client
// won't see the same line again for ~4 weeks (28 lines).

export interface CoachNote {
  line: string;
  tag: string;
}

export const COACH_NOTES: CoachNote[] = [
  { line: "You don't need to feel ready. You need to start. Ready shows up after.", tag: "Gordy" },
  { line: "Consistency beats intensity every week of the year. Just keep turning up.", tag: "SHIFT" },
  { line: "The session you don't want to do is usually the one that moves you most.", tag: "Gordy" },
  { line: "Log it even when it's average. Honest data is what we actually coach off.", tag: "SHIFT" },
  { line: "Sleep and protein aren't the boring bits. They're the whole foundation.", tag: "Gordy" },
  { line: "Progress is quiet. It rarely feels like much until you look back a month.", tag: "SHIFT" },
  { line: "One good decision now makes the next one easier. Stack them.", tag: "Gordy" },
  { line: "You're not behind. You're exactly where the work you've done has put you.", tag: "SHIFT" },
  { line: "Train the standard, not the mood. The mood will catch up.", tag: "Gordy" },
  { line: "Missed a day? Fine. Don't miss two. That's the whole game.", tag: "SHIFT" },
  { line: "Hydration, steps, sleep. Win the basics before you chase the clever stuff.", tag: "Gordy" },
  { line: "Discipline is just remembering what you actually want.", tag: "SHIFT" },
  { line: "Show me a tough week logged honestly and I'll show you someone who's winning.", tag: "Gordy" },
  { line: "The plan only works at the speed you work it. Today counts.", tag: "SHIFT" },
  { line: "Don't aim for perfect. Aim for repeatable.", tag: "Gordy" },
  { line: "Recovery is part of training, not a reward for it. Take it seriously.", tag: "SHIFT" },
  { line: "Effort you can measure is effort we can improve. Keep tracking it.", tag: "Gordy" },
  { line: "Small and steady is still moving. Comparison is the only thing that stalls you.", tag: "SHIFT" },
  { line: "You built the habit of starting. Now build the habit of finishing.", tag: "Gordy" },
  { line: "On the hard days, shrink the goal. Ten honest minutes still counts.", tag: "SHIFT" },
  { line: "Your future self is built by the boring reps you do today.", tag: "Gordy" },
  { line: "Check in even when it's been a rough one. That's exactly when I want to hear from you.", tag: "Gordy" },
  { line: "Strong isn't a look. It's what showing up every week turns you into.", tag: "SHIFT" },
  { line: "Fuel the work. Under-eating to train hard is a fight you'll lose.", tag: "Gordy" },
  { line: "Momentum is fragile early and unstoppable later. Protect the early days.", tag: "SHIFT" },
  { line: "Decide once, then stop negotiating with yourself every morning.", tag: "Gordy" },
  { line: "The goal isn't to never slip. It's to come back faster every time.", tag: "SHIFT" },
  { line: "Trust the process you can see in your own logs. The numbers don't lie.", tag: "Gordy" },
];

/** Stable day-of-year index so the note is the same all day and rotates daily. */
export function getCoachNoteOfDay(date: Date = new Date()): CoachNote {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86_400_000);
  return COACH_NOTES[dayOfYear % COACH_NOTES.length];
}
