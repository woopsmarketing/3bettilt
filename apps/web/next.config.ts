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
  // Next 16 writes its own `AGENTS.md` / `CLAUDE.md` into the app on `dev`. This
  // repository already has one set of agent rules at its root and must not grow a second,
  // competing copy inside `apps/web`.
  agentRules: false,
  /**
   * Next 16's dev server rejects asset and HMR requests whose origin it does not
   * recognise, with a bare 403. Browsing the dev server on `127.0.0.1` instead of
   * `localhost` therefore loads the HTML, fails several chunks, and leaves the page
   * rendered but NEVER HYDRATED — every control is inert with nothing in the console
   * except "Failed to load resource". Both spellings of the loopback address are the same
   * machine, and Playwright's default `baseURL` uses the numeric one.
   */
  allowedDevOrigins: ['127.0.0.1'],
  turbopack: {
    /**
     * `@gto-self/db` computes its default migrations folder as
     * `new URL('../drizzle', import.meta.url)`. Turbopack treats that as an asset
     * reference and fails the build trying to resolve the `drizzle/` DIRECTORY as a
     * module.
     *
     * The value is dead weight here in any case: a bundled `import.meta.url` points into
     * `.next/server/`, so `MIGRATIONS_FOLDER` would be wrong at runtime even if it did
     * resolve. `src/server/db.ts` never uses it — it always passes an explicit
     * `migrationsFolder` resolved from the repository root. Pointing the request at a
     * tiny module makes the reference resolvable and keeps the wrong value unused.
     */
    resolveAlias: { '../drizzle': './src/server/migrations-not-bundled.ts' },
  },
};

export default nextConfig;
