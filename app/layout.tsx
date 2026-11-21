import type { Metadata, Viewport } from "next";
import { Inter, Nunito } from "next/font/google";
import "./globals.css";
import { ConsentProvider } from "@/components/providers/ConsentProvider";
import { ThemeProvider, themeInitScript } from "@/components/providers/ThemeProvider";
import { DriveProvider } from "@/components/providers/DriveProvider";
import { CookieConsent } from "@/components/CookieConsent";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], display: "swap", weight: ["600", "700", "800"] });

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Filomina";

export const metadata: Metadata = {
  title: { default: `${appName} · AI photo finder`, template: `%s · ${appName}` },
  description: "Find yourself, or anyone, in the photos of a shared Google Drive folder.",
  applicationName: appName,
  appleWebApp: { capable: true, statusBarStyle: "default", title: appName },
  manifest: "/manifest.webmanifest",
  openGraph: { title: `${appName} · AI photo finder`, description: "Selfie in, your photos out. Face search for shared Google Drive folders.", images: ["/brand/og.png"], type: "website" },
  twitter: { card: "summary_large_image", images: ["/brand/og.png"] },
};

export const viewport: Viewport = {
  themeColor: "#f6f7fc",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${nunito.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-ink">
        <ThemeProvider>
          <ConsentProvider>
            <DriveProvider>
              {children}
              <CookieConsent />
            </DriveProvider>
          </ConsentProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
