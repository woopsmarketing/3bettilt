/**
 * Manual CoinPoker HUD snapshots.
 *
 * A snapshot is TESTIMONY: a record of what a third-party HUD displayed at one moment,
 * as typed in by the user. It is not our measurement, and this package deliberately
 * offers no way to combine one with a `PlayerObservation` — averaging a third party's
 * number with our own count produces a figure that means nothing (`docs/ARCHITECTURE.md`
 * "Player Engine").
 *
 * Two rules are structural here, not conventional:
 *
 * 1. **Never auto-overwritten.** There is no mutator in this file. A new reading is a
 *    NEW snapshot with its own id and timestamp; the previous one stays. History is
 *    retained, and `latestHudSnapshot` selects rather than replaces.
 * 2. **Never merged with observations.** `source` is a single-member union so a snapshot
 *    stays self-describing wherever it travels, including through the database.
 *
 * Each reading keeps the raw text the user typed alongside the parsed integer, so the
 * entered value survives verbatim (`CLAUDE.md` rule 3).
 */
import { ok, type PlayerId, type SnapshotId } from '@gto-self/shared';
import { playerErr, type PlayerResult } from './errors.js';
import { parsePercent, type CentiPercent } from './percent.js';
import { validateTimestamp, type Timestamp } from './time.js';

/**
 * The HUD stats we accept. Every member is a FREQUENCY, expressed as a percentage,
 * which is what makes one shared `CentiPercent` representation honest.
 *
 * Deliberately excluded: aggression factor and any other non-percentage ratio. AF is
 * unbounded (a value of 3.5 is normal) and is not a frequency, so it needs its own
 * representation decision; inventing one here would put a number with different units
 * behind the same type. Add such stats when they are actually needed, with their own type.
 */
export type HudStatKey =
  | 'VPIP'
  | 'PFR'
  | 'THREE_BET'
  | 'FOLD_TO_THREE_BET'
  | 'CBET_FLOP'
  | 'FOLD_TO_CBET_FLOP'
  | 'WTSD'
  | 'WON_AT_SHOWDOWN';

export const HUD_STAT_KEYS: readonly HudStatKey[] = [
  'VPIP',
  'PFR',
  'THREE_BET',
  'FOLD_TO_THREE_BET',
  'CBET_FLOP',
  'FOLD_TO_CBET_FLOP',
  'WTSD',
  'WON_AT_SHOWDOWN',
];

export const isHudStatKey = (value: string): value is HudStatKey =>
  (HUD_STAT_KEYS as readonly string[]).includes(value);

/** One stat as it was read off the HUD. */
export interface HudStatReading {
  readonly key: HudStatKey;
  /** Verbatim user input, e.g. `"23.5"` or `"23.5 %"`. Never overwritten by `value`. */
  readonly enteredText: string;
  /** `enteredText` parsed to hundredths of a percentage point. Losslessly recoverable. */
  readonly value: CentiPercent;
}

/**
 * Single member on purpose: it makes "this row is third-party testimony" a property of
 * the record itself, so a snapshot can never be silently reinterpreted as our own count.
 */
export type HudSnapshotSource = 'MANUAL_HUD_ENTRY';

export interface PlayerHudSnapshot {
  readonly id: SnapshotId;
  readonly playerId: PlayerId;
  readonly source: HudSnapshotSource;
  /** Caller-supplied instant the reading was taken. */
  readonly recordedAt: Timestamp;
  /**
   * The hand count the HUD itself reported for this player, or `null` when the HUD did
   * not show one. `null` is NOT zero and NOT an estimate — an unknown sample must stay
   * unknown, so confidence over it is `INSUFFICIENT` rather than a fabricated number.
   */
  readonly handSample: number | null;
  /** At least one reading, no duplicate keys, in the order the user entered them. */
  readonly stats: readonly HudStatReading[];
}

export interface HudStatInput {
  readonly key: HudStatKey;
  /** Exactly what the user typed. */
  readonly enteredText: string;
}

export interface CreateHudSnapshotInput {
  /** Injected by the caller (ADR-0007). */
  readonly id: SnapshotId;
  readonly playerId: PlayerId;
  readonly recordedAt: Timestamp;
  readonly handSample: number | null;
  readonly stats: readonly HudStatInput[];
}

/** Largest accepted HUD-reported hand count. A larger figure is a typo, not a sample. */
export const MAX_HAND_SAMPLE = 100_000_000;

/**
 * Total. Builds one immutable snapshot.
 *
 * Rejects: an empty stat list, an unknown stat key, a duplicate key within the snapshot,
 * an unparseable or out-of-range percentage, a negative/non-integer/absurd hand sample,
 * and an invalid timestamp.
 */
export function createHudSnapshot(input: CreateHudSnapshotInput): PlayerResult<PlayerHudSnapshot> {
  const recordedAt = validateTimestamp(input.recordedAt, 'recordedAt');
  if (!recordedAt.ok) return recordedAt;

  if (input.handSample !== null) {
    const sample = input.handSample;
    if (!Number.isSafeInteger(sample) || sample < 0 || sample > MAX_HAND_SAMPLE) {
      return playerErr(
        'INVALID_SAMPLE_SIZE',
        `handSample must be null or an integer 0..${MAX_HAND_SAMPLE}`,
        { field: 'handSample', actual: sample, min: 0, max: MAX_HAND_SAMPLE },
      );
    }
  }

  if (input.stats.length === 0) {
    return playerErr('EMPTY_SNAPSHOT', 'a HUD snapshot must record at least one stat', {
      field: 'stats',
      playerId: input.playerId,
    });
  }

  const seen = new Set<HudStatKey>();
  const stats: HudStatReading[] = [];
  for (const [index, entry] of input.stats.entries()) {
    if (!isHudStatKey(entry.key)) {
      return playerErr('UNKNOWN_STAT', `unknown HUD stat "${entry.key}"`, {
        field: 'stats',
        index,
        stat: entry.key,
        expected: HUD_STAT_KEYS.join(', '),
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
    source: 'MANUAL_HUD_ENTRY',
    recordedAt: recordedAt.value,
    handSample: input.handSample,
    stats,
  });
}

/** Total. One reading from a snapshot, or `undefined` when the user did not enter it. */
export const hudStat = (snapshot: PlayerHudSnapshot, key: HudStatKey): HudStatReading | undefined =>
  snapshot.stats.find((entry) => entry.key === key);

/**
 * Total. SELECTS the most recent snapshot — it never merges or replaces one. Ties on
 * `recordedAt` break on the greater id, which is deterministic rather than meaningful;
 * two readings at the identical millisecond carry no ordering information.
 */
export function latestHudSnapshot(
  snapshots: readonly PlayerHudSnapshot[],
): PlayerHudSnapshot | undefined {
  let latest: PlayerHudSnapshot | undefined;
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
export function hudSnapshotHistory(
  snapshots: readonly PlayerHudSnapshot[],
  playerId: PlayerId,
): readonly PlayerHudSnapshot[] {
  return snapshots
    .filter((snapshot) => snapshot.playerId === playerId)
    .sort((a, b) => a.recordedAt - b.recordedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
