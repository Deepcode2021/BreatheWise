import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    inlineCss: true,
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns', 'framer-motion'],
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;

