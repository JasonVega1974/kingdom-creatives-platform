import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Inter, Lora, Source_Sans_3 } from "next/font/google";

import "./globals.css";

/**
 * Fonts the platform can serve, self-hosted by next/font.
 *
 * next/font is build-time, so a church_theme font name cannot be fetched at
 * request time - a church picks from this set and lib/theme.ts maps the stored
 * name to the matching variable (FONT_STACKS). Adding a font means editing both
 * places. Only the two platform defaults preload; the alternates are declared
 * but not preloaded, so a church that does not use them costs nothing.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  display: "swap",
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Kingdom Creatives",
  description: "Church websites a pastor can actually run.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${sourceSans.variable} ${lora.variable} ${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
