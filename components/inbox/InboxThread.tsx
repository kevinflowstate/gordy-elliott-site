"use client";

import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect, useRef, useState } from "react";
import { nativeBuildSupportsVoiceNotes } from "@/lib/native-voice";
import type { InboxMessage, UserRole } from "@/lib/types";

interface InboxThreadProps {
  messages: InboxMessage[];
  currentRole: UserRole;
  onSend: (message: string) => Promise<void>;
  onSendAudio?: (audio: Blob, durationSeconds: number) => Promise<void>;
  sending: boolean;
  error: string | null;
  emptyTitle: string;
  emptyDescription: string;
  composerPlaceholder?: string;
  threadLabel?: string;
  threadMeta?: string;
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InboxThread({
  messages,
  currentRole,
  onSend,
  onSendAudio,
  sending,
  error,
  emptyTitle,
  emptyDescription,
  composerPlaceholder = "Write a message...",
  threadLabel,
  threadMeta,
}: InboxThreadProps) {
  const [draft, setDraft] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submittingRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingStartedRef = useRef(0);
  const audioDraftUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioDraft, setAudioDraft] = useState<{ blob: Blob; url: string; duration: number } | null>(null);
  const [voiceAvailability, setVoiceAvailability] = useState<"checking" | "ready" | "update-required">("checking");

