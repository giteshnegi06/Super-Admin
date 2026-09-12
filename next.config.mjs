/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverComponentsExternalPackages: ["@neondatabase/serverless", "undici"] },
};
export default nextConfig;
