/**
 * Per-player facts -> one deterministic model document.
 *
 * ADR-0062b: a snapshot is a FULL RECOMPUTATION from every eligible completed hand linked
 * to the player. There is no `previous + delta` arithmetic anywhere in this file, which is
 * what makes a second click of "세션 분석 및 반영" converge instead of doubling every count
 * (prompt §14).
 *
 * Determinism is a hard requirement, not a nicety: two runs over the same hands must
 * produce `JSON.stringify`-identical output, because that is how the persistence layer
 * decides whether a new snapshot is worth writing. So:
 *
 * - no clock, no RNG, no id generation — `modelVersion` and `createdAt` are the
 *   persistence layer's to supply (ADR-0040);
 * - every emitted list is explicitly sorted by a stable key, never left in Map order;
 * - the input order of `hands` does not affect the result, and `inputIdentityHash` sorts
 *   before hashing.
 */
import { ok, type PlayerId } from '@gto-self/shared';
import type { Hand } from '@gto-self/poker-core';
import {
  DEFAULT_PLAYER_MODEL_CONFIG,
  MODEL_STAT_KEYS,
  OBSERVED_POSITIONS,
  snapshotConfidence,
  validatePlayerModelConfig,
  type BetSizeObservation,
  type ModelStatCount,
  type ModelStatKey,
  type ObservedAction,
  type ObservedActionEffect,
  type ObservedPosition,
  type PlayerModelConfig,
  type PlayerModelContent,
  type ShowEvidence,
  type SpotDescriptor,
  type SpotStatCount,
} from '@gto-self/player-core';
import { analysisErr, type AnalysisResult } from './errors.js';
import { extractHandObservations, type PlayerHandObservations } from './extract.js';
import { inputIdentityHash } from './hash.js';
import { ANALYSIS_ALGORITHM_VERSION } from './version.js';

interface Tally {
  readonly key: ModelStatKey;
  readonly position: ObservedPosition | null;
  opportunities: number;
  actions: number;
}

interface SpotTally {
  spot: SpotDescriptor;
  opportunities: number;
  effects: Record<ObservedActionEffect, number>;
  verbs: Record<ObservedAction, number>;
}

const zeroEffects = (): Record<ObservedActionEffect, number> => ({
  FOLD: 0,
  CHECK: 0,
  CALL: 0,
  BET: 0,
  RAISE: 0,
});

const zeroVerbs = (): Record<ObservedAction, number> => ({
  FOLD: 0,
  CHECK: 0,
  CALL: 0,
  BET: 0,
  RAISE: 0,
  ALL_IN: 0,
});

/**
 * The global table is keyed by `stat + position`, where `position: null` is its OWN
 * bucket meaning "all positions together" (ADR-0035). The two are emitted side by side
 * and are never summed by a consumer: adding them double-counts the same decisions.
 */
const statKeyOf = (key: ModelStatKey, position: ObservedPosition | null): string =>
  `${key} ${position ?? ''}`;

const STAT_ORDER = new Map(MODEL_STAT_KEYS.map((key, index) => [key, index]));
const POSITION_ORDER = new Map(OBSERVED_POSITIONS.map((position, index) => [position, index + 1]));

export interface ComputePlayerModelOptions {
  readonly config?: PlayerModelConfig;
  /**
   * The algorithm version to stamp. Defaults to `ANALYSIS_ALGORITHM_VERSION`; exposed so a
   * test can pin it and so a future migration tool can recompute under an old number.
   */
  readonly algorithmVersion?: number;
}

/**
 * Total. Recomputes one player's whole model from their complete eligible hand set.
 *
 * `hands` must be that player's ENTIRE eligible set — every completed hand they were dealt
 * into (ADR-0062b). The returned `inputHash` identifies exactly the set that was passed
 * in, so passing a partial set produces a snapshot that honestly describes a partial set,
 * not a wrong one; the caller owns the "which hands are eligible" question.
 *
 * Hands the player was not dealt into are tolerated and contribute nothing but are still
 * part of the input identity — pass the linked set, not the whole database, or a repeated
 * run over a different superset will look like a change when nothing changed.
 *
 * Rejects a duplicated hand id (it would double-count that hand) and any hand that is not
 * `COMPLETE`.
 */
