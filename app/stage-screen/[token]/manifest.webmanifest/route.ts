// The stage screen's install file. "Add to Home screen" on the tablet then gives an icon that
// opens this stage screen full screen, without the browser bars. The token stays in it because the
// stage screen only works with its secret link; whoever gets this file already had the link.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const start = `/stage-screen/${encodeURIComponent(token)}`;
  const manifest = {
    name: "Stage · Musabaqa",
    short_name: "Stage",
    description: "The stage screen where participants choose their envelope.",
    id: start,
    start_url: start,
    scope: start,
    display: "fullscreen",
    display_override: ["fullscreen", "standalone"],
    orientation: "any",
    background_color: "#151C42",
    theme_color: "#151C42",
    icons: [
      { src: "/icon.png", sizes: "256x256", type: "image/png" },
      { src: "/logo.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      // Replaced links must not linger in caches.
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
}
