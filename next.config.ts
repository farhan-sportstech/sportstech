import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // LAN address, so the dev page also hydrates when opened from 192.168.x.x instead of localhost
  allowedDevOrigins: ["192.168.10.89"],
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
