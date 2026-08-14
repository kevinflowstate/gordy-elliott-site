import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { getExerciseDemoUrl } from "@/lib/exercise-demo";

export async function openExerciseDemo(value: string | null | undefined, exerciseName?: string | null) {
  const url = getExerciseDemoUrl(value, exerciseName);
  if (!url) return;
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Browser")) {
    await Browser.open({ url });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
