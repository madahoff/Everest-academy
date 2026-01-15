import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),

  // Important pour monorepo
  experimental: {
  },

  // Optimisations
  compress: true,
  poweredByHeader: false,

  // Performance
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "everest.madahoff.com",
      },
    ],
  },
};

export default nextConfig;