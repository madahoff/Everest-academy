import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["https://admin.academy.pro-everest.com", "http://admin.academy.pro-everest.com"],
  outputFileTracingRoot: path.join(__dirname, "../../"),

  // Important pour monorepo : permet à Next.js de tracer les dépendances
  experimental: {
  },

  // Optimisations
  compress: true,
  poweredByHeader: false,

  // Performance
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
};

export default nextConfig;