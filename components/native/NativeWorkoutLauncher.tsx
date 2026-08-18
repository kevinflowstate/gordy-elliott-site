"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  NATIVE_WORKOUT_CLOSED_EVENT,
  NATIVE_WORKOUT_UNAVAILABLE_EVENT,
  isNativeWorkoutAvailable,
  openNativeWorkout,
  type NativeWorkoutLaunchOptions,
} from "@/lib/native-workout";

interface NativeWorkoutLauncherProps extends NativeWorkoutLaunchOptions {
  fallback: ReactNode;
  onClose: () => void;
}

export default function NativeWorkoutLauncher({ fallback, onClose, ...launch }: NativeWorkoutLauncherProps) {
  const [usesWebFallback, setUsesWebFallback] = useState(() => !isNativeWorkoutAvailable());
  const initialLaunch = useRef(launch);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (usesWebFallback) return;
    const handleClosed = () => onCloseRef.current();
    const handleUnavailable = () => setUsesWebFallback(true);
    window.addEventListener(NATIVE_WORKOUT_CLOSED_EVENT, handleClosed);
    window.addEventListener(NATIVE_WORKOUT_UNAVAILABLE_EVENT, handleUnavailable);

    if (!openNativeWorkout(initialLaunch.current)) {
      window.setTimeout(() => setUsesWebFallback(true), 0);
    }

    return () => {
      window.removeEventListener(NATIVE_WORKOUT_CLOSED_EVENT, handleClosed);
      window.removeEventListener(NATIVE_WORKOUT_UNAVAILABLE_EVENT, handleUnavailable);
    };
  }, [usesWebFallback]);

  if (usesWebFallback) return fallback;

  return (
    <div className="fixed inset-0 z-[100] grid min-h-[100dvh] place-items-center bg-[#09090b] px-6 text-center text-white">
      <div>
        <div className="mx-auto h-2 w-2 animate-pulse rounded-full bg-[#E040D0] motion-reduce:animate-none" />
        <p className="mt-4 text-sm font-semibold text-white/55">Opening your workout…</p>
      </div>
    </div>
  );
}
