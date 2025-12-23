const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/sheets\.googleapis\.com\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'google-sheets-api',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 300, // 5 minutes
        },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {}, // Empty turbopack config to suppress warning
  devIndicators: {
    buildActivity: false, // Disable the build indicator
    buildActivityPosition: 'bottom-right',
  },
};

module.exports = withPWA(nextConfig);
