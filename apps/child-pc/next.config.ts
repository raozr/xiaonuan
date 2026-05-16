import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  assetPrefix: '/child',
};

export default nextConfig;
