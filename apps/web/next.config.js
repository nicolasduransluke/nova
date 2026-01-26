/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@nova/ui', '@nova/types', '@nova/utils'],
  experimental: {
    serverActions: true,
  },
};

module.exports = nextConfig;
