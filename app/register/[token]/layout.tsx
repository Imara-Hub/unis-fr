import type { Metadata } from "next";
import type { ReactNode } from "react";

// Shared on WhatsApp: the tab and the link preview read "Registration · Musabaqa".
export const metadata: Metadata = {
  title: "Registration",
  openGraph: { title: "Registration · Musabaqa", siteName: "Musabaqa" },
  robots: { index: false, follow: false },
};

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return children;
}
