import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep dev artifacts separate from production build output.
  // This avoids Turbopack cache/database corruption when switching
  // between `next dev` and `next build` in nearby sessions.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
