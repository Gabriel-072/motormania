/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // Skip ESLint during `next build`
  },
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'zbytlqhtgwbwksrnaxnw.supabase.co',
        pathname: '/storage/v1/object/public/league-images/**', // Allow all images in this bucket
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
        pathname: '/**', // Allow all paths under img.clerk.com
      },
      {
        protocol: 'https',
        hostname: '*.giphy.com', // Wildcard for all GIPHY subdomains (media1, media2, etc.)
        pathname: '/**', // Allow all paths under GIPHY domains
      },
    ],
  },
};

module.exports = nextConfig;