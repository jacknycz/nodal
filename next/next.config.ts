import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Fix Turbopack root inference on Windows when multiple lockfiles exist at repo root + /next
  turbopack: {
    root: __dirname,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
    // Treat warnings as warnings, not errors
    dirs: ['src', 'app'],
  },
  typescript: {
    // Warning: This allows production builds to successfully complete even if
    // your project has TypeScript errors.
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'xghncimqbauvtytdfkkx.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'hxovvlwgrzqdredyguta.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
