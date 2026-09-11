import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the Strands SDK out of the bundler: its optional peer imports
  // (@aws-sdk/client-s3 in the context-offloader) resolve at runtime.
  serverExternalPackages: ["@strands-agents/sdk"],
  async headers() {
    return [
      {
        // Status chrome must never lie: HTML and state responses are live
        // views, never cacheable. Static assets are hash-named elsewhere.
        source: "/",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      {
        source: "/desk",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
