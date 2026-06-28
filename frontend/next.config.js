/** @type {import('next').NextConfig} */
const nextConfig = {
  // Consume the local design-system library from source (no build/publish step).
  transpilePackages: ['@wa-lead/ui'],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001',
  },
};

module.exports = nextConfig;
