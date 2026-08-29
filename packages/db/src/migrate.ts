/**
 * `pnpm db:migrate` — apply the committed migrations to a real database file.
 *
 * The path comes from `GTO_SELF_DB_URL`, or `./gto-self.db` next to the cwd. Nothing here
 * generates SQL: it replays the artifacts in `drizzle/`.
 */
import { openDatabase } from './client.js';

const url = process.env.GTO_SELF_DB_URL ?? './gto-self.db';
const handle = openDatabase({ url });
handle.close();
console.warn(`Migrations applied to ${url}`);
