/** @type {import('next').NextConfig} */
const { version } = require("./package.json");

const nextConfig = {
  env: {
    NEXT_PUBLIC_BEACON_VERSION: version,
  },

  // Standalone output produces a self-contained server bundle in
  // .next/standalone — used by the production Dockerfile to ship a much
  // smaller image (no node_modules in the final stage).
  output: "standalone",

  async rewrites() {
    // Read at call time so both build-arg and runtime values are honored.
    const API_TARGET = process.env.API_TARGET || "http://localhost:8000";
    return [
      { source: "/api/:path*",  destination: `${API_TARGET}/api/:path*` },
      { source: "/auth/:path*", destination: `${API_TARGET}/auth/:path*` },
    ];
  },
};

module.exports = nextConfig;