  const canSend = draft.trim().length > 0 && !sending;
  const latestMessageId = messages.at(-1)?.id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [latestMessageId]);

  useEffect(() => {
    if (!recording) return;
    const interval = window.setInterval(() => {
      const seconds = Math.min(180, Math.max(1, Math.round((Date.now() - recordingStartedRef.current) / 1000)));
      setRecordingSeconds(seconds);
      if (seconds >= 180) recorderRef.current?.stop();
    }, 250);
    return () => window.clearInterval(interval);
  }, [recording]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const recorder = recorderRef.current;
      if (recorder) recorder.onstop = null;
      if (recorder?.state === "recording") recorder.stop();
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      if (audioDraftUrlRef.current) URL.revokeObjectURL(audioDraftUrlRef.current);
      audioDraftUrlRef.current = null;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!Capacitor.isNativePlatform()) {
      setVoiceAvailability("ready");
      return () => { active = false; };
    }

    void App.getInfo()
      .then((info) => {
        if (active) setVoiceAvailability(nativeBuildSupportsVoiceNotes(info.build) ? "ready" : "update-required");
      })
      .catch(() => {
        if (active) setVoiceAvailability("update-required");
      });

    return () => { active = false; };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending || submittingRef.current) return;

    submittingRef.current = true;
    setLocalError(null);
    try {
      await onSend(message);
      setDraft("");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Message could not be sent.");
    } finally {
      submittingRef.current = false;
    }
  }

  async function startRecording() {
    setLocalError(null);
    if (voiceAvailability !== "ready") {
      setLocalError("Update AT CAPACITY from TestFlight to record voice notes.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setLocalError("Voice notes aren't supported on this device.");
      return;
    }
    try {
      if (audioDraftUrlRef.current) URL.revokeObjectURL(audioDraftUrlRef.current);
      audioDraftUrlRef.current = null;
      setAudioDraft(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
      const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        const duration = Math.min(180, Math.max(1, Math.round((Date.now() - recordingStartedRef.current) / 1000)));
        const simpleType = (recorder.mimeType || mimeType || "audio/mp4").split(";")[0];
        const blob = new Blob(chunks, { type: simpleType });
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        recorderRef.current = null;
        if (!mountedRef.current) return;
        const url = URL.createObjectURL(blob);
        audioDraftUrlRef.current = url;
        setAudioDraft({ blob, url, duration });
        setRecording(false);
      };
      recorderRef.current = recorder;
      recordingStartedRef.current = Date.now();
      setRecordingSeconds(1);
      setRecording(true);
      recorder.start(500);
    } catch {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      recorderRef.current = null;
      setRecording(false);
      setLocalError("Microphone access is needed to record a voice note.");
    }
  }

  function discardAudioDraft() {
    if (audioDraftUrlRef.current) URL.revokeObjectURL(audioDraftUrlRef.current);
    audioDraftUrlRef.current = null;
    setAudioDraft(null);
  }

  async function sendAudioDraft() {
    if (!audioDraft || !onSendAudio || sending) return;
    setLocalError(null);
    try {
      await onSendAudio(audioDraft.blob, audioDraft.duration);
      discardAudioDraft();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Voice note could not be sent.");
    }
  }

  return (
    <div className="portal-dm-thread flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.025)] md:min-h-[min(72dvh,48rem)]">
      {(threadLabel || threadMeta) && (
        <div className="border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
          {threadLabel && <div className="text-sm font-semibold text-text-primary">{threadLabel}</div>}
          {threadMeta && <div className="mt-0.5 text-xs text-text-muted">{threadMeta}</div>}
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
        {messages.length === 0 ? (
          <div className="portal-dm-empty flex min-h-80 flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent-bright">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h8m-8 4h5m-7 6h12a2 2 0 002-2V8a2 2 0 00-.586-1.414l-4-4A2 2 0 0014 2H6a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-heading font-bold text-text-primary">{emptyTitle}</h2>
            <p className="mt-2 max-w-sm text-sm text-text-secondary">{emptyDescription}</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwn = message.sender_role === currentRole;
            return (
              <div key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[84%] rounded-2xl px-4 py-3 sm:max-w-[72%] ${
                  isOwn
                    ? "bg-accent-bright text-black"
                    : "border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.045)] text-text-primary"
                }`}>
                  <div className={`mb-1 text-[11px] font-semibold ${isOwn ? "text-black/65" : "text-text-muted"}`}>
                    {isOwn ? "You" : message.sender_name || (message.sender_role === "admin" ? "Gordy" : "Client")}
                  </div>
                  {message.message_type === "audio" ? (
                    message.audio_url ? (
                      <div className="min-w-[13rem]">
                        <div className={`mb-2 text-xs font-semibold ${isOwn ? "text-black/65" : "text-accent-bright"}`}>Voice note · {message.audio_duration_seconds || 0}s</div>
                        <audio controls preload="metadata" src={message.audio_url} className="h-10 w-full max-w-[18rem]" />
                      </div>
                    ) : <div className="text-sm">Voice note unavailable. Refresh to try again.</div>
                  ) : (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.message}</div>
                  )}
                  <div className={`mt-2 text-[10px] ${isOwn ? "text-black/55" : "text-text-muted"}`}>
                    {formatTime(message.created_at)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {(error || localError) && (
        <div className="mx-4 mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {localError || error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="portal-dm-composer border-t border-[rgba(255,255,255,0.06)] p-3 sm:p-4">
        {audioDraft && (
          <div className="mb-3 flex items-center gap-3 rounded-2xl border border-accent/20 bg-accent/8 p-3">
            <audio controls preload="metadata" src={audioDraft.url} className="h-10 min-w-0 flex-1" />
            <button type="button" onClick={discardAudioDraft} className="min-h-10 rounded-xl border border-white/10 px-3 text-xs font-semibold text-text-secondary">Delete</button>
            <button type="button" onClick={() => void sendAudioDraft()} disabled={sending} className="min-h-10 rounded-xl bg-accent-bright px-3 text-xs font-bold text-black disabled:opacity-50">Send</button>
          </div>
        )}
        <div className="flex items-end gap-2">
          {onSendAudio && (
            <button
              type="button"
              onClick={() => recording ? recorderRef.current?.stop() : void startRecording()}
              disabled={sending || Boolean(audioDraft) || voiceAvailability !== "ready"}
              aria-label={recording ? "Stop recording" : "Record voice note"}
              title={voiceAvailability === "update-required" ? "Update AT CAPACITY from TestFlight to record voice notes" : recording ? "Stop recording" : "Record voice note"}
              className={`flex h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-bold transition-colors disabled:opacity-35 ${recording ? "border-red-400/40 bg-red-500/15 text-red-400" : "border-white/10 bg-white/[0.04] text-text-secondary"}`}
            >
              <span className={`h-2.5 w-2.5 ${recording ? "rounded-sm bg-red-400" : "rounded-full bg-accent-bright"}`} />
              {recording ? `${recordingSeconds}s` : voiceAvailability === "update-required" ? "Update required" : "Voice"}
            </button>
          )}
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              event.currentTarget.style.height = "auto";
              event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 120)}px`;
            }}
            placeholder={composerPlaceholder}
            rows={1}
            maxLength={4000}
            className="min-h-11 max-h-[7.5rem] flex-1 resize-none overflow-y-auto rounded-xl border border-[rgba(255,255,255,0.08)] bg-bg-primary px-4 py-3 text-base leading-5 text-text-primary placeholder:text-text-muted focus:border-accent-bright focus:outline-none"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button
            type="submit"
            disabled={!canSend || recording || Boolean(audioDraft)}
            aria-label={sending ? "Sending message" : "Send message"}
            title="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-bright text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 19V5m0 0-6 6m6-6 6 6" />
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
