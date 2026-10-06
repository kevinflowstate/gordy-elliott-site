import { existsSync, readFileSync } from "node:fs";
import appIdentity from "../config/app-identity.json" with { type: "json" };

export function validateGoogleServices(config) {
  const client = config?.client?.find((entry) =>
    entry.client_info?.android_client_info?.package_name === appIdentity.bundleId);
  return Boolean(config?.project_info?.project_id && config?.project_info?.project_number &&
    client?.client_info?.mobilesdk_app_id && client?.api_key?.some((key) => key.current_key));
}

const servicesPath = process.env.ANDROID_GOOGLE_SERVICES_FILE || "android/app/google-services.json";
if (!existsSync(servicesPath)) {
  console.error("Release blocked: obtain Gordy's Firebase Android google-services.json. Debug builds can compile without push.");
  process.exit(2);
}
let services;
try { services = JSON.parse(readFileSync(servicesPath, "utf8")); } catch {
  console.error("Release blocked: google-services.json is not valid JSON.");
  process.exit(2);
}
if (!validateGoogleServices(services)) {
  console.error(`Release blocked: Firebase configuration must contain Android package ${appIdentity.bundleId}.`);
  process.exit(2);
}
if (!process.env.ANDROID_KEYSTORE_FILE || !existsSync(process.env.ANDROID_KEYSTORE_FILE) ||
    !process.env.ANDROID_KEYSTORE_PASSWORD || !process.env.ANDROID_KEY_ALIAS || !process.env.ANDROID_KEY_PASSWORD) {
  console.error("Release blocked: configure the private upload keystore and signing environment.");
  process.exit(2);
}
console.log(`Android release preflight passed for ${appIdentity.bundleId}. Live FCM, server migration and device QA remain separate release checks.`);
