"use client";

import Link from "next/link";
import CyclingStatusText from "@/components/ui/CyclingStatusText";
import type { WearableConnection } from "@/lib/wearable-insights";

export type WearableProvider = {
  id: string;
  name: string;
  description: string;
  mark: string;
  markClass: string;
  disabled?: boolean;
};

export const wearableProviders: WearableProvider[] = [
  {
    id: "garmin",
    name: "Garmin",
    description: "Training load, workouts, steps, heart rate and sleep.",
    mark: "G",
    markClass: "bg-[#0b2232] text-[#66c8ff]",
  },
  {
    id: "oura",
    name: "Oura",
    description: "Sleep, recovery, HRV and resting heart rate.",
    mark: "Ō",
    markClass: "bg-[#26242a] text-white",
  },
  {
    id: "myfitnesspal",
    name: "MyFitnessPal",
    description: "Calories, protein, carbohydrates, fats and hydration.",
    mark: "M",
    markClass: "bg-[#112a46] text-[#6ab8ff]",
  },
  {
    id: "fitbit",
    name: "Fitbit",
    description: "Daily activity, sleep and heart-rate data.",
    mark: "F",
    markClass: "bg-[#0e2b2d] text-[#55d7d0]",
  },
  {
    id: "whoop",
    name: "WHOOP and Strava",
    description: "Available after provider credentials and final account-level testing.",
    mark: "W",
    markClass: "bg-[#f5f5f5] text-black",
    disabled: true,
  },
  {
    id: "apple_health",
    name: "Apple Health",
    description: "Planned for the native HealthKit phase after the first App Store release.",
    mark: "A",
    markClass: "bg-[#2c2225] text-[#ff8694]",
    disabled: true,
  },
];

