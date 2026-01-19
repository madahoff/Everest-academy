import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["https://academy.pro-everest.com", "http://academy.pro-everest.com"],
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
        hostname: "academy.pro-everest.com",
      },
    ],
  },
};

export default nextConfig;