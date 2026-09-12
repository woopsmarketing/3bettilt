/**
 * External (third-party) HUD player profiles — a LIFETIME reading imported in bulk from a
 * HUD the user runs outside this app, as opposed to `hud.ts`'s `player_hud_snapshots`
 * (`MANUAL_HUD_ENTRY`, a short session-scale reading typed in by hand).
 *
 * Two things distinguish this from a manual HUD reading, both structural rather than a
 * bigger number in the same shape:
 *
 * 1. **`sampleN` is `null` by design, not by omission.** The screenshots this is imported
 *    from show a lifetime total but not a hand count, and inventing one (10,000? 20,000?)
 *    would be exactly the fabrication `CLAUDE.md` rule 2 forbids. `null` here does NOT mean
 *    "don't trust this" — `WP-K`'s ADR gives an external reading a fixed high confidence
 *    in `@gto-self/adaptive-core` precisely because "we don't know n" and "this is a
 *    casual guess" are different facts. This module only carries the testimony; the
 *    confidence policy lives in `adaptive-core`.
 * 2. **The stat vocabulary is GENERIC, not per-street.** The source HUD reports one
 *    Continuation-Bet / Fold-to-C-Bet / Check-Raise number with no street breakdown.
 *    Mapping that onto `hud.ts`'s `CBET_FLOP` (or `adaptive-core`'s per-street keys) would
 *    silently claim a street-specific fact nobody measured, so this module names three
 *    dedicated `*_ANY_STREET` keys instead. `adaptive-core` reads them as their own
 *    `AdaptiveStatKey` members (WP-K, ADR-0067), never folded into a per-street one.
 *
 * Same insert-only shape as `hud.ts`: a snapshot is testimony, never auto-overwritten, and
 * never merged with `PlayerObservation`/`PlayerHudSnapshot`. A new import is a new snapshot;
 * history is retained and `latestExternalHudSnapshot` selects rather than replaces.
 */
import { ok, type PlayerId, type SnapshotId } from '@gto-self/shared';
import { playerErr, type PlayerResult } from './errors.js';
import { parsePercent, type CentiPercent } from './percent.js';
import { validateTimestamp, type Timestamp } from './time.js';

/**
 * The 10 stats an external lifetime HUD profile carries. Named to match the
 * `AdaptiveStatKey` members they feed directly (`@gto-self/adaptive-core`) — 7 are a
 * direct 1:1 read, 3 (`CBET_ANY_STREET`, `FOLD_TO_CBET_ANY_STREET`,
 * `CHECK_RAISE_ANY_STREET`) are the generic-street counterparts of that package's
 * per-street keys, deliberately distinct from them (see module doc, point 2).
 */
export type ExternalHudStatKey =
  | 'VPIP'
  | 'PFR'
  | 'THREE_BET'
  | 'FOLD_TO_THREE_BET'
  | 'STEAL'
  | 'CBET_ANY_STREET'
  | 'FOLD_TO_CBET_ANY_STREET'
  | 'CHECK_RAISE_ANY_STREET'
  | 'WTSD'
  | 'WSD';

export const EXTERNAL_HUD_STAT_KEYS: readonly ExternalHudStatKey[] = [
  'VPIP',
  'PFR',
  'THREE_BET',
  'FOLD_TO_THREE_BET',
  'STEAL',
  'CBET_ANY_STREET',
  'FOLD_TO_CBET_ANY_STREET',
  'CHECK_RAISE_ANY_STREET',
  'WTSD',
  'WSD',
];

export const isExternalHudStatKey = (value: string): value is ExternalHudStatKey =>
  (EXTERNAL_HUD_STAT_KEYS as readonly string[]).includes(value);

/** One stat as it was read off the external HUD. */
export interface ExternalHudStatReading {
  readonly key: ExternalHudStatKey;
  /** Verbatim source text, e.g. `"29"` or `"29%"`. Never overwritten by `value`. */
  readonly enteredText: string;
  /** `enteredText` parsed to hundredths of a percentage point. Losslessly recoverable. */
  readonly value: CentiPercent;
}

/** Single member, same reasoning as `HudSnapshotSource` — self-describing in storage. */
export type ExternalHudSnapshotSource = 'EXTERNAL_HUD';

/** Single member: every external profile imported today is a lifetime total. */
export type ExternalHudScope = 'LIFETIME';

/**
 * Single member today: `WP-K` only imports profiles the user has explicitly described as
 * an established, accumulated read (not a short/uncertain one). A future casual external
 * import would need its own reliability value and its own confidence policy in
 * `adaptive-core` — never silently reusing this one.
 */
export type ExternalHudReliability = 'ESTABLISHED';

