import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["https://admin.academy.pro-everest.com", "http://admin.academy.pro-everest.com"],
  outputFileTracingRoot: path.join(__dirname, "../../"),

  // Expose les variables SMTP côté serveur
  env: {
    SMTP_HOST: process.env.SMTP_HOST ?? "smtp.hostinger.com",
    SMTP_PORT: process.env.SMTP_PORT ?? "465",
    SMTP_SECURE: process.env.SMTP_SECURE ?? "true",
    SMTP_USER: process.env.SMTP_USER ?? "contact@pro-everest.com",
    SMTP_PASSWORD: process.env.SMTP_PASSWORD ?? "",
    SMTP_FROM: process.env.SMTP_FROM ?? "Everest Academy <contact@pro-everest.com>",
  },

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