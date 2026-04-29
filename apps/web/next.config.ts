import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@empleado-ia/shared-types'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.blob.core.windows.net' },
      { protocol: 'https', hostname: '*.s3.amazonaws.com' },
    ],
  },
};

export default nextConfig;
