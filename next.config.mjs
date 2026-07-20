/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.microlink.io',
      },
    ],
  },
  turbopack: {},
  serverExternalPackages: ['pino', 'thread-stream'],
};

export default nextConfig;
