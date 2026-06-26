/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // `serverExternalPackages` (top-level in Next.js 15) replaces the
  // deprecated `experimental.serverComponentsExternalPackages`. Listing these
  // packages here tells Next.js to leave them as CommonJS `require()`s instead
  // of bundling them — they ship native or non-transpilable code that the
  // bundler cannot safely optimize.
  serverExternalPackages: [
    'mongoose',
    'pino',
    'pino-pretty',
    '@google/generative-ai',
    'groq-sdk',
  ],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;