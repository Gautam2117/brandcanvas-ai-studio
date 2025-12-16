/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { externalDir: true },
  transpilePackages: ["@brandcanvas/policy"],
};

module.exports = nextConfig;