export function computePlayerModel(
  playerId: PlayerId,
  hands: readonly Hand[],
  options: ComputePlayerModelOptions = {},
): AnalysisResult<PlayerModelContent> {
  const config = options.config ?? DEFAULT_PLAYER_MODEL_CONFIG;
  const validated = validatePlayerModelConfig(config);
  if (!validated.ok) {
    return analysisErr('INVALID_CONFIG', validated.error.message, {
      field: validated.error.context.field,
      domainCode: validated.error.code,
    });
  }

  const handIds: string[] = [];
  const seen = new Set<string>();
  for (const hand of hands) {
    const id = hand.state.handId;
    if (seen.has(id)) {
      return analysisErr('DUPLICATE_HAND', `hand ${id} appears more than once in the input set`, {
        handId: id,
        playerId,
      });
    }
    seen.add(id);
    handIds.push(id);
  }

  const stats = new Map<string, Tally>();
  const spots = new Map<string, SpotTally>();
  const showEvidence: ShowEvidence[] = [];
  const betSizes: BetSizeObservation[] = [];
  let sourceHandCount = 0;
  let observationCount = 0;

  for (const hand of hands) {
    const extracted = extractHandObservations(hand, config);
    if (!extracted.ok) return extracted;

    for (const player of extracted.value.players) {
      if (player.playerId !== playerId) continue;
      sourceHandCount += 1;
      accumulate(player, stats, spots);
      observationCount += player.spots.length;
      if (player.show !== null) showEvidence.push(player.show);
      betSizes.push(...player.betSizes);
    }
  }

  const globalStats: ModelStatCount[] = [];
  for (const tally of stats.values()) {
    globalStats.push({
      key: tally.key,
      position: tally.position,
      opportunities: tally.opportunities,
      actions: tally.actions,
      confidence: snapshotConfidence(tally.opportunities, config.snapshotConfidence),
    });
  }
  globalStats.sort((a, b) => {
    const byKey = (STAT_ORDER.get(a.key) ?? 0) - (STAT_ORDER.get(b.key) ?? 0);
    if (byKey !== 0) return byKey;
    const aPos = a.position === null ? 0 : (POSITION_ORDER.get(a.position) ?? 0);
    const bPos = b.position === null ? 0 : (POSITION_ORDER.get(b.position) ?? 0);
    return aPos - bPos;
  });

  const spotStats: SpotStatCount[] = [...spots.entries()]
    .map(([key, tally]) => ({
      spotKey: key,
      spot: tally.spot,
      opportunities: tally.opportunities,
      effects: tally.effects,
      verbs: tally.verbs,
      confidence: snapshotConfidence(tally.opportunities, config.snapshotConfidence),
    }))
    .sort((a, b) => (a.spotKey < b.spotKey ? -1 : a.spotKey > b.spotKey ? 1 : 0));

  showEvidence.sort((a, b) => (a.handId < b.handId ? -1 : a.handId > b.handId ? 1 : 0));
  // A STABLE sort by hand id: within one hand the observations stay in decision order,
  // and across hands the caller's input order stops mattering. Both halves are needed for
  // "same hands, any order -> identical document".
  betSizes.sort((a, b) => (a.handId < b.handId ? -1 : a.handId > b.handId ? 1 : 0));

  return ok({
    playerId,
    analysisAlgorithmVersion: options.algorithmVersion ?? ANALYSIS_ALGORITHM_VERSION,
    inputHash: inputIdentityHash(handIds),
    sourceHandCount,
    sourceObservationCount: observationCount,
    sourceShowCount: showEvidence.length,
    globalStats,
    spotStats,
    showEvidence,
    betSizes,
    confidence: {
      k: config.snapshotConfidence.k,
      learningThreshold: config.snapshotConfidence.learningThreshold,
      knownThreshold: config.snapshotConfidence.knownThreshold,
      overall: snapshotConfidence(sourceHandCount, config.snapshotConfidence),
    },
  });
}

/** Internal. Folds one hand's facts for one player into the running tallies. */
function accumulate(
  player: PlayerHandObservations,
  stats: Map<string, Tally>,
  spots: Map<string, SpotTally>,
): void {
  for (const event of player.stats) {
    // Every stat is recorded twice: once in its positional bucket and once in the
    // all-positions bucket. They are separate buckets, never summands of each other.
    for (const position of [null, player.position] as const) {
      const key = statKeyOf(event.key, position);
      const tally = stats.get(key) ?? {
        key: event.key,
        position,
        opportunities: 0,
        actions: 0,
      };
      tally.opportunities += 1;
      if (event.taken) tally.actions += 1;
      stats.set(key, tally);
    }
  }

  for (const observation of player.spots) {
    const tally = spots.get(observation.spotKey) ?? {
      spot: observation.spot,
      opportunities: 0,
      effects: zeroEffects(),
      verbs: zeroVerbs(),
    };
    tally.opportunities += 1;
    tally.effects[observation.effect] += 1;
    tally.verbs[observation.verb] += 1;
    spots.set(observation.spotKey, tally);
  }
}

/**
 * Total. Every distinct identified player in a hand set, sorted, so an orchestrator can
 * discover the scope of a run without re-implementing the extraction.
 */
export function playersInHands(hands: readonly Hand[]): readonly PlayerId[] {
  const found = new Set<PlayerId>();
  for (const hand of hands) {
    for (const seat of hand.state.dealtInSeats) {
      const playerId = hand.state.seats[seat].playerId;
      if (playerId !== null) found.add(playerId);
    }
  }
  return [...found].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