export default function WearableConnectionsPanel({
  connections,
  consentAccepted,
  available,
  mockMode,
  connecting,
  disconnecting,
  onConsentChange,
  onConnect,
  onDisconnect,
  onBack,
}: {
  connections: WearableConnection[];
  consentAccepted: boolean;
  available: boolean;
  mockMode: boolean;
  connecting: string | null;
  disconnecting: string | null;
  onConsentChange: (accepted: boolean) => void;
  onConnect: (provider: string) => void;
  onDisconnect: (connection: WearableConnection) => void;
  onBack: () => void;
}) {
  const connectionByProvider = new Map<string, WearableConnection>();
  for (const connection of connections) connectionByProvider.set(connection.provider, connection);
  const activeProviders = wearableProviders.filter((provider) => !provider.disabled);
  const laterProviders = wearableProviders.filter((provider) => provider.disabled);
  const connectedConnections = connections.filter((connection) => connection.status === "connected");
  const connectedProviderDetails = connectedConnections
    .map((connection) => wearableProviders.find((provider) => provider.id === connection.provider))
    .filter((provider): provider is WearableProvider => Boolean(provider));
  const mostRecentSync = connectedConnections
    .map((connection) => connection.last_sync_at)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0];

  return (
    <div className="mx-auto w-full max-w-5xl pb-28 sm:pb-8">
      <header className="flex items-start gap-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Health and Capacity"
          className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.035] text-white/65 transition hover:bg-white/[0.07]"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ef68db]">Health data</div>
          <h1 className="mt-1 font-heading text-[2.1rem] font-bold leading-none tracking-[-0.02em] text-white sm:text-[2.6rem]">Connections</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/52">
            Choose the services that can contribute to your recovery, activity and nutrition picture.
          </p>
        </div>
      </header>

      <div className="mt-7 flex items-center justify-between gap-4 border-y border-white/[0.07] py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${connectedConnections.length ? "border-[#58d6b0]/25 bg-[#58d6b0]/[0.08] text-[#58d6b0]" : "border-white/10 bg-white/[0.035] text-white/35"}`}>
            <span className={`h-2 w-2 rounded-full ${connectedConnections.length ? "bg-[#58d6b0] shadow-[0_0_12px_rgba(88,214,176,0.75)]" : "bg-white/25"}`} />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.17em] text-white/32">Data flow</div>
            <div className="mt-0.5 truncate text-sm font-semibold text-white/82">
              {connectedConnections.length ? `${connectedConnections.length} service${connectedConnections.length === 1 ? "" : "s"} connected` : "No services connected"}
            </div>
            {mostRecentSync && <div className="mt-0.5 text-[10px] text-white/30">Latest signal {formatDate(mostRecentSync)}</div>}
          </div>
        </div>
        {connectedProviderDetails.length > 0 && (
          <div className="flex shrink-0 -space-x-2" aria-label={`${connectedProviderDetails.length} connected health services`}>
            {connectedProviderDetails.map((provider) => (
              <div
                key={provider.id}
                title={provider.name}
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#0a090c] text-sm font-bold shadow-lg ${provider.markClass}`}
              >
                {provider.mark}
              </div>
            ))}
          </div>
        )}
      </div>

      {mockMode && (
        <div className="mt-6 rounded-[20px] border border-amber-400/15 bg-amber-400/[0.07] px-4 py-3 text-sm text-amber-200/85">
          Preview mode is active. Connections created here use demonstration data.
        </div>
      )}
      {!available && (
        <div className="mt-6 rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/55">
          New health app connections are temporarily unavailable.
        </div>
      )}

      {!consentAccepted && (
        <section className="mt-6 overflow-hidden rounded-[26px] border border-[#e440d0]/20 bg-[#e440d0]/[0.055]">
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e440d0]/12 text-[#ef68db]">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-white">Your permission comes first</h2>
                <p className="mt-1 text-sm leading-6 text-white/52">
                  Terra securely passes the health categories you approve to AT CAPACITY. Gordy uses them for coaching context;
                  they never change your programme automatically.
                </p>
              </div>
            </div>
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[18px] border border-white/[0.08] bg-black/15 p-4">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(event) => onConsentChange(event.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[#e440d0]"
              />
              <span className="text-sm font-medium leading-6 text-white/76">
                I consent to AT CAPACITY receiving health data from the service I choose. I have read the{" "}
                <Link href="/privacy" className="text-[#ef68db] underline underline-offset-2">Privacy Notice</Link>
                {" "}and{" "}
                <a
                  href="https://tryterra.co/end-user-privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#ef68db] underline underline-offset-2"
                >
                  Terra Privacy Policy
                </a>.
              </span>
            </label>
          </div>
        </section>
      )}

      <section className="mt-7">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">Available now</div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Your health services</h2>
          </div>
          <div className="hidden text-xs text-white/35 sm:block">
            {connectedConnections.length} connected
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#151419]">
          {activeProviders.map((provider, index) => {
            const connection = connectionByProvider.get(provider.id);
            return (
              <ProviderRow
                key={provider.id}
                provider={provider}
                connection={connection}
                consentAccepted={consentAccepted}
                available={available}
                connecting={connecting}
                disconnecting={disconnecting}
                divider={index > 0}
                onConnect={onConnect}
                onDisconnect={onDisconnect}
              />
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">On the roadmap</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {laterProviders.map((provider) => (
            <div key={provider.id} className="flex min-h-[88px] items-center gap-3 rounded-[22px] border border-white/[0.06] bg-white/[0.025] p-4 opacity-65">
              <ProviderMark provider={provider} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm font-semibold text-white">{provider.name}</div>
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white/35">
                    Later
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/38">{provider.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-8 text-center text-xs leading-5 text-white/30">
        Disconnecting stops new information being received. Existing coaching summaries remain under the retention terms in the Privacy Notice.
      </p>
    </div>
  );
}

function ProviderRow({
  provider,
  connection,
  consentAccepted,
  available,
  connecting,
  disconnecting,
  divider,
  onConnect,
  onDisconnect,
}: {
  provider: WearableProvider;
  connection?: WearableConnection;
  consentAccepted: boolean;
  available: boolean;
  connecting: string | null;
  disconnecting: string | null;
  divider: boolean;
  onConnect: (provider: string) => void;
  onDisconnect: (connection: WearableConnection) => void;
}) {
  const connected = connection?.status === "connected";
  const pending = connection?.status === "pending";
  const errored = connection?.status === "error";
  return (
    <article className={`flex flex-col gap-4 p-4 transition hover:bg-white/[0.018] sm:flex-row sm:items-center sm:p-5 ${divider ? "border-t border-white/[0.065]" : ""}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <ProviderMark provider={provider} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold text-white">{provider.name}</h3>
            <ConnectionState status={connection?.status} />
          </div>
          <p className="mt-1 text-xs leading-5 text-white/43 sm:text-sm">{provider.description}</p>
          {connection && (
            <p className="mt-1.5 text-[11px] text-white/28">
              {connected ? `Last received ${formatDate(connection.last_sync_at)}` : errored ? "Connection needs attention" : pending ? "Finishing connection…" : "Not connected"}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end">
        {connected ? (
          <button
            type="button"
            onClick={() => onDisconnect(connection)}
            disabled={disconnecting === connection.id}
            className="min-h-10 rounded-full border border-white/10 px-4 text-xs font-semibold text-white/48 transition hover:border-red-400/30 hover:text-red-300 disabled:opacity-45"
          >
            <CyclingStatusText
              active={disconnecting === connection.id}
              idle="Disconnect"
              messages={["Disconnecting…", "Updating…", "Nearly there…"]}
            />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onConnect(provider.id)}
            disabled={!consentAccepted || !available || connecting === provider.id}
            className="min-h-10 min-w-[100px] rounded-full bg-[#f7f4f7] px-4 text-xs font-bold text-[#171419] transition hover:bg-[#ffffff] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/25"
          >
            <CyclingStatusText
              active={connecting === provider.id}
              idle={errored ? "Reconnect" : "Connect"}
              messages={["Starting…", "Creating session…", "Opening Terra…", "Nearly there…"]}
            />
          </button>
        )}
      </div>
    </article>
  );
}

function ProviderMark({ provider }: { provider: WearableProvider }) {
  return (
    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] text-lg font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${provider.markClass}`}>
      {provider.mark}
    </div>
  );
}

function ConnectionState({ status }: { status?: WearableConnection["status"] }) {
  const appearance = status === "connected"
    ? "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300"
    : status === "pending"
      ? "border-amber-300/20 bg-amber-300/[0.08] text-amber-200"
      : status === "error"
        ? "border-red-400/20 bg-red-400/[0.08] text-red-300"
        : "border-white/10 bg-white/[0.025] text-white/30";
  const label = status === "connected" ? "Connected" : status === "pending" ? "Pending" : status === "error" ? "Attention" : "Not connected";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${appearance}`}>
      {label}
    </span>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
