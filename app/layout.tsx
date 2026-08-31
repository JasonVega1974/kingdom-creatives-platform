import type { Metadata } from "next";
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";

/**
 * Fonts the platform serves, self-hosted by next/font.
 *
 * ONE TYPEFACE, PLATFORM-WIDE: Plus Jakarta Sans for both headings and body,
 * across the public site and the portal. It replaced a Fraunces/Source Sans 3
 * pairing on 2026-08-31.
 *
 * PLUS JAKARTA SANS IS A VARIABLE FONT, so `weight` is deliberately omitted
 * rather than listing 400-800. Omitting it ships the whole 200-800 axis in one
 * file - a superset of the five weights we need, and smaller than five static
 * cuts would be. Any font-weight between 200 and 800 now renders exactly,
 * including the 700 headings and 500/600 UI text.
 *
 * IBM Plex Mono stays. It is the utility face - eyebrows, the hero logbook,
 * mile markers, the sermon meta line - and those rely on monospace figures to
 * line up in columns. Replacing it with a proportional font would break that
 * alignment, and it is not a serif, so it is not what this change was about.
 */
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
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
      className={`${jakarta.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
