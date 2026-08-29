/**
 * A resolution target, not a module anyone imports.
 *
 * `next.config.ts` aliases `@gto-self/db`'s `new URL('../drizzle', import.meta.url)`
 * request here so Turbopack can resolve it. Nothing reads the value: `src/server/db.ts`
 * always passes an explicit `migrationsFolder`, because a bundled `import.meta.url`
 * resolves inside `.next/server/` and would never point at the committed migrations.
 */
export const MIGRATIONS_ARE_NOT_BUNDLED = true;
