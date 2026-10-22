import type { NextConfig } from "next";

const BACKEND_INTERNAL = process.env.INTERNAL_BACKEND_URL || "http://backend:8090";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    // Combo try-on runs two GPU passes and can exceed Next's 30-second proxy default.
    proxyTimeout: 90_000,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${BACKEND_INTERNAL}/api/v1/:path*`,
      },
      {
        source: "/results/:path*",
        destination: `${BACKEND_INTERNAL}/results/:path*`,
      },
      {
        source: "/user_uploads/:path*",
        destination: `${BACKEND_INTERNAL}/user_uploads/:path*`,
      },
      {
        source: "/health",
        destination: `${BACKEND_INTERNAL}/health`,
      },
    ];
  },
};


export default nextConfig;
