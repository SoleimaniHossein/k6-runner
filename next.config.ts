import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ Correct for Next.js 16 - serverExternalPackages
  serverExternalPackages: ['ws', 'uuid'],
  
  // ✅ Turbopack configuration (Next.js 16 uses Turbopack by default)
  turbopack: {
    // Empty object to acknowledge turbopack usage
  },
};

export default nextConfig;
