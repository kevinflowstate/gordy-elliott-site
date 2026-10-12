"use client";

import { useEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { nativeBuildSupportsVoiceNotes } from "@/lib/native-voice";

type Answer = { id: string; reply_text: string | null; audio_url: string | null; audio_unavailable?: boolean; created_at: string; lesson?: { title: string } };
export default function LessonResponses({ moduleId, contentId, clientId }: { moduleId?: string; contentId?: string; clientId?: string }) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [text, setText] = useState("");
  const [audio, setAudio] = useState<{ blob: Blob; url: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const [voiceReady, setVoiceReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [revision, setRevision] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const audioUrl = useRef<string | null>(null);
  const endpoint = clientId ? `/api/admin/training/responses?client=${clientId}` : `/api/portal/training/${moduleId}/responses?contentId=${contentId}`;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(endpoint, { signal: controller.signal }).then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load answers");
      setAnswers(data.responses || []);
    }).catch(err => { if (!controller.signal.aborted) setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, revision]);

  useEffect(() => {
    mounted.current = true;
    if (!Capacitor.isNativePlatform()) setVoiceReady(true);
    else void App.getInfo().then(info => { if (mounted.current) setVoiceReady(nativeBuildSupportsVoiceNotes(info.build)); }).catch(() => {});
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach(track => track.stop());
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    };
  }, []);

  function discardAudio() {
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = null;
    setAudio(null);
  }
  function stopRecording() {
    if (timer.current) clearTimeout(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  }
  async function record() {
    setError(""); setSaved(false);
    if (!voiceReady || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError("Recording isn't available in this app version. Use a text answer or upload a voice note."); return; }
    try {
      discardAudio();
      const input = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { input.getTracks().forEach(track => track.stop()); return; }
      stream.current = input;
      const mimeType = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
      const next = mimeType ? new MediaRecorder(input, { mimeType }) : new MediaRecorder(input);
      const chunks: BlobPart[] = [];
      next.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      next.onstop = () => {
        input.getTracks().forEach(track => track.stop()); stream.current = null; recorder.current = null;
        if (!mounted.current) return;
        const blob = new Blob(chunks, { type: (next.mimeType || mimeType || "audio/mp4").split(";")[0] });
        const url = URL.createObjectURL(blob); audioUrl.current = url; setAudio({ blob, url }); setRecording(false);
      };
      recorder.current = next; next.start(500); setRecording(true);
      timer.current = setTimeout(stopRecording, 180000);
    } catch { stream.current?.getTracks().forEach(track => track.stop()); setError("Microphone access is needed to record. You can still type your answer."); }
  }
  async function send() {
    if (saving || recording || (!text.trim() && !audio)) return;
    setSaving(true); setError(""); setSaved(false);
    try {
      const form = new FormData(); form.set("contentId", contentId || ""); form.set("text", text);
      if (audio) form.set("audio", audio.blob, "voice-note");
      const res = await fetch(`/api/portal/training/${moduleId}/responses`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save your answer");
      setText(""); discardAudio(); setSaved(true); setRevision(value => value + 1);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not send. Your draft is still here."); }
    finally { setSaving(false); }
  }
  return <section className="space-y-4 rounded-xl border border-current/10 p-4">
    <h3 className="font-semibold">{clientId ? "Education Hub answers" : "Your answer for Gordy"}</h3>
    {!clientId && <>
      <textarea aria-label="Your answer for Gordy" rows={4} maxLength={10000} value={text} disabled={saving} onChange={e => { setText(e.target.value); setSaved(false); }} placeholder="Share your thoughts or questions about this lesson…" className="w-full rounded-xl border border-white/10 bg-bg-primary p-3 text-sm" />
      <div className="flex flex-wrap items-center gap-3">
        {voiceReady && <button type="button" disabled={saving} onClick={() => recording ? stopRecording() : void record()} className="rounded-lg border border-current/15 px-3 py-2 text-sm">{recording ? "Stop recording" : "Record voice note"}</button>}
        {!recording && <label className="cursor-pointer text-sm text-accent-bright">Upload voice note<input type="file" accept="audio/*" className="sr-only" disabled={saving} onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 3 * 1024 * 1024) { setError("Choose a voice note under 3MB."); return; } discardAudio(); const url = URL.createObjectURL(file); audioUrl.current=url; setAudio({ blob:file,url }); setSaved(false); e.target.value=""; }} /></label>}
        {recording && <span role="status" className="text-xs text-text-muted">Recording · maximum 3 minutes</span>}
      </div>
      {audio && <div className="space-y-2"><audio controls src={audio.url} className="max-w-full"/><button type="button" disabled={saving} onClick={discardAudio} className="text-xs text-text-muted">Remove recording</button></div>}
      <button type="button" disabled={saving || recording || (!text.trim() && !audio)} onClick={() => void send()} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{saving ? "Saving…" : "Send answer"}</button>
      {saved && <p role="status" className="text-sm text-emerald-400">Saved. Gordy can see your answer in your client profile.</p>}
    </>}
    {error && <p role="alert" className="text-sm text-red-400">{error} <button type="button" className="underline" onClick={() => { setError(""); setRevision(v=>v+1); }}>Reload answers</button></p>}
    {loading ? <p className="text-sm text-text-muted">Loading answers…</p> : !answers.length ? <p className="text-sm text-text-muted">No answers yet.</p> : <div className="space-y-3">{answers.map(answer => <article key={answer.id} className="rounded-lg bg-bg-primary p-3 text-sm"><p className="mb-2 text-xs text-text-muted">{answer.lesson?.title && `${answer.lesson.title} · `}{new Date(answer.created_at).toLocaleString("en-GB")}</p>{answer.reply_text && <p className="whitespace-pre-wrap break-words">{answer.reply_text}</p>}{answer.audio_url && <audio controls preload="none" src={answer.audio_url} className="mt-2 max-w-full"/>}{answer.audio_unavailable && <p>Audio temporarily unavailable. Reload to try again.</p>}</article>)}</div>}
  </section>;
}
