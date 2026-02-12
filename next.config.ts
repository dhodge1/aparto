import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow e-housing CDN images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.shortpixel.ai',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 's3.ap-northeast-1.amazonaws.com',
        pathname: '/ehousing-dev/**',
      },
    ],
  },
  // Service worker should not be processed by Next.js
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ]
  },
}

export default nextConfig
