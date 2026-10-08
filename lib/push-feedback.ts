import type { PushChannelResult } from "./push-contract";

export type PushFeedbackResult = Partial<PushChannelResult> & {
  suppressed?: boolean;
  channels?: { web: PushChannelResult; native: PushChannelResult };
};

/** Provider acceptance is not confirmation that a person saw an alert. */
export function pushFeedback(result?: PushFeedbackResult): string {
  if (!result) return "device push result unavailable";
  if (result.suppressed) return "notifications paused for this client";
  if (result.channels) {
    const details = ([['Native app', result.channels.native], ['Browser', result.channels.web]] as const)
      .filter(([, channel]) => !channel.reason?.startsWith("Skipped because native push"))
      .map(([name, channel]) => {
        if (channel.sent > 0) return `${name}: provider accepted ${channel.sent}${channel.failed ? `; ${channel.failed} failed` : ""}`;
        if (channel.failed > 0) return `${name}: ${channel.failed} failed${channel.reason ? ` (${channel.reason})` : ""}`;
        if (channel.subscriptionCount > 0) return `${name}: ${channel.subscriptionCount} registered; none accepted${channel.reason ? ` (${channel.reason})` : ""}`;
        return `${name}: no registered device${channel.reason ? ` (${channel.reason})` : ""}`;
      });
    return details.join(". ");
  }
  if ((result.sent || 0) > 0) return `push provider accepted ${result.sent}${result.failed ? `; ${result.failed} failed` : ""}`;
  if (result.reason) return `no push accepted (${result.reason})`;
  return `no push accepted (${result.subscriptionCount ?? 0} registered devices)`;
}
