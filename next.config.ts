import type { NextConfig } from "next";

const BACKEND_INTERNAL = process.env.INTERNAL_BACKEND_URL || "http://127.0.0.1:8090";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${BACKEND_INTERNAL}/api/v1/:path*`,
      },
      {
        source: "/health",
        destination: `${BACKEND_INTERNAL}/health`,
      },
    ];
  },
};

export default nextConfig;
