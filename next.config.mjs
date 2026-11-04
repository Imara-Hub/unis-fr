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
  // The bare address goes straight to the dashboard, answered by the server before any page loads.
  // The dashboard sends visitors who are not logged in to /login (which links to /signup on a new install).
  async redirects() {
    return [{ source: "/", destination: "/dashboard", permanent: false }];
  },
};

export default nextConfig;
