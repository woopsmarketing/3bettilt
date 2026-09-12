/**
 * The opponent adjustment profile: pooled readings, shrunk toward the neutral anchor.
 *
 * This module is CONTROL FLOW AND INTEGER ARITHMETIC ONLY. Every model number it uses comes
 * from `priors.ts`; the confidence curve and the display state come from
 * `@gto-self/player-core` (`confidenceWeightBps`, `snapshotConfidenceState`) and are reused
 * rather than re-implemented — the C1 snapshot framework is extended per stat, not forked
 * (working agreement 7). If a K or an anchor is wrong, the fix is a data edit in `priors.ts`
 * and nothing in this file changes.
 *
 * ---------------------------------------------------------------------------------------
 * THE FORMULA (WP-J design contract §3.3), integer basis points end to end
 *
 * ```
 *   nM, vM   = MANUAL_HUD sample / value       (absent -> contributes nothing)
 *   nL, vL   = LEARNED_MODEL sample / value    (absent -> contributes nothing)
 *   n        = nM + nL
 *   observed = n === 0 ? prior : round((vM*nM + vL*nL) / n)     // sample-weighted mean
 *   confBps  = confidenceWeightBps(n, K)                        // round(10000*n/(n+K))
 *   estimate = round((prior*(10000-confBps) + observed*confBps) / 10000)
 *   deviation= estimate - prior
 * ```
 *
 * Read the two ends of it. At `n = 0`, `confBps = 0` and `estimate = prior` exactly, so the
 * deviation every policy rule fires on is 0 and ADAPTIVE degenerates to REFERENCE. As `n`
 * grows, `confBps` approaches 10000 and `estimate` approaches the pooled reading. There is
 * no threshold at which the behaviour jumps; the anchor is released continuously.
 *
 * `EXTERNAL_HUD` (WP-K, ADR-0067) does NOT go through this formula. When a reading exists
 * for a stat from `EXTERNAL_HUD`, it is used ALONE at a fixed `EXTERNAL_HUD_CONFIDENCE_BPS`
 * and `MANUAL_HUD`/`LEARNED_MODEL` are left out of the estimate for that stat — see
 * `estimateFor`'s own doc comment for why (its `sampleN` is always 0, by design).
 *
 * NO FLOATS. Both `round(a / b)` steps go through `roundDivNonNegative`, which is
 * `Math.round(a / b)` for non-negative integers computed with integer operations only, so
 * the result is bit-identical on every machine and a profile can be compared as a string
 * across runs. That is the same technique, and the same reason, as
 * `player-core`'s `confidenceWeightBps`.
 *
 * TOTAL. `buildAdjustmentProfile` never throws and never rejects. Malformed numbers are
 * sanitized at the door (documented below); duplicate readings are resolved, not dropped
 * silently; unknown stat keys are unrepresentable in the output because the output is built
 * by iterating `ADAPTIVE_STAT_KEYS`, not by iterating the input.
 * ---------------------------------------------------------------------------------------
 */
import {
  confidenceWeightBps,
  snapshotConfidenceState,
  type SnapshotConfidenceState,
} from '@gto-self/player-core';
import { BPS_TOTAL, clampBps } from '@gto-self/strategy-core';
import type { AdaptiveOpponentInput, AdaptiveStatObservation } from './inputs.js';
import {
  ADAPTIVE_KNOWN_THRESHOLD,
  ADAPTIVE_LEARNING_THRESHOLD,
  EXTERNAL_HUD_CONFIDENCE_BPS,
  kFor,
  priorBpsFor,
} from './priors.js';
import {
  ADAPTIVE_STAT_KEYS,
  ADAPTIVE_STAT_SOURCES,
  type AdaptiveStatKey,
  type AdaptiveStatSource,
} from './stats.js';

/* -------------------------------------------------------------------------- */
/* Output shape                                                                */
/* -------------------------------------------------------------------------- */

/**
 * One SOURCE's own reading, retained after pooling.
 *
 * Manual and learned readings are pooled into a single `observedBps`, but the two rows that
 * produced it survive here with their own value, their own sample and their own caveat. The
 * UI and the stored trace can therefore always answer "where did this come from" without
 * re-deriving anything, and a pooled number can never quietly become the only record of a
 * reading the user typed in (CLAUDE.md rule 3).
 */
