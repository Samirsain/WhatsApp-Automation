import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond } from "next/font/google";
import "./globals.css";

// Brand serif for the wordmark and page titles; body text stays the system font.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-cormorant",
});

export const metadata: Metadata = {
  title: "3% Club — Customer Dashboard",
  description:
    "WhatsApp automation and customer management dashboard for the 3% Club.",
  // iOS: "Add to Home Screen" opens full screen, named like the app.
  appleWebApp: { capable: true, title: "3% Club", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${cormorant.variable}`}>
      {/*
        Extensions (ColorZilla, Grammarly and friends) add attributes to
        <body> before React hydrates, which reads as a mismatch. Suppressing
        covers this element's own attributes only, not anything we render.
      */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
