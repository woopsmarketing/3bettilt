/**
 * `pnpm players:import-external <path-to-json>` — bulk-import EXTERNAL_HUD lifetime player
 * profiles (WP-K §10). Never runs against the database automatically; the user invokes it
 * by hand, exactly like `pnpm adaptive:backfill`.
 *
 * Input shape: `{ players: [{ nickname, VPIP, PFR, THREE_BET, FOLD_TO_THREE_BET, CBET,
 * FOLD_TO_CBET, STEAL, CHECK_RAISE, WTSD, WSD }, ...] }`, values `number | null`. `null`
 * means the source did not report that stat and is NEVER written as a row — see
 * `@gto-self/player-core`'s `externalHud.ts` module doc. `CBET` / `FOLD_TO_CBET` /
 * `CHECK_RAISE` are generic (no street breakdown in the source) and map to
 * `adaptive-core`'s `CBET_ANY_STREET` / `FOLD_TO_CBET_ANY_STREET` /
 * `CHECK_RAISE_ANY_STREET` — see `../src/server/external-hud-import-service.ts` for the
 * field map, which is the ONE place that owns this mapping.
 *
 * Nickname matching is EXACT (normalized), reusing an existing `players` row rather than
 * ever creating a duplicate. `EXTERNAL_HUD` snapshots are insert-only: re-running this
 * script over unchanged data reports `ALREADY_PERSISTED` per player and writes nothing new;
 * changed values write a new snapshot and report `NEW SNAPSHOT`, with history retained.
 *
 * This script is the only caller of `@gto-self/db` outside `apps/web/src/server/` would be —
 * except it isn't: every database read/write lives in `external-hud-import-service.ts`
 * instead, because ESLint restricts `@gto-self/db` to that directory (it loads a native
 * module). This file only reads the source JSON, calls the service, and prints the report.
 *
 * Run: `pnpm --filter @gto-self/web players:import-external <path>` (or
 * `pnpm players:import-external <path>` from the repo root).
 */
import { readFileSync } from 'node:fs';
import { cryptoIdFactory } from '@gto-self/shared';
import { timestamp } from '@gto-self/player-core';
import { database } from '../src/server/db.js';
import {
  importExternalHudProfiles,
  type SourcePlayer,
} from '../src/server/external-hud-import-service.js';

interface SourceFile {
  readonly players: readonly SourcePlayer[];
}

function main(): void {
  const path = process.argv[2];
  if (path === undefined) {
    console.error('usage: pnpm players:import-external <path-to-json>');
    process.exitCode = 1;
    return;
  }

  const raw: SourceFile = JSON.parse(readFileSync(path, 'utf8')) as SourceFile;
  if (!Array.isArray(raw.players) || raw.players.length === 0) {
    console.error(`${path}: expected a non-empty "players" array`);
    process.exitCode = 1;
    return;
  }

  const ids = cryptoIdFactory;
  const now = timestamp(Date.now());
  const importBatchId = `import-${now}-${ids.next()}`;

  const rows = importExternalHudProfiles(database(), raw.players, now, ids, importBatchId);

  console.warn(`players:import-external — batch ${importBatchId}, ${rows.length} player(s) in ${path}`);
  console.warn('');
  for (const row of rows) {
    const suffix = row.reason !== undefined ? ` — ${row.reason}` : '';
    console.warn(
      `  ${row.nickname.padEnd(16)} ${row.playerId.padEnd(38)} ${row.outcome.padEnd(18)} stats=${row.statsWritten}${suffix}`,
    );
  }
  const failedCount = rows.filter((row) => row.outcome === 'FAILED').length;
  console.warn('');
  console.warn(
    `done — new players ${rows.filter((r) => r.outcome === 'NEW_PLAYER').length}, ` +
      `new snapshots ${rows.filter((r) => r.outcome === 'NEW_SNAPSHOT').length}, ` +
      `already persisted ${rows.filter((r) => r.outcome === 'ALREADY_PERSISTED').length}, ` +
      `failed ${failedCount}`,
  );
  if (failedCount > 0) process.exitCode = 1;
}

main();
