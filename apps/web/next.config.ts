import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages are consumed as TypeScript source; Next must compile them.
  transpilePackages: [
    '@gto-self/shared',
    '@gto-self/poker-core',
    '@gto-self/gto-core',
    '@gto-self/player-core',
    '@gto-self/db',
  ],
  // better-sqlite3 is a native module and must stay external to the server bundle.
  serverExternalPackages: ['better-sqlite3'],
  typedRoutes: false,
};

export default nextConfig;
