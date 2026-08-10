/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // If you switch <img> to next/image, add your Supabase + seed image hosts here.
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};
export default nextConfig;
