import type { Metadata, Viewport } from "next";
import { Amiri, Open_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "./providers";

// Fonts are downloaded at build time and served from our own site (no Google request in the browser).
// One family, Open Sans, for text and numbers. The "display" copy only has the semibold
// weight, so titles and big numbers written with fontFamily="display" are semibold wherever they are.
const body = Open_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Open_Sans({ subsets: ["latin"], weight: "600", variable: "--font-display", display: "swap" });
const arabic = Amiri({ subsets: ["arabic"], weight: ["400", "700"], variable: "--font-arabic", display: "swap" });

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
      className={`${display.variable} ${body.variable} ${arabic.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
