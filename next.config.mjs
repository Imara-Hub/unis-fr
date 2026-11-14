import { networkInterfaces } from "node:os";

// This computer's own network addresses (e.g. 172.20.10.3), so phones on the same
// network can open the dev server. Development only; ignored by `next build`.
const ownAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a.address);

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ownAddresses,
  experimental: {
    agentFeedback: true,
    // Only bundle the Chakra components we actually use.
    optimizePackageImports: ["@chakra-ui/react"],
  },
  // No cacheComponents / partialPrefetching: every page checks the login in the browser, so they
  // gave nothing here, and the <Activity> wrapper they add froze the tab on reload ("Page
  // Unresponsive") whenever React found a hydration mismatch inside it.
  // The bare address opens the login page, answered by the server before any page loads. The login
  // page sends someone already logged in on to /dashboard, and opens /signup on a new install.
  async redirects() {
    return [{ source: "/", destination: "/login", permanent: false }];
  },
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
    ];
  },
};

export default nextConfig;
