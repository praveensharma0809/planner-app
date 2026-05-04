import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// ─── Supabase origin resolution ──────────────────────────────────────────────
// Derive the exact Supabase origin from NEXT_PUBLIC_SUPABASE_URL so the CSP
// connect-src directive never widens to the entire *.supabase.co wildcard.
// If the env var is missing (e.g. CI builds without secrets) we fall back to
// the wildcard so the build does not fail, but production deploys MUST set it.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHttpsOrigin = (() => {
  if (!supabaseUrl) return "https://*.supabase.co";
  try {
    return new URL(supabaseUrl).origin;
  } catch {
    return "https://*.supabase.co";
  }
})();
const supabaseWssOrigin = supabaseHttpsOrigin.replace(/^https/, "wss");

// ─── Content Security Policy ─────────────────────────────────────────────────
// NOTE: 'unsafe-inline' for script-src is a known relaxation. Next.js injects
// inline <script> tags for hydration data and route prefetching; eliminating
// 'unsafe-inline' requires a per-request nonce wired through proxy.ts. That is
// tracked as a follow-up hardening task (see PROJECT_ROADMAP_TO_10.md A.5b).
//
// 'unsafe-inline' for style-src is required because the codebase uses inline
// style={{ ... }} props throughout (compiled to style="..." attributes).
const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseHttpsOrigin} ${supabaseWssOrigin}${isDev ? " ws: wss: http://localhost:* http://127.0.0.1:*" : ""}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

// ─── Security headers ────────────────────────────────────────────────────────
const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Redundant with frame-ancestors 'none' in CSP, kept for legacy browsers.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // HSTS only in production (development uses http://localhost).
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]),
];

const nextConfig: NextConfig = {
  // Keep dev artifacts separate from production build output.
  // This avoids Turbopack cache/database corruption when switching
  // between `next dev` and `next build` in nearby sessions.
  distDir: isDev ? ".next-dev" : ".next",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
