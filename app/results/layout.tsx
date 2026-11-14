import type { Metadata } from "next";
import type { ReactNode } from "react";

// Shared on WhatsApp: the tab and the link preview read "Results · Musabaqa".
export const metadata: Metadata = {
  title: "Results",
  openGraph: { title: "Results · Musabaqa", siteName: "Musabaqa" },
  robots: { index: false, follow: false },
};

export default function ResultsLayout({ children }: { children: ReactNode }) {
  return children;
}
