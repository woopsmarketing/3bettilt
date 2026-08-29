/**
 * `game_presets` — stored `TableConfig` documents.
 *
 * Storage only: this module never edits a preset's poker policy, it round-trips it through
 * `poker-core`'s own codec.
 */
import { eq } from 'drizzle-orm';
import { ok } from '@gto-self/shared';
import { validateTableConfig, type TableConfig } from '@gto-self/poker-core';
import type { Timestamp } from '@gto-self/player-core';
import type { GtoDatabase } from '../client.js';
import { attempt, dbErr, fromEngineError, type DbResult } from '../errors.js';
import { gamePresets } from '../schema.js';
import { collect, decodePresetRow, type StoredPreset } from '../rows.js';

/**
 * Insert a preset. Fails CONFLICT when `presetId` already exists — replacing a preset is
 * `updatePreset`, so an accidental overwrite cannot happen silently.
 */
export function insertPreset(
  db: GtoDatabase,
  config: TableConfig,
  at: Timestamp,
): DbResult<TableConfig> {
  const validated = validateTableConfig(config);
  if (!validated.ok) return fromEngineError(validated.error, { table: 'game_presets' });
  const existing = getPreset(db, config.presetId);
  if (!existing.ok) return existing;
  if (existing.value !== null) {
    return dbErr('CONFLICT', `preset "${config.presetId}" already exists`, {
      table: 'game_presets',
      id: config.presetId,
    });
  }
  const written = attempt({ table: 'game_presets', id: config.presetId }, () =>
    db
      .insert(gamePresets)
      .values({
        presetId: config.presetId,
        configJson: JSON.stringify(config),
        createdAt: at,
        updatedAt: at,
      })
      .run(),
  );
  if (!written.ok) return written;
  return ok(validated.value);
}

/**
 * Replace an existing preset's configuration. Sessions keep their OWN config copy, so this
 * never rewrites what an already-played session was configured with.
 */
export function updatePreset(
  db: GtoDatabase,
  config: TableConfig,
  at: Timestamp,
): DbResult<TableConfig> {
  const validated = validateTableConfig(config);
  if (!validated.ok) return fromEngineError(validated.error, { table: 'game_presets' });
  const written = attempt({ table: 'game_presets', id: config.presetId }, () =>
    db
      .update(gamePresets)
      .set({ configJson: JSON.stringify(config), updatedAt: at })
      .where(eq(gamePresets.presetId, config.presetId))
      .run(),
  );
  if (!written.ok) return written;
  if (written.value.changes === 0) {
    return dbErr('NOT_FOUND', `preset "${config.presetId}" does not exist`, {
      table: 'game_presets',
      id: config.presetId,
    });
  }
  return ok(validated.value);
}

/** `null` when absent. An Err means the stored row does not decode. */
export function getPreset(db: GtoDatabase, presetId: string): DbResult<StoredPreset | null> {
  const rows = attempt({ table: 'game_presets', id: presetId }, () =>
    db.select().from(gamePresets).where(eq(gamePresets.presetId, presetId)).all(),
  );
  if (!rows.ok) return rows;
  const row = rows.value[0];
  if (row === undefined) return ok(null);
  return decodePresetRow(row);
}

/** Every preset, ordered by `presetId` so the list never reorders itself between renders. */
export function listPresets(db: GtoDatabase): DbResult<readonly StoredPreset[]> {
  const rows = attempt({ table: 'game_presets' }, () =>
    db.select().from(gamePresets).orderBy(gamePresets.presetId).all(),
  );
  if (!rows.ok) return rows;
  return collect(rows.value.map(decodePresetRow));
}
