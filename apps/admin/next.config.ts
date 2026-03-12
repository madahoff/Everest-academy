import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["https://admin.academy.pro-everest.com", "http://admin.academy.pro-everest.com"],
  outputFileTracingRoot: path.join(__dirname, "../../"),

  // Ignore lint/type errors during Docker build
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // SMTP variables are read at runtime via process.env in API routes
  // Do NOT use the `env` section here — it inlines values at BUILD time,
  // which means they'd be empty in Docker builds.

  // Important pour monorepo : permet à Next.js de tracer les dépendances
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  experimental: {
  },

  // Optimisations
  compress: true,
  poweredByHeader: false,

  // Keep console logs visible in production for debugging
  compiler: {
  },
};

export default nextConfig;