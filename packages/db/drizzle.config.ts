import { defineConfig } from 'drizzle-kit';

/**
 * Migrations are COMMITTED ARTIFACTS. `pnpm db:generate` writes them into `drizzle/`;
 * nothing applies a schema diff at runtime.
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.GTO_SELF_DB_URL ?? './gto-self.db' },
  strict: true,
});
