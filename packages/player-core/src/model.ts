/**
 * The DERIVED player model: spot vocabulary, opportunity counts, revealed-card evidence
 * and the versioned snapshot that carries them.
 *
 * This module is pure vocabulary and shape. It computes nothing about poker: it may not
 * import `poker-core` (ADR-0021), so every dimension here is `player-core`'s own
 * separately-declared vocabulary, exactly as `ObservedPosition` duplicates `poker-core`'s
 * `Position`. `@gto-self/analysis-core` maps one to the other (ADR-0061).
 *
 * Three rules hold everywhere below, and they are the reason the shapes look the way they
 * do:
 *
 * 1. **Counts, never rates.** Every statistic is `opportunities` (the denominator) plus an
 *    action count. A rate is derived on demand and is never stored — the same rule
 *    `PlayerObservation` already follows (ADR-0035).
 * 2. **An opportunity is a decision that actually happened.** These records are produced
 *    only from a real event log, at a point where action genuinely reached the player.
 *    A denominator is never a hand count standing in for a situation count (prompt §16,
 *    §30).
 * 3. **Raw money stays raw.** A `BetSizeObservation` keeps the actual integer milliBB
 *    amounts; the bucket is an additional, derived, explicitly-heuristic label
 *    (prompt §19, CLAUDE.md rule 3).
 *
 * These records are our own computed counts. They are a permanently separate record type
 * from `PlayerHudSnapshot` (typed-in third-party testimony) and are never merged with it,
 * and they are NOT written into `player_observations`, which stays the manually-driven
 * live-observation surface (ADR-0062a).
 */
import type { Card, HandId, PlayerId } from '@gto-self/shared';
import type { ObservedPosition } from './observation.js';
import type { SnapshotConfidence } from './modelConfig.js';
import type { Timestamp } from './time.js';

/* -------------------------------------------------------------------------- */
/* Actions                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The verb the player actually used. `ALL_IN` is kept as its own member because it is a
 * distinct thing a person did — collapsing it into CALL/RAISE would destroy entered input
 * (CLAUDE.md rule 3).
 */
export type ObservedAction = 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'ALL_IN';

export const OBSERVED_ACTIONS: readonly ObservedAction[] = [
  'FOLD',
  'CHECK',
  'CALL',
  'BET',
  'RAISE',
  'ALL_IN',
];

/**
 * What the action FUNCTIONED as. An `ALL_IN` shove is a CALL, a BET or a RAISE depending
 * on the amounts; every numerator in this module is defined over the effect, never over
 * the verb, so a player who shoved instead of pressing "raise" is counted as having
 * raised.
 */
export type ObservedActionEffect = 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE';

export const OBSERVED_ACTION_EFFECTS: readonly ObservedActionEffect[] = [
  'FOLD',
  'CHECK',
  'CALL',
  'BET',
  'RAISE',
];

/** Total. True for an effect that put the player's money in voluntarily. */
export const isVoluntaryEffect = (effect: ObservedActionEffect): boolean =>
  effect === 'CALL' || effect === 'BET' || effect === 'RAISE';

/** Total. True for an effect that increased the price to continue. */
export const isAggressiveEffect = (effect: ObservedActionEffect): boolean =>
  effect === 'BET' || effect === 'RAISE';

/* -------------------------------------------------------------------------- */
/* Spot dimensions                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Preflop situation families. Deliberately coarse: a family plus the acting position plus
 * (where one exists) the position of the player who created the situation is enough to
 * name every spot the brief asks for, and is bounded at 6 x 6 x 8 buckets rather than
 * growing with the hand (prompt §18).
 *
 * - `RFI`             — nobody has put in a raise or a limp; the player may open.
 * - `VS_LIMP`         — at least one limp, no raise yet.
 * - `BB_OPTION`       — the big blind's free option in a limped or unraised pot.
 * - `VS_OPEN`         — exactly one raise so far, no cold-caller behind it.
 * - `SQUEEZE`         — exactly one raise plus at least one cold-caller.
 * - `VS_THREE_BET`    — the player made the opening raise and now faces a re-raise.
 * - `VS_FOUR_BET`     — the player made the 3-bet and now faces a 4-bet.
 * - `VS_MULTI_RAISE`  — three or more prior raises, or any prior line the four families
 *                       above do not describe. The honest catch-all: an off-policy line
 *                       is recorded, not discarded (prompt §31).
 */
