/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === 'production';

// Which build a client machine is running, sent with its error reports:
// the package version plus when this build was made (UTC).
const appVersion =
  process.env.NEXT_PUBLIC_APP_VERSION ||
  `${require('./package.json').version}+${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;

const nextConfig = {
  // Standalone output — enables minimal Docker image without node_modules copy
  output: isProd ? 'standalone' : undefined,

  images: {
    domains: ['localhost'],
  },
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },

  // ─── Production Protection ──────────────────────────────────────
  // Disable source maps so client-side code cannot be reverse-engineered
  productionBrowserSourceMaps: false,

  // Compiler optimizations — remove console.* calls in production builds
  compiler: {
    removeConsole: isProd
      ? {
          exclude: ['error'], // keep console.error for critical errors
        }
      : false,
  },

  // Webpack customization
  webpack: (config, { dev, isServer }) => {
    if (!dev) {
      // Disable source maps for both client and server bundles
      config.devtool = false;

      // Drop debugger statements and console.log calls from bundles
      config.optimization = {
        ...config.optimization,
        minimize: true,
      };
    }
    return config;
  },

  // Disable the X-Powered-By header to hide Next.js version
  poweredByHeader: false,

  // Prevent exposing build ID in error messages
  generateEtags: false,
};

module.exports = nextConfig;
