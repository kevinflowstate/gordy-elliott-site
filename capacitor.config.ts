import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL;
const serverOrigin = serverUrl ? new URL(serverUrl) : undefined;

const config: CapacitorConfig = {
  // Provisional until the final Apple Developer identifier is registered.
  appId: "com.gordyelliott.shift",
  appName: "SHIFT Coaching",
  webDir: "native-shell",
  backgroundColor: "#0A0A0A",
  loggingBehavior: "debug",
  ios: {
    contentInset: "never",
    preferredContentMode: "mobile",
    allowsLinkPreview: false,
    scheme: "App",
  },
  plugins: {
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