export type PreflopSpotFamily =
  | 'RFI'
  | 'VS_LIMP'
  | 'BB_OPTION'
  | 'VS_OPEN'
  | 'SQUEEZE'
  | 'VS_THREE_BET'
  | 'VS_FOUR_BET'
  | 'VS_MULTI_RAISE';

export const PREFLOP_SPOT_FAMILIES: readonly PreflopSpotFamily[] = [
  'RFI',
  'VS_LIMP',
  'BB_OPTION',
  'VS_OPEN',
  'SQUEEZE',
  'VS_THREE_BET',
  'VS_FOUR_BET',
  'VS_MULTI_RAISE',
];

/** Postflop streets only. Preflop spots use `PreflopSpotFamily`. */
export type ObservedStreet = 'FLOP' | 'TURN' | 'RIVER';

export const OBSERVED_STREETS: readonly ObservedStreet[] = ['FLOP', 'TURN', 'RIVER'];

/**
 * Postflop situation families. "Initiative" means the player was the last aggressor on
 * the previous betting round (preflop, for the flop).
 *
 * Every member names an OPPORTUNITY (the situation faced), never an action taken — a
 * `DONK_LEAD` spot is one where a donk lead was AVAILABLE, and checking is one of the
 * observed responses to it.
 *
 * There is deliberately no `CHECK_RAISE` family: "already checked and now facing a bet" is
 * a question about the same situation a `FACING_CBET` / `FACING_BET` spot already names,
 * and giving it its own bucket would both double the postflop bucket count and mislabel
 * the far commoner check-fold. It is counted exactly, as its own global stat, with its own
 * denominator.
 *
 * - `CBET`          — has initiative, no bet yet this street: may continuation-bet.
 * - `FACING_CBET`   — facing this street's first bet, made by the initiative holder.
 * - `DONK_LEAD`     — no initiative, first to act, no bet yet this street.
 * - `CHECKED_TO`    — no initiative, no bet yet this street, and not first to act.
 * - `FACING_BET`    — facing a bet that is not the initiative holder's first bet.
 * - `FACING_RAISE`  — facing a raise (a second or later aggressive action this street).
 */
export type PostflopSpotFamily =
  'CBET' | 'FACING_CBET' | 'DONK_LEAD' | 'CHECKED_TO' | 'FACING_BET' | 'FACING_RAISE';

export const POSTFLOP_SPOT_FAMILIES: readonly PostflopSpotFamily[] = [
  'CBET',
  'FACING_CBET',
  'DONK_LEAD',
  'CHECKED_TO',
  'FACING_BET',
  'FACING_RAISE',
];

/** Where the player acts relative to the other live players on this street. */
export type PositionRelation = 'IP' | 'OOP';

export const POSITION_RELATIONS: readonly PositionRelation[] = ['IP', 'OOP'];

/** How many players are still contesting the pot at the decision point. */
export type LineupShape = 'HEADS_UP' | 'MULTIWAY';

export const LINEUP_SHAPES: readonly LineupShape[] = ['HEADS_UP', 'MULTIWAY'];

/** How the pot got to this street. Counted in voluntary preflop raises. */
export type PotType = 'LIMPED' | 'SINGLE_RAISED' | 'THREE_BET' | 'FOUR_BET_PLUS';

export const POT_TYPES: readonly PotType[] = [
  'LIMPED',
  'SINGLE_RAISED',
  'THREE_BET',
  'FOUR_BET_PLUS',
];

/**
 * Postflop bet size as a fraction of the pot BEFORE the bet. `NONE` means the player is
 * not facing a bet at all, which is a distinct bucket and not a zero-sized bet.
 *
 * Boundaries are a PRODUCT HEURISTIC for bucketing display and lookup; the exact milliBB
 * amount is always kept on the `BetSizeObservation` (prompt §19). They live in
 * `modelConfig.ts` so there is one place to change them.
 */
export type BetSizeBucket = 'NONE' | 'TINY' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'POT' | 'OVERBET';

export const BET_SIZE_BUCKETS: readonly BetSizeBucket[] = [
  'NONE',
  'TINY',
  'SMALL',
  'MEDIUM',
  'LARGE',
  'POT',
  'OVERBET',
];

/**
 * Preflop raise size, bucketed in big blinds of the raise-TO amount. `LIMP` is the
 * no-raise bucket. Boundaries are a PRODUCT HEURISTIC; see `modelConfig.ts`.
 */
export type PreflopSizeBucket = 'LIMP' | 'MIN' | 'SMALL' | 'STANDARD' | 'LARGE' | 'HUGE';

