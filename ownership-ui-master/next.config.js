// next.config.js
const nextConfig = {
  swcMinify: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ["antd", "@ant-design/icons", "@ant-design/nextjs-registry", "@refinedev/antd"],
};

module.exports = nextConfig;