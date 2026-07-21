import "server-only";

import { connect, constants, type ClientHttp2Session } from "node:http2";
import { createPrivateKey, sign } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PushChannelResult, PushMessage } from "@/lib/push-contract";
import {
  createApnsPayload,
  NATIVE_PUSH_APP_ID,
  type NativePushEnvironment,
} from "@/lib/native-push-contract";

type NativeDevice = {
  id: string;
  token: string;
  environment: NativePushEnvironment;
  failure_count: number;
};

type ApnsConfig = {
  keyId: string;
  teamId: string;
  privateKey: string;
  topic: string;
};

let cachedProviderToken: { value: string; createdAt: number; cacheKey: string } | null = null;
const APNS_REQUEST_TIMEOUT_MS = 10_000;
const APNS_RESPONSE_LIMIT = 2_048;

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function loadApnsConfig(): ApnsConfig | null {
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const topic = process.env.APNS_BUNDLE_ID?.trim() || NATIVE_PUSH_APP_ID;
  if (!keyId || !teamId || !privateKey) return null;
  return { keyId, teamId, privateKey, topic };
}

function providerToken(config: ApnsConfig) {
  const now = Math.floor(Date.now() / 1000);
  const cacheKey = `${config.teamId}:${config.keyId}`;
  if (cachedProviderToken && cachedProviderToken.cacheKey === cacheKey && now - cachedProviderToken.createdAt < 50 * 60) {
    return cachedProviderToken.value;
  }

  const header = base64Url(JSON.stringify({ alg: "ES256", kid: config.keyId }));
  const claims = base64Url(JSON.stringify({ iss: config.teamId, iat: now }));
  const unsignedToken = `${header}.${claims}`;
  const signature = sign("sha256", Buffer.from(unsignedToken), {
    key: createPrivateKey(config.privateKey),
    dsaEncoding: "ieee-p1363",
  });
  const value = `${unsignedToken}.${base64Url(signature)}`;
  cachedProviderToken = { value, createdAt: now, cacheKey };
  return value;
}

function endpointFor(environment: NativePushEnvironment) {
  return environment === "sandbox"
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com";
}

async function deliverToDevice(
  client: ClientHttp2Session,
  device: NativeDevice,
  message: PushMessage,
  config: ApnsConfig,
) {
  const payload = JSON.stringify(createApnsPayload(message));

  return new Promise<{ ok: boolean; status: number; reason?: string }>((resolve, reject) => {
    const request = client.request({
      ":method": "POST",
      ":path": `/3/device/${device.token}`,
      authorization: `bearer ${providerToken(config)}`,
      "apns-topic": config.topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-expiration": "0",
      ...(message.tag ? { "apns-collapse-id": message.tag.slice(0, 64) } : {}),
    });

    let status = 0;
    let responseBody = "";
    let finished = false;
    const finish = (callback: () => void) => {
      if (finished) return;
      finished = true;
      request.setTimeout(0);
      callback();
    };

    request.setEncoding("utf8");
    request.setTimeout(APNS_REQUEST_TIMEOUT_MS, () => {
      request.close(constants.NGHTTP2_CANCEL);
      finish(() => reject(new Error("APNs request timed out")));
    });
    request.on("response", (headers) => {
      status = Number(headers[":status"] || 0);
    });
    request.on("data", (chunk: string) => {
      if (responseBody.length < APNS_RESPONSE_LIMIT) {
        responseBody += chunk.slice(0, APNS_RESPONSE_LIMIT - responseBody.length);
      }
    });
    request.on("end", () => {
      let reason;
      try {
        reason = responseBody ? JSON.parse(responseBody).reason : undefined;
      } catch {
        reason = responseBody.slice(0, 160) || undefined;
      }
      finish(() => resolve({ ok: status === 200, status, reason }));
    });
    request.on("error", (error) => finish(() => reject(error)));
    request.end(payload);
  });
}

async function deliverToEnvironment(
  environment: NativePushEnvironment,
  devices: NativeDevice[],
  message: PushMessage,
  config: ApnsConfig,
) {
  const client = connect(endpointFor(environment));
  client.on("error", () => {
    // Active streams receive their own errors; this prevents an unhandled session error.
  });

  try {
    return await Promise.all(
      devices.map(async (device) => {
        try {
          return { device, delivery: await deliverToDevice(client, device, message, config) };
        } catch (deliveryError) {
          return {
            device,
            delivery: {
              ok: false,
              status: 0,
              reason: deliveryError instanceof Error ? deliveryError.message : "APNs request failed",
            },
          };
        }
      }),
    );
  } finally {
    client.close();
  }
}

export async function sendNativePushToUser(userId: string, message: PushMessage): Promise<PushChannelResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("native_push_devices")
    .select("id, token, environment, failure_count")
    .eq("user_id", userId)
    .eq("app_id", NATIVE_PUSH_APP_ID)
    .is("disabled_at", null);

  if (error) return { sent: 0, failed: 0, subscriptionCount: 0, reason: error.message };

  const devices = (data || []) as NativeDevice[];
  if (devices.length === 0) {
    return { sent: 0, failed: 0, subscriptionCount: 0, reason: "No native notification device is registered." };
  }

  const config = loadApnsConfig();
  if (!config) {
    return {
      sent: 0,
      failed: 0,
      subscriptionCount: devices.length,
      reason: "APNs credentials are not configured in this environment.",
    };
  }

  const grouped = devices.reduce<Map<NativePushEnvironment, NativeDevice[]>>((groups, device) => {
    const group = groups.get(device.environment) || [];
    group.push(device);
    groups.set(device.environment, group);
    return groups;
  }, new Map());
  const settled = (await Promise.all(
    [...grouped.entries()].map(([environment, environmentDevices]) =>
      deliverToEnvironment(environment, environmentDevices, message, config),
    ),
  )).flat();

  await Promise.all(
    settled.map(({ device, delivery }) => {
      if (delivery.ok) {
        if (device.failure_count === 0) return Promise.resolve();
        return admin
          .from("native_push_devices")
          .update({ failure_count: 0, last_failure: null, updated_at: new Date().toISOString() })
          .eq("id", device.id);
      }

      const disableReasons = new Set(["BadDeviceToken", "DeviceTokenNotForTopic", "Unregistered"]);
      const shouldDisable = delivery.status === 410 || (delivery.reason ? disableReasons.has(delivery.reason) : false);
      return admin
        .from("native_push_devices")
        .update({
          failure_count: device.failure_count + 1,
          last_failure: delivery.reason || `APNs status ${delivery.status || "unavailable"}`,
          disabled_at: shouldDisable ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", device.id);
    }),
  );

  const reasons = [...new Set(settled.flatMap(({ delivery }) => (delivery.ok ? [] : [delivery.reason || `APNs ${delivery.status}`])))];
  return {
    sent: settled.filter(({ delivery }) => delivery.ok).length,
    failed: settled.filter(({ delivery }) => !delivery.ok).length,
    subscriptionCount: devices.length,
    reason: reasons.length ? reasons.join("; ") : undefined,
  };
}