export const PREFLOP_SIZE_BUCKETS: readonly PreflopSizeBucket[] = [
  'LIMP',
  'MIN',
  'SMALL',
  'STANDARD',
  'LARGE',
  'HUGE',
];

/* -------------------------------------------------------------------------- */
/* Spot descriptors                                                            */
/* -------------------------------------------------------------------------- */

export interface PreflopSpot {
  readonly phase: 'PREFLOP';
  readonly family: PreflopSpotFamily;
  /** The acting player's own position. */
  readonly position: ObservedPosition;
  /**
   * The position of the player whose action created this situation — the opener facing a
   * defender, the 3-bettor facing the opener. `null` for `RFI`, `VS_LIMP` and
   * `BB_OPTION`, where nobody raised.
   */
  readonly opponentPosition: ObservedPosition | null;
  readonly lineup: LineupShape;
}

export interface PostflopSpot {
  readonly phase: 'POSTFLOP';
  readonly street: ObservedStreet;
  readonly family: PostflopSpotFamily;
  readonly position: ObservedPosition;
  readonly relation: PositionRelation;
  readonly lineup: LineupShape;
  readonly potType: PotType;
  /** `NONE` unless the player is facing a bet or raise. */
  readonly facingSize: BetSizeBucket;
}

export type SpotDescriptor = PreflopSpot | PostflopSpot;

/**
 * Total. The stable string key for a spot — the natural DB key and the label the brief's
 * examples use (`BTN_RFI`, `BB_VS_BTN_OPEN`, `HJ_OPEN_FACING_BTN_3BET`).
 *
 * The key is a lossy projection for display and grouping; the full `SpotDescriptor` is
 * always kept alongside it, so nothing has to parse a key back into dimensions.
 */
export function spotKey(spot: SpotDescriptor): string {
  if (spot.phase === 'PREFLOP') {
    const versus = spot.opponentPosition;
    switch (spot.family) {
      case 'RFI':
        return `${spot.position}_RFI`;
      case 'VS_LIMP':
        return `${spot.position}_VS_LIMP`;
      case 'BB_OPTION':
        return `${spot.position}_OPTION`;
      case 'VS_OPEN':
        return `${spot.position}_VS_${versus ?? 'UNKNOWN'}_OPEN`;
      case 'SQUEEZE':
        return `${spot.position}_SQUEEZE_VS_${versus ?? 'UNKNOWN'}`;
      case 'VS_THREE_BET':
        return `${spot.position}_OPEN_FACING_${versus ?? 'UNKNOWN'}_3BET`;
      case 'VS_FOUR_BET':
        return `${spot.position}_3BET_FACING_${versus ?? 'UNKNOWN'}_4BET`;
      case 'VS_MULTI_RAISE':
        return `${spot.position}_VS_MULTI_RAISE`;
    }
  }
  const size = spot.facingSize === 'NONE' ? '' : `_${spot.facingSize}`;
  return `${spot.street}_${spot.family}_${spot.position}_${spot.relation}_${spot.lineup}_${spot.potType}${size}`;
}

/* -------------------------------------------------------------------------- */
/* Global statistics                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The broad, HUD-shaped statistics. Every one of them is a pair of counts whose
 * denominator is a REAL opportunity count — see `analysis-core`'s `opportunities.ts` for
 * the exact rule behind each, and `docs/reports/C0C1_WP_C1A.md` for the table.
 *
 * These are a superset of `ObservedMetric` in name only: they are a separate vocabulary
 * for a separate (derived, snapshot-scoped) record type, and are never written into
 * `player_observations` (ADR-0062a). `ObservedMetric` and its DB CHECK are untouched.
 */
export type ModelStatKey =
  | 'VPIP'
  | 'PFR'
  | 'RFI'
  | 'STEAL_ATTEMPT'
  | 'FOLD_TO_STEAL'
  | 'THREE_BET'
  | 'FOLD_TO_THREE_BET'
  | 'FOUR_BET'
  | 'CBET_FLOP'
  | 'CBET_TURN'
  | 'CBET_RIVER'
  | 'FOLD_TO_CBET_FLOP'
  | 'FOLD_TO_CBET_TURN'
  | 'FOLD_TO_CBET_RIVER'
  | 'CHECK_RAISE_FLOP'
  | 'CHECK_RAISE_TURN'
  | 'CHECK_RAISE_RIVER'
  | 'TURN_BARREL'
  | 'RIVER_BARREL'
  | 'WTSD'
  | 'WSD';

