/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Next.js devtools indicator 비활성화
  reactStrictMode: true,
};

export default nextConfig;
