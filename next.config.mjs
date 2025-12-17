// next.config.ts
// import type { NextConfig } from "next";

const nextConfig = {
  // 1. IGNORE TYPESCRIPT ERRORS DURING BUILD
  typescript: {
    ignoreBuildErrors: true,
  },
  // 2. IGNORE ESLINT ERRORS DURING BUILD
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 3. SERVER ACTIONS CONFIG
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.yelpcdn.com",
      },
      {
        protocol: "https",
        hostname: "www.yelp.com",
      },
      {
        protocol: "https",
        hostname: "s3-media*.fl.yelpcdn.com", // Captures s3-media1, s3-media2, etc.
      },
      {
        protocol: "https",
        hostname: "s3-media*.fl.yelpcdn.com",
      },
    ],
  },
};

export default nextConfig;


