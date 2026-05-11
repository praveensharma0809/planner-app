import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep dev artifacts separate from production build output.
  // This avoids Turbopack cache/database corruption when switching
  // between `next dev` and `next build` in nearby sessions.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  // Suppress Next.js dev-indicator so it never appears in screenshot captures.
  // The indicator renders as a floating chip (position defaults to bottom-left,
  // configurable to bottom-right). It requires a dev-server restart to take effect.
  devIndicators: false,
};

export default nextConfig;
