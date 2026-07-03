import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['ws', 'uuid'],
  turbopack: {},
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '192.168.15.*'
  ],
  
};

export default nextConfig;