export const MODEL_STAT_KEYS: readonly ModelStatKey[] = [
  'VPIP',
  'PFR',
  'RFI',
  'STEAL_ATTEMPT',
  'FOLD_TO_STEAL',
  'THREE_BET',
  'FOLD_TO_THREE_BET',
  'FOUR_BET',
  'CBET_FLOP',
  'CBET_TURN',
  'CBET_RIVER',
  'FOLD_TO_CBET_FLOP',
  'FOLD_TO_CBET_TURN',
  'FOLD_TO_CBET_RIVER',
  'CHECK_RAISE_FLOP',
  'CHECK_RAISE_TURN',
  'CHECK_RAISE_RIVER',
  'TURN_BARREL',
  'RIVER_BARREL',
  'WTSD',
  'WSD',
];

export const isModelStatKey = (value: string): value is ModelStatKey =>
  (MODEL_STAT_KEYS as readonly string[]).includes(value);

/**
 * One row of the global table. `position: null` is its OWN bucket meaning "every position
 * together" — it is not the sum of the six positional rows for display purposes and the
 * two are never added (ADR-0035). Both are emitted because a stat read positionally and
 * the same stat read overall are both useful and neither derives from the other without
 * re-scanning.
 */
export interface ModelStatCount {
  readonly key: ModelStatKey;
  readonly position: ObservedPosition | null;
  /** How many times the situation actually arose. The denominator and the sample. */
  readonly opportunities: number;
  /** How many times the player took the action. Never greater than `opportunities`. */
  readonly actions: number;
  readonly confidence: SnapshotConfidence;
}

/** One spot bucket, with the full action distribution inside it. */
export interface SpotStatCount {
  readonly spotKey: string;
  readonly spot: SpotDescriptor;
  /** Decisions the player actually faced in this bucket. */
  readonly opportunities: number;
  /**
   * Count per action EFFECT. Sums to `opportunities`. Kept as an explicit record rather
   * than a rate so a caller can compute any frequency it wants without a second pass.
   */
  readonly effects: Readonly<Record<ObservedActionEffect, number>>;
  /** Count per action VERB, so an all-in shove is still visible as one (rule 3). */
  readonly verbs: Readonly<Record<ObservedAction, number>>;
  readonly confidence: SnapshotConfidence;
}

/** Total. `actions / opportunities`, or `null` when nothing was observed. */
export const modelStatRate = (count: ModelStatCount): number | null =>
  count.opportunities === 0 ? null : count.actions / count.opportunities;

/** Total. Frequency of one action effect inside a spot bucket, or `null` when empty. */
export const spotEffectRate = (
  count: SpotStatCount,
  effect: ObservedActionEffect,
): number | null =>
  count.opportunities === 0 ? null : count.effects[effect] / count.opportunities;

/* -------------------------------------------------------------------------- */
/* Bet size observations                                                       */
/* -------------------------------------------------------------------------- */

/** Which sizing question this observation answers. */
export type BetSizeKind =
  | 'PREFLOP_OPEN'
  | 'PREFLOP_THREE_BET'
  | 'PREFLOP_FOUR_BET_PLUS'
  | 'POSTFLOP_BET'
  | 'POSTFLOP_RAISE';

export const BET_SIZE_KINDS: readonly BetSizeKind[] = [
  'PREFLOP_OPEN',
  'PREFLOP_THREE_BET',
  'PREFLOP_FOUR_BET_PLUS',
  'POSTFLOP_BET',
  'POSTFLOP_RAISE',
];

/**
 * One aggressive action, with the ACTUAL amounts preserved.
 *
 * Money is integer milliBB and is the source of truth (CLAUDE.md rule 1, prompt §19). The
 * fractions a caller wants — bet as a fraction of the pot, raise-to in big blinds — are
 * derived from these integers on demand by `betFractionOfPot` / `toAmountInBigBlinds`;
 * no float is stored.
 */
export interface BetSizeObservation {
  readonly handId: HandId;
  readonly playerId: PlayerId;
  readonly kind: BetSizeKind;
  readonly spotKey: string;
  /** The player's street contribution AFTER the action — raise-TO semantics. */
  readonly toAmount: number;
  /** Chips this action moved. */
  readonly amount: number;
  /** Total pot before the action. Zero is possible preflop only in a no-blind fixture. */
  readonly potBefore: number;
  /** The price the player had to match before acting; zero when opening a street. */
  readonly currentBetBefore: number;
  /** The hand's big blind, so the raise-TO can be read in BB without external context. */
  readonly bigBlind: number;
  readonly bucket: BetSizeBucket | PreflopSizeBucket;
}

