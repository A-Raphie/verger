import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the Strands SDK out of the bundler: its optional peer imports
  // (@aws-sdk/client-s3 in the context-offloader) resolve at runtime.
  serverExternalPackages: ["@strands-agents/sdk"],
};

export default nextConfig;
