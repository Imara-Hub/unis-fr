import type { Metadata, Viewport } from "next";
import { Amiri, Lateef, Source_Sans_3, Source_Serif_4 } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "./providers";

// Fonts are downloaded at build time and served from our own site (no Google request in the browser).
// Adobe's Source pair, drawn to go together: Source Sans 3 for all text (clear on phones and
// tablets, full French accents), Source Serif 4 for titles and big scores, a printed, formal touch.
// The display copy only has the semibold weight, so text written with fontFamily="display" is
// semibold wherever it is.
const body = Source_Sans_3({ subsets: ["latin", "latin-ext"], variable: "--font-body", display: "swap" });
const display = Source_Serif_4({ subsets: ["latin", "latin-ext"], weight: "600", variable: "--font-display", display: "swap" });
// Lateef for every Arabic text in the app (mark names, surah names, labels…).
const arabic = Lateef({ subsets: ["arabic"], weight: ["400", "700"], variable: "--font-arabic", display: "swap" });
// Amiri stays only for the Bismillah (the ﷽ ligature on the login card, the mushaf, the stage envelope).
const bismillah = Amiri({ subsets: ["arabic"], weight: ["400", "700"], variable: "--font-bismillah", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Musabaqa", template: "%s · Musabaqa" },
  description: "Registration and results of the Quran competition in Burundi.",
};

export const viewport: Viewport = { themeColor: "#1A234E" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // Chakra adds attributes on the client, so React must not warn about the mismatch.
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${arabic.variable} ${bismillah.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
