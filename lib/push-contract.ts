export type PushMessage = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
};

export type PushChannelResult = {
  sent: number;
  failed: number;
  reason?: string;
  subscriptionCount: number;
};

export function shouldUseWebPushFallback(native: Pick<PushChannelResult, "sent">): boolean {
  return native.sent === 0;
}
