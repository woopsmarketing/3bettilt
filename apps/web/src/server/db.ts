/**
 * The app's ONE database handle. Server-only.
 *
 * `apps/web/src/server/**` is the only place ESLint permits `@gto-self/db` to be imported
 * (`eslint.config.js`): the package loads `better-sqlite3`, a native Node module, so a
 * client component that reached it would not fail a lint rule, it would fail in the
 * browser. Funnelling every read and write through here also keeps the hot path —
 * keypress -> `poker-core` -> React -> render — provably free of a database round trip.
 *
 * ## Why the migrations folder is passed explicitly
 *
 * `@gto-self/db`'s `defaultMigrationsFolder()` is `new URL('../drizzle', import.meta.url)`,
 * which is correct for Vitest (it runs the package's own source) and WRONG under Next:
 * `@gto-self/db` is listed in `transpilePackages`, so Next compiles it into a server chunk
 * and `import.meta.url` resolves inside the build output, where no `drizzle/` folder
 * exists. Turbopack rewrites the expression further, into an asset reference whose `URL`
 * makes `fileURLToPath` throw outright. The default therefore has to be replaced with a
 * path resolved from the REPO, never from a bundled module — which is what
 * `migrationsDir()` below does, and it is passed on EVERY open so the package's own
 * default is never reached.
 *
 * ## Why the handle is cached on `globalThis`
 *
 * Next's dev server re-evaluates a module on every hot reload. A module-level `let` would
 * open a NEW SQLite connection and re-run the migrator on each reload, leaking file
 * handles. A `Symbol.for` key survives module re-evaluation, so one process holds one
 * connection.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { openDatabase, type DatabaseHandle, type GtoDatabase } from '@gto-self/db';

/** Marks the repository root. Present at the top of this workspace and nowhere below it. */
const ROOT_MARKER = 'pnpm-workspace.yaml';

/** The migrations that must exist wherever the root is found. */
const MIGRATIONS_SUBPATH = join('packages', 'db', 'drizzle');

/**
 * Walks up from the process's working directory looking for the workspace root. Next runs
 * with the cwd at `apps/web`, but nothing here depends on that being exact — only on the
 * root being an ancestor.
 */
function repositoryRoot(): string {
  // `turbopackIgnore` keeps Turbopack from concluding that a dynamic path means the whole
  // project must be traced into the server output. The walk is a startup-time lookup of a
  // file this repository always has; nothing about it needs bundling.
  let dir = resolve(/* turbopackIgnore: true */ process.cwd());
  for (;;) {
    if (existsSync(join(dir, ROOT_MARKER))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Could not find the repository root (no ${ROOT_MARKER} at or above ${process.cwd()}). ` +
          'Set GTO_SELF_MIGRATIONS_DIR and GTO_SELF_DB_URL to run from elsewhere.',
      );
    }
    dir = parent;
  }
}

/**
 * The committed migration artifacts. `GTO_SELF_MIGRATIONS_DIR` overrides it; otherwise it
 * is resolved from the repository root. Missing is a startup failure with a real message,
 * not a database that silently comes up with no tables.
 */
export function migrationsDir(): string {
  const override = process.env.GTO_SELF_MIGRATIONS_DIR;
  const folder = override ?? join(repositoryRoot(), MIGRATIONS_SUBPATH);
  if (!existsSync(join(folder, 'meta', '_journal.json'))) {
    throw new Error(
      `No migration journal at ${folder}. ` +
        (override === undefined
          ? 'Expected the committed artifacts in packages/db/drizzle.'
          : 'GTO_SELF_MIGRATIONS_DIR points somewhere without one.'),
    );
  }
  return folder;
}

/**
 * The database file. `GTO_SELF_DB_URL` overrides it; otherwise `<repo>/.data/gto-self.db`,
 * which is git-ignored. The directory is created if it does not exist.
 */
export function databaseUrl(): string {
  const override = process.env.GTO_SELF_DB_URL;
  const url = override ?? join(repositoryRoot(), '.data', 'gto-self.db');
  if (url !== ':memory:') mkdirSync(dirname(url), { recursive: true });
  return url;
}

const HANDLE_KEY = Symbol.for('gto-self.web.databaseHandle');

type HandleCarrier = typeof globalThis & { [HANDLE_KEY]?: DatabaseHandle };

/** The process-wide handle, opening and migrating it on first use. */
export function databaseHandle(): DatabaseHandle {
  const carrier = globalThis as HandleCarrier;
  const existing = carrier[HANDLE_KEY];
  if (existing !== undefined) return existing;
  const handle = openDatabase({ url: databaseUrl(), migrationsFolder: migrationsDir() });
  carrier[HANDLE_KEY] = handle;
  return handle;
}

/** The Drizzle database. Repositories take this. */
export function database(): GtoDatabase {
  return databaseHandle().db;
}
