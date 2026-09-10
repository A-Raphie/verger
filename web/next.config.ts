import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Railway runs the standalone server alongside the agent in one container.
  output: "standalone",
};

export default nextConfig;
