'use server';

/**
 * The quick typed-`EXTERNAL_HUD` server action (WP-3).
 *
 * A server action is a public endpoint, so its input is untrusted and is re-validated from
 * scratch by `saveExternalHudSnapshot` — through `player-core`'s own validating constructor,
 * so a bad percentage never reaches the database.
 *
 * APPEND ONLY (ADR-0076): a correction writes a NEW snapshot and never rewrites the previous
 * one. Saving recomputes ADAPTIVE only — this path never reaches `strategy-core`, and REFERENCE
 * is bit-identical across it.
 *
 * Not a hot path: this is a save button on the profile panel, and no hand transition awaits it.
 */
import { cryptoIdFactory } from '@gto-self/shared';
import type {
  SaveExternalHudSnapshotResult,
  SaveExternalHudSnapshotValue,
} from '../../lib/table/contract.js';
import { database } from '../db.js';
import { nowTimestamp } from '../session-service.js';
import { saveExternalHudSnapshot } from '../external-hud-entry-service.js';

export async function saveExternalHudSnapshotAction(
  input: SaveExternalHudSnapshotValue,
): Promise<SaveExternalHudSnapshotResult> {
  return saveExternalHudSnapshot(database(), input, {
    ids: cryptoIdFactory,
    now: nowTimestamp(),
  });
}
