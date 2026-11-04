import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

// The stage screen runs on a tablet: no pinch zoom, drawn under the notch / rounded corners,
// and it can be added to the home screen to open full screen like an app.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#151C42",
};

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  return {
    // "Stage · Musabaqa" in the tab, link previews and under the home screen icon.
    title: "Stage",
    openGraph: { title: "Stage · Musabaqa", siteName: "Musabaqa" },
    // Its own install file: the home screen icon opens this exact stage screen, full screen.
    manifest: `/stage-screen/${encodeURIComponent(token)}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: "Stage · Musabaqa", statusBarStyle: "black-translucent" },
    robots: { index: false, follow: false },
  };
}

export default function StageScreenLayout({ children }: { children: ReactNode }) {
  return children;
}
