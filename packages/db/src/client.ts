/**
 * Opening the database.
 *
 * Two things here are correctness, not tuning:
 *
 * 1. **`PRAGMA foreign_keys = ON`.** SQLite does NOT enforce foreign keys by default — a
 *    schema full of REFERENCES clauses with this pragma off is decoration. It is set on
 *    every connection, before anything else runs, because the pragma is per-connection.
 * 2. **Migrations are applied from committed SQL files**, never generated at runtime from
 *    the TypeScript schema. `drizzle/` is the artifact; `schema.ts` is the source it was
 *    generated from.
 */
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';

export type GtoDatabase = BetterSQLite3Database<typeof schema>;

export interface DatabaseHandle {
  readonly db: GtoDatabase;
  readonly sqlite: Database.Database;
  /** Idempotent. */
  close(): void;
}

/** The committed migration artifacts. Resolved relative to this module, not to the cwd. */
export const MIGRATIONS_FOLDER: string = fileURLToPath(new URL('../drizzle', import.meta.url));

/** In-memory database URL. Each connection gets its OWN empty database. */
export const IN_MEMORY_URL = ':memory:';

export interface OpenDatabaseOptions {
  /** File path, or `':memory:'`. Defaults to `':memory:'`. */
  readonly url?: string;
  /** Apply committed migrations on open. Default true. */
  readonly applyMigrations?: boolean;
  /** Override the migrations folder. Tests and tooling only. */
  readonly migrationsFolder?: string;
  /** Open the file read-only. Implies `applyMigrations: false`. */
  readonly readonly?: boolean;
}

/**
 * Opens a connection, sets the pragmas, and applies the committed migrations.
 *
 * Throws rather than returning a Result: a database that will not open is a startup
 * failure, not a user-facing outcome the app can carry on from.
 */
export function openDatabase(options: OpenDatabaseOptions = {}): DatabaseHandle {
  const url = options.url ?? IN_MEMORY_URL;
  const readonly = options.readonly ?? false;
  const sqlite = new Database(url, { readonly });

  // Per-connection and required for the schema's foreign keys to mean anything.
  sqlite.pragma('foreign_keys = ON');
  if (url !== IN_MEMORY_URL) {
    // WAL is meaningless for :memory: and errors on a read-only handle.
    if (!readonly) sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('busy_timeout = 5000');
    sqlite.pragma('synchronous = NORMAL');
  }

  const db = drizzle(sqlite, { schema });

  if (!readonly && (options.applyMigrations ?? true)) {
    migrate(db, { migrationsFolder: options.migrationsFolder ?? MIGRATIONS_FOLDER });
  }

  let closed = false;
  return {
    db,
    sqlite,
    close(): void {
      if (closed) return;
      closed = true;
      sqlite.close();
    },
  };
}

/** A migrated, empty, in-memory database. The integration tests' entry point. */
export function openTestDatabase(): DatabaseHandle {
  return openDatabase({ url: IN_MEMORY_URL });
}

/** True when foreign keys are actually being enforced on this connection. */
export function foreignKeysEnabled(handle: DatabaseHandle): boolean {
  const rows = handle.sqlite.pragma('foreign_keys') as readonly { readonly foreign_keys: number }[];
  return rows[0]?.foreign_keys === 1;
}