/** Total. Bet as a fraction of the pot before it. `null` when the pot was empty. */
export const betFractionOfPot = (observation: BetSizeObservation): number | null =>
  observation.potBefore === 0 ? null : observation.amount / observation.potBefore;

/** Total. The raise-TO level in big blinds. `null` when the big blind is zero. */
export const toAmountInBigBlinds = (observation: BetSizeObservation): number | null =>
  observation.bigBlind === 0 ? null : observation.toAmount / observation.bigBlind;

/* -------------------------------------------------------------------------- */
/* Revealed-card evidence                                                      */
/* -------------------------------------------------------------------------- */

/** How a showdown ended for the player who showed. */
export type ShowOutcome = 'WON' | 'LOST' | 'UNKNOWN';

/**
 * A hand the player EXPLICITLY revealed.
 *
 * Built only from a `HOLE_CARDS_SET { revealed: true }` event (ADR-0052). A MUCK carries
 * no event at all and therefore produces no record here: its actions are known and its
 * cards are unknown, and the honest representation of unknown information is the absence
 * of a record. Nothing in this module ever infers, guesses or backfills a combo.
 *
 * `cards` is normally the two hole cards but is typed as a list because the engine's
 * `HOLE_CARDS_SET` accepts a partial reveal of one card; a partial reveal is preserved as
 * entered rather than dropped or padded.
 */
export interface ShowEvidence {
  readonly handId: HandId;
  readonly playerId: PlayerId;
  readonly position: ObservedPosition;
  /** The exact revealed cards, as entered. Length 1 or 2. */
  readonly cards: readonly Card[];
  /** The board as it finished, 0 / 3 / 4 / 5 cards. */
  readonly board: readonly Card[];
  /** The last street the player took an action on. */
  readonly lastStreet: 'PREFLOP' | ObservedStreet;
  /** Every spot key the player was observed in during this hand, in action order. */
  readonly spotKeys: readonly string[];
  readonly outcome: ShowOutcome;
  /** Gross chips won in this hand, in milliBB. Zero when the player won nothing. */
  readonly wonGross: number;
}

/* -------------------------------------------------------------------------- */
/* The snapshot                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Everything analysis computes for one player, minus the identity the persistence layer
 * owns (`modelVersion`, `createdAt`, the snapshot id). Split out so the engine can stay
 * clock-free and id-free (ADR-0040) while still producing the whole document.
 */
export interface PlayerModelContent {
  readonly playerId: PlayerId;
  readonly analysisAlgorithmVersion: number;
  /**
   * Deterministic identity of the raw input set. Equal hashes plus an equal algorithm
   * version mean an identical snapshot, which is what makes a repeated analysis run
   * report `NO_CHANGES` instead of writing a duplicate (ADR-0062c).
   */
  readonly inputHash: string;
  /** Eligible completed hands this player was dealt into. */
  readonly sourceHandCount: number;
  /** Total opportunities across every global stat and spot bucket. */
  readonly sourceObservationCount: number;
  /** Hands in which this player explicitly showed cards. */
  readonly sourceShowCount: number;
  /** Sorted by `key` then by position (the `null` bucket first). */
  readonly globalStats: readonly ModelStatCount[];
  /** Sorted by `spotKey`. */
  readonly spotStats: readonly SpotStatCount[];
  /** Sorted by `handId`. */
  readonly showEvidence: readonly ShowEvidence[];
  /** Sorted by `handId` then by the action's position in the hand. */
  readonly betSizes: readonly BetSizeObservation[];
  readonly confidence: SnapshotConfidenceMetadata;
}

/**
 * Snapshot-level confidence context. Per-situation confidence lives on each
 * `ModelStatCount` / `SpotStatCount`, because "1000 hands" says nothing about a spot that
 * arose 7 times (prompt §22).
 */
export interface SnapshotConfidenceMetadata {
  /** The `K` actually used, recorded so an old snapshot stays interpretable. */
  readonly k: number;
  readonly learningThreshold: number;
  readonly knownThreshold: number;
  /** Confidence in the overall sample: the hand count. */
  readonly overall: SnapshotConfidence;
}

/**
 * The persisted, immutable, versioned model (prompt §21).
 *
 * `modelVersion` increments per player and old snapshots are never overwritten
 * (ADR-0062c). `createdAt` is supplied by the caller, never read from a clock here
 * (ADR-0040).
 */
export interface PlayerModelSnapshot extends PlayerModelContent {
  /** Monotonic per player, starting at 1. */
  readonly modelVersion: number;
  readonly createdAt: Timestamp;
}
