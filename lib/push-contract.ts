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
