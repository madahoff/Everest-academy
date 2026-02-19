import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["https://academy.pro-everest.com", "http://academy.pro-everest.com"],
  outputFileTracingRoot: path.join(__dirname, "../../"),

  // Important pour monorepo
  experimental: {
    serverActions: {
      allowedOrigins: ["academy.pro-everest.com", "localhost:3000"],
    },
  },

  // Optimisations
  compress: true,
  poweredByHeader: false,

  // Performance - Garder console.error et console.warn visibles en production
  compiler: {
    removeConsole: process.env.NODE_ENV === "production"
      ? { exclude: ["error", "warn"] }
      : false,
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