import type { CapacitorConfig } from "@capacitor/cli";
import appIdentity from "./config/app-identity.json";

const serverUrl = process.env.CAPACITOR_SERVER_URL;
const serverOrigin = serverUrl ? new URL(serverUrl) : undefined;
const apnsEnvironment = process.env.CAPACITOR_APNS_ENVIRONMENT === "sandbox" ? "sandbox" : "production";

const config: CapacitorConfig = {
  // Registered App ID in the Apple Developer account.
  appId: appIdentity.bundleId,
  appName: appIdentity.appName,
  webDir: "native-shell",
  backgroundColor: "#0A0A0A",
  loggingBehavior: "debug",
  appendUserAgent: `SHIFT-APNS/${apnsEnvironment}`,
  ios: {
    contentInset: "never",
    preferredContentMode: "mobile",
    allowsLinkPreview: false,
    scheme: "App",
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "banner", "list"],
    },
    StatusBar: {
      overlaysWebView: false,
      // Capacitor names this from the background theme: DARK renders light system text.
      style: "DARK",
      backgroundColor: "#0A0A0A",
    },
  },
  server: serverOrigin
    ? {
        url: new URL("/portal", serverOrigin).href,
        allowNavigation: [serverOrigin.hostname],
        errorPath: "offline.html",
      }
    : {
        appStartPath: "/index.html",
        errorPath: "offline.html",
      },
};

export default config;