export interface PlayerExternalHudSnapshot {
  readonly id: SnapshotId;
  readonly playerId: PlayerId;
  readonly source: ExternalHudSnapshotSource;
  readonly scope: ExternalHudScope;
  readonly reliability: ExternalHudReliability;
  /** Caller-supplied instant the profile was imported. */
  readonly recordedAt: Timestamp;
  /**
   * ALWAYS `null` today (see module doc, point 1): the source screenshots do not show a
   * hand count, and one is never fabricated. The field exists, rather than being omitted
   * entirely, so a future source that DOES report a real lifetime hand count can populate
   * it without a schema change — but nothing in `WP-K` ever writes a non-null value.
   */
  readonly sampleN: number | null;
  /** Groups every player row written by one bulk-import run, for audit only. */
  readonly importBatchId: string;
  /** At least one reading, no duplicate keys, in the order supplied. */
  readonly stats: readonly ExternalHudStatReading[];
}

export interface ExternalHudStatInput {
  readonly key: ExternalHudStatKey;
  /** Exactly what the source reported. */
  readonly enteredText: string;
}

export interface CreateExternalHudSnapshotInput {
  /** Injected by the caller (ADR-0007). */
  readonly id: SnapshotId;
  readonly playerId: PlayerId;
  readonly recordedAt: Timestamp;
  readonly importBatchId: string;
  /**
   * A stat the source did not report is simply ABSENT from this list, never present with
   * a `null`/`"0"` value — omission is how "unknown" is represented end to end (this
   * module, the DB row, and the profile that reaches `adaptive-core`).
   */
  readonly stats: readonly ExternalHudStatInput[];
}

/**
 * Total. Builds one immutable snapshot.
 *
 * Rejects: an empty stat list, an unknown stat key, a duplicate key, an unparseable or
 * out-of-range percentage, an empty `importBatchId`, and an invalid timestamp.
 */
export function createExternalHudSnapshot(
  input: CreateExternalHudSnapshotInput,
): PlayerResult<PlayerExternalHudSnapshot> {
  const recordedAt = validateTimestamp(input.recordedAt, 'recordedAt');
  if (!recordedAt.ok) return recordedAt;

  if (input.importBatchId.length === 0) {
    return playerErr('INVALID_IMPORT_BATCH', 'importBatchId must not be empty', {
      field: 'importBatchId',
    });
  }

  if (input.stats.length === 0) {
    return playerErr('EMPTY_SNAPSHOT', 'an external HUD snapshot must record at least one stat', {
      field: 'stats',
      playerId: input.playerId,
    });
  }

  const seen = new Set<ExternalHudStatKey>();
  const stats: ExternalHudStatReading[] = [];
  for (const [index, entry] of input.stats.entries()) {
    if (!isExternalHudStatKey(entry.key)) {
      return playerErr('UNKNOWN_STAT', `unknown external HUD stat "${entry.key}"`, {
        field: 'stats',
        index,
        stat: entry.key,
        expected: EXTERNAL_HUD_STAT_KEYS.join(', '),
      });
    }
    if (seen.has(entry.key)) {
      return playerErr('DUPLICATE_STAT', `stat "${entry.key}" appears twice in one snapshot`, {
        field: 'stats',
        index,
        stat: entry.key,
      });
    }
    seen.add(entry.key);
    const value = parsePercent(entry.enteredText, `stats[${index}].${entry.key}`);
    if (!value.ok) return value;
    stats.push({ key: entry.key, enteredText: entry.enteredText, value: value.value });
  }

  return ok({
    id: input.id,
    playerId: input.playerId,
    source: 'EXTERNAL_HUD',
    scope: 'LIFETIME',
    reliability: 'ESTABLISHED',
    recordedAt: recordedAt.value,
    sampleN: null,
    importBatchId: input.importBatchId,
    stats,
  });
}

/** Total. One reading from a snapshot, or `undefined` when it was never reported. */
export const externalHudStat = (
  snapshot: PlayerExternalHudSnapshot,
  key: ExternalHudStatKey,
): ExternalHudStatReading | undefined => snapshot.stats.find((entry) => entry.key === key);

/**
 * Total. SELECTS the most recent snapshot — it never merges or replaces one. Same
 * deterministic tie-break as `latestHudSnapshot`.
 */
export function latestExternalHudSnapshot(
  snapshots: readonly PlayerExternalHudSnapshot[],
): PlayerExternalHudSnapshot | undefined {
  let latest: PlayerExternalHudSnapshot | undefined;
  for (const snapshot of snapshots) {
    if (
      latest === undefined ||
      snapshot.recordedAt > latest.recordedAt ||
      (snapshot.recordedAt === latest.recordedAt && snapshot.id > latest.id)
    ) {
      latest = snapshot;
    }
  }
  return latest;
}

/** Total. Full history for one player, oldest first, with the same deterministic tie-break. */
export function externalHudSnapshotHistory(
  snapshots: readonly PlayerExternalHudSnapshot[],
  playerId: PlayerId,
): readonly PlayerExternalHudSnapshot[] {
  return snapshots
    .filter((snapshot) => snapshot.playerId === playerId)
    .sort((a, b) => a.recordedAt - b.recordedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
