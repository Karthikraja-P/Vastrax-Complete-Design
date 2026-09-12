import type { NextConfig } from "next";

const BACKEND_INTERNAL = process.env.INTERNAL_BACKEND_URL || "http://backend:8090";

const nextConfig: NextConfig = {
  output: "standalone",
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
