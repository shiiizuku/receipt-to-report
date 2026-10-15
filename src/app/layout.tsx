import type { Metadata } from "next";
import localFont from "next/font/local";
import { BOOT_SCRIPT, themeCss } from "@/lib/themes";
import "./globals.css";

const display = localFont({
  src: "./fonts/newsreader-variable.woff2",
  variable: "--font-display",
  weight: "200 800",
  display: "swap",
});
const sans = localFont({
  src: "./fonts/public-sans-variable.woff2",
  variable: "--font-sans",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Receipt-to-Report", template: "%s · Receipt-to-Report" },
  description: "Official receipts, deposits and collection reports for Mines and Geosciences Bureau Region III.",
  icons: { icon: "/branding/mgb-logo-160.png", apple: "/branding/mgb-logo-160.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The boot script sets data-theme, data-mode and data-sidebar before first paint, so React
    // must not treat those attributes as a mismatch.
    <html lang="en" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