export interface AdaptiveStatSourceRef {
  readonly source: AdaptiveStatSource;
  readonly valueBps: number;
  readonly sampleN: number;
  readonly note: string | null;
}

/** One stat's whole story: the anchor, the reading, the blend, and the evidence behind it. */
export interface AdaptiveStatEstimate {
  readonly key: AdaptiveStatKey;
  /** The zero-adjustment anchor from `ADAPTIVE_PRIORS`. */
  readonly priorBps: number;
  /** The sample-weighted pooled reading, or `priorBps` when there is no sample at all. */
  readonly observedBps: number;
  /** The anchor released toward the reading in proportion to `confidenceBps`. */
  readonly estimateBps: number;
  /** `estimateBps - priorBps`. The ONLY quantity a policy rule is allowed to read. */
  readonly deviationBps: number;
  /** Pooled denominator across every source. */
  readonly sampleN: number;
  /** `round(10000 * n / (n + k))`. 0..10000. */
  readonly confidenceBps: number;
  /** The display bucket. `UNKNOWN` is "no knowledge", never "a little knowledge". */
  readonly confidenceState: SnapshotConfidenceState;
  /** The `K` actually applied, so an old stored profile stays interpretable. */
  readonly k: number;
  /** Every contributing source, in `ADAPTIVE_STAT_SOURCES` order. */
  readonly sources: readonly AdaptiveStatSourceRef[];
  /** `false` when NO source supplied this stat at all. A source with `sampleN 0` is still
   *  a source: it was supplied, we simply give it no weight. */
  readonly available: boolean;
}

/** Every stat we are allowed to know about one opponent, plus the provenance of the lot. */
export interface PlayerAdjustmentProfile {
  readonly playerId: string;
  readonly seatIndex: number;
  readonly nickname: string | null;
  /** All 17 keys, always, in `ADAPTIVE_STAT_KEYS` order. */
  readonly stats: Readonly<Record<AdaptiveStatKey, AdaptiveStatEstimate>>;
  readonly manualHudSnapshotId: string | null;
  readonly learnedSnapshotId: string | null;
  readonly learnedModelVersion: number | null;
  /** Sum of `sampleN` over all 17 stats — the total evidence behind this whole profile. */
  readonly totalObservedSampleN: number;
}

/* -------------------------------------------------------------------------- */
/* Sanitization and integer helpers                                            */
/* -------------------------------------------------------------------------- */

/**
 * The largest sample size the arithmetic will use.
 *
 * This is a NUMERIC SAFETY BOUND, not a product heuristic (the product cap on a HUD's hand
 * count is `MANUAL_HUD_MAX_EFFECTIVE_N`, applied by the caller). The widest intermediate
 * this module forms is `2 * BPS_TOTAL * n` inside `roundDivNonNegative`, so at 1e8 the peak
 * is 2e12 — three orders of magnitude inside `Number.MAX_SAFE_INTEGER`, which keeps every
 * step exact. A real opportunity count reaches nowhere near it; the bound exists so that a
 * corrupt or hostile input degrades to a large-but-exact number instead of to a silently
 * wrong one.
 */
export const ADAPTIVE_MAX_SAMPLE_N = 100_000_000;

/**
 * Recorded on a source ref when the input supplied more than one reading for the same
 * `(key, source)` pair. The LAST reading wins — a caller that appends a fresher row is the
 * expected shape — but the collision is never silent: it is visible in the note, which the
 * UI shows verbatim and the trace stores.
 */
export const DUPLICATE_SOURCE_NOTE = 'duplicate reading for this stat and source; last used';

/**
 * Total. `Math.round(numerator / denominator)` for non-negative integers, with no float.
 *
 * `floor((2a + b) / 2b)` is round-half-up, which is what `Math.round` does for non-negative
 * values. Both call sites are non-negative by construction (a weighted mean of values in
 * 0..10000, and a convex blend of two such values), and the guard below is the tripwire if
 * that ever stops being true.
 */
