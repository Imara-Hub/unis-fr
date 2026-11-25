import { networkInterfaces } from "node:os";

// This computer's own network addresses (e.g. 172.20.10.3), so phones on the same
// network can open the dev server. Development only; ignored by `next build`.
const ownAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a.address);

// This build's version: the commit when the host gives it (Vercel, Render), else the build time.
// Baked into the app; /version.json answers with the live one, and an open page that is older
// offers "Update" (components/UpdateBanner.tsx).
const APP_VERSION = process.env.VERCEL_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || process.env.APP_VERSION || new Date().toISOString();

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { APP_VERSION },
  allowedDevOrigins: ownAddresses,
  experimental: {
    agentFeedback: true,
    // Only bundle the Chakra components we actually use.
    optimizePackageImports: ["@chakra-ui/react"],
  },
  // No cacheComponents / partialPrefetching: every page checks the login in the browser, so they
  // gave nothing here, and the <Activity> wrapper they add froze the tab on reload ("Page
  // Unresponsive") whenever React found a hydration mismatch inside it.
  // The bare address is answered in proxy.ts: /login for the organization, /results for everyone
  // else (a redirect here would run before the proxy and cost strangers a second hop).
  // Basic hardening on every page: no framing by other sites (clickjacking on the judging desk),
  // no MIME sniffing, no full URLs (registration and stage-screen tokens) leaked to other sites,
  // and no camera/mic/location. Screen wake lock stays allowed for the stage screen.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
      // The service worker must never be served stale: a new deploy must reach every tablet.
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
