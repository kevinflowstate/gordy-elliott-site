import type { Metadata, Viewport } from "next";
import { Inter, Barlow_Condensed } from "next/font/google";
import Script from "next/script";
import { getSiteUrl } from "@/lib/site-url";
import NativeAppBridge from "@/components/native/NativeAppBridge";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SHIFT Coaching | Gordy Elliott",
    template: "%s | SHIFT Coaching",
  },
  description: "Online fitness coaching by Gordy Elliott. Transform your training, nutrition, and mindset with SHIFT Coaching.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SHIFT Portal",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: siteUrl,
    siteName: "SHIFT Coaching",
    title: "SHIFT Coaching | Gordy Elliott",
    description: "Online fitness coaching by Gordy Elliott. Transform your training, nutrition, and mindset with SHIFT Coaching.",
    images: [
      {
        url: "/images/shift-logo.svg",
        width: 800,
        height: 900,
        alt: "SHIFT Coaching by Gordy Elliott",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SHIFT Coaching | Gordy Elliott",
    description: "Online fitness coaching by Gordy Elliott. Transform your training, nutrition, and mindset with SHIFT Coaching.",
    images: ["/images/shift-logo.svg"],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: siteUrl,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB" data-scroll-behavior="smooth">
      <head>
        <link rel="apple-touch-icon" href="/shift-apple-touch-icon.png" />
      </head>
      <body className={`${inter.variable} ${barlowCondensed.variable} antialiased`}>
        <NativeAppBridge />
        {children}
        <Script
          id="pwa-registration"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `var isNative=window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform();var isLocal=/^(localhost|127\\.0\\.0\\.1|\\[::1\\])$/.test(window.location.hostname);if(!isNative&&!isLocal&&'serviceWorker' in navigator){var registerServiceWorker=function(){navigator.serviceWorker.register('/sw.js').then(function(reg){reg.update();reg.addEventListener('updatefound',function(){var worker=reg.installing;if(!worker)return;worker.addEventListener('statechange',function(){if(worker.state==='installed'&&navigator.serviceWorker.controller){worker.postMessage({type:'SKIP_WAITING'});}});});});var refreshing=false;navigator.serviceWorker.addEventListener('controllerchange',function(){if(refreshing)return;refreshing=true;window.location.reload();});};if(document.readyState==='complete'){registerServiceWorker();}else{window.addEventListener('load',registerServiceWorker,{once:true});}}window.__pwaInstallPrompt=null;if(!isNative){window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__pwaInstallPrompt=e});}`,
          }}
        />
      </body>
    </html>
  );
}