function roundDivNonNegative(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  if (numerator <= 0) return 0;
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

/** Total. A reading forced into an integer 0..10000. Reuses `strategy-core`'s own guard. */
const sanitizeValueBps = (value: number): number => clampBps(value);

/**
 * Total. A denominator forced into an integer `0..ADAPTIVE_MAX_SAMPLE_N`.
 *
 * `Math.floor` rather than `Math.round`: a fractional sample size is malformed input, and
 * rounding it up would claim one observation we were not told about.
 */
function sanitizeSampleN(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const floored = Math.floor(value);
  return floored > ADAPTIVE_MAX_SAMPLE_N ? ADAPTIVE_MAX_SAMPLE_N : floored;
}

/* -------------------------------------------------------------------------- */
/* Building the profile                                                        */
/* -------------------------------------------------------------------------- */

/** A surviving reading plus the number of earlier readings it superseded. */
interface Reading {
  readonly valueBps: number;
  readonly sampleN: number;
  readonly note: string | null;
  readonly superseded: number;
}

/** Total. Composes the duplicate marker onto a caveat without destroying the caveat. */
function noteWithDuplicates(note: string | null, superseded: number): string | null {
  if (superseded <= 0) return note;
  const marker = `${DUPLICATE_SOURCE_NOTE} (superseded ${superseded})`;
  return note === null ? marker : `${note} · ${marker}`;
}

/**
 * Total. Indexes the observations by `(key, source)`, keeping the LAST of each collision.
 *
 * The result is keyed by the two closed unions, so an observation whose `key` or `source` is
 * not a member — only reachable from untyped data at a boundary — simply never appears in
 * the output, which is built by iterating `ADAPTIVE_STAT_KEYS`. It cannot invent an
 * eighteenth stat, and it cannot throw.
 */
function indexObservations(
  observations: readonly AdaptiveStatObservation[],
): ReadonlyMap<AdaptiveStatKey, ReadonlyMap<AdaptiveStatSource, Reading>> {
  const byKey = new Map<AdaptiveStatKey, Map<AdaptiveStatSource, Reading>>();
  for (const observation of observations) {
    let bySource = byKey.get(observation.key);
    if (bySource === undefined) {
      bySource = new Map<AdaptiveStatSource, Reading>();
      byKey.set(observation.key, bySource);
    }
    const previous = bySource.get(observation.source);
    bySource.set(observation.source, {
      valueBps: sanitizeValueBps(observation.valueBps),
      sampleN: sanitizeSampleN(observation.sampleN),
      note: observation.note,
      superseded: previous === undefined ? 0 : previous.superseded + 1,
    });
  }
  return byKey;
}

/**
 * Total. The estimate for one stat, given the readings that survived indexing.
 *
 * `EXTERNAL_HUD` TAKES PRECEDENCE, PER STAT (ADR-0067): when a reading exists for `key`
 * from `EXTERNAL_HUD`, it is used ALONE, at the fixed `EXTERNAL_HUD_CONFIDENCE_BPS`, and any
 * `MANUAL_HUD`/`LEARNED_MODEL` reading for the SAME stat is left out of both the pooled
 * value and `sources` — it did not contribute, so it is not listed as if it had. This is
 * NOT the `n/(n+K)` formula the other two sources share: an external profile's `sampleN`
 * is always 0 here (`adaptive-service.ts` never invents one), so running it through that
 * formula would collapse its confidence to 0 by construction. `MANUAL_HUD`/`LEARNED_MODEL`
 * pooling below is exactly WP-J's original formula, untouched, and only reached when this
 * stat has no `EXTERNAL_HUD` reading.
 */
function estimateFor(
  key: AdaptiveStatKey,
  bySource: ReadonlyMap<AdaptiveStatSource, Reading> | undefined,
): AdaptiveStatEstimate {
  const priorBps = priorBpsFor(key);
  const k = kFor(key);

  const external = bySource?.get('EXTERNAL_HUD');
  if (external !== undefined) {
    const confidenceBps = EXTERNAL_HUD_CONFIDENCE_BPS;
    const estimateBps = roundDivNonNegative(
      priorBps * (BPS_TOTAL - confidenceBps) + external.valueBps * confidenceBps,
      BPS_TOTAL,
    );
    return {
      key,
      priorBps,
      observedBps: external.valueBps,
      estimateBps,
      deviationBps: estimateBps - priorBps,
      sampleN: external.sampleN,
      confidenceBps,
      // A fixed policy confidence has no learning curve to be partway through — it reads
      // as `KNOWN`, the same state a fully mature pooled reading would eventually reach.
      confidenceState: 'KNOWN',
      k,
      sources: [
        {
          source: 'EXTERNAL_HUD',
          valueBps: external.valueBps,
          sampleN: external.sampleN,
          note: noteWithDuplicates(external.note, external.superseded),
        },
      ],
      available: true,
    };
  }

  // Emitted in `ADAPTIVE_STAT_SOURCES` order, never in arrival order, so two inputs that
  // differ only in how the observations were ordered produce identical output.
  const sources: AdaptiveStatSourceRef[] = [];
  let weightedSum = 0;
  let sampleN = 0;
  for (const source of ADAPTIVE_STAT_SOURCES) {
    if (source === 'EXTERNAL_HUD') continue;
    const reading = bySource?.get(source);
    if (reading === undefined) continue;
    sources.push({
      source,
      valueBps: reading.valueBps,
      sampleN: reading.sampleN,
      note: noteWithDuplicates(reading.note, reading.superseded),
    });
    weightedSum += reading.valueBps * reading.sampleN;
    sampleN += reading.sampleN;
  }

  const available = sources.length > 0;
  // `n === 0` is the honest case, not a degenerate one: no denominator means no reading, so
  // the pooled value IS the anchor and the deviation below is exactly 0.
  const observedBps = sampleN === 0 ? priorBps : roundDivNonNegative(weightedSum, sampleN);
  const confidenceBps = confidenceWeightBps(sampleN, k);
  const estimateBps = roundDivNonNegative(
    priorBps * (BPS_TOTAL - confidenceBps) + observedBps * confidenceBps,
    BPS_TOTAL,
  );

  return {
    key,
    priorBps,
    observedBps,
    estimateBps,
    deviationBps: estimateBps - priorBps,
    sampleN,
    confidenceBps,
    confidenceState: snapshotConfidenceState(sampleN, {
      k,
      learningThreshold: ADAPTIVE_LEARNING_THRESHOLD,
      knownThreshold: ADAPTIVE_KNOWN_THRESHOLD,
    }),
    k,
    sources,
    available,
  };
}

/**
 * Total. Builds one opponent's adjustment profile. Never throws, never rejects, never reads
 * a clock or a random source, and produces the same bytes for the same input every time.
 *
 * All 20 stats are always present. A stat no source supplied gets `available: false`,
 * `observedBps === estimateBps === priorBps`, `sampleN 0`, `confidenceBps 0`,
 * `deviationBps 0` and no sources — which is exactly the state in which every downstream
 * rule contributes nothing.
 */
export function buildAdjustmentProfile(input: AdaptiveOpponentInput): PlayerAdjustmentProfile {
  const indexed = indexObservations(input.observations);

  // Built by mutation into a plain object and then frozen into the readonly record: the key
  // order is `ADAPTIVE_STAT_KEYS`' order, which is what makes `JSON.stringify` of a profile
  // a stable digest.
  const stats: Partial<Record<AdaptiveStatKey, AdaptiveStatEstimate>> = {};
  let totalObservedSampleN = 0;
  for (const key of ADAPTIVE_STAT_KEYS) {
    const estimate = estimateFor(key, indexed.get(key));
    stats[key] = estimate;
    totalObservedSampleN += estimate.sampleN;
  }

  return {
    playerId: input.playerId,
    seatIndex: input.seatIndex,
    nickname: input.nickname,
    // `ADAPTIVE_STAT_KEYS` is exhaustive over `AdaptiveStatKey` and the loop above assigns
    // every one of them, so the `Partial` is full here. The assertion is the one place that
    // fact is stated; a missing key would be caught by `everyKeyPresent` in the tests.
    stats: stats as Readonly<Record<AdaptiveStatKey, AdaptiveStatEstimate>>,
    manualHudSnapshotId: input.manualHudSnapshotId,
    learnedSnapshotId: input.learnedSnapshotId,
    learnedModelVersion: input.learnedModelVersion,
    totalObservedSampleN,
  };
}

/**
 * Total. An input with no observations at all, for the caller that has a seat but no player
 * data yet. Building a profile from it yields 20 unavailable stats and zero deviation
 * everywhere, which is the identity element of the whole ADAPTIVE layer.
 */
export function emptyOpponentInput(
  playerId: string,
  seatIndex: number,
  nickname: string | null = null,
): AdaptiveOpponentInput {
  return {
    playerId,
    seatIndex,
    nickname,
    observations: [],
    manualHudSnapshotId: null,
    manualHudRecordedAt: null,
    learnedSnapshotId: null,
    learnedModelVersion: null,
    externalHudSnapshotId: null,
    externalHudRecordedAt: null,
  };
}
