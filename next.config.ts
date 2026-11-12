import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Face models are large static assets under /public/models
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  webpack: (config) => {
    // face-api.js pulls node-friendly fs stubs; keep client bundles lean
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      encoding: false,
    };
    return config;
  },
};

export default nextConfig;
