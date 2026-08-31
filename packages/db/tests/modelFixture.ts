/**
 * A rich `PlayerModelContent` literal, built by hand.
 *
 * It is a LITERAL and not the output of `analysis-core` on purpose: `packages/db` is
 * forbidden to import `@gto-self/analysis-core` (ADR-0061, enforced by ESLint), and that ban
 * applies to tests as much as to `src/`. Building the document by hand also lets this
 * fixture cover shapes a real fixture session would rarely produce all at once, which is
 * what a persistence round-trip has to survive:
 *
 * - EVERY `ModelStatKey`, in the `null`-position bucket, plus the six positional rows for
 *   two of them — the two kinds of row that must never be merged (ADR-0035).
 * - Every preflop spot family (with and without an `opponentPosition`) and every postflop
 *   family, street, relation, lineup, pot type, and a `facingSize` of `NONE` as well as
 *   sized ones.
 * - Every `BetSizeKind`, with buckets drawn from BOTH bucket vocabularies.
 * - Show evidence with TWO cards and a full board, and evidence with ONE card and NO board
 *   (a legal partial reveal — `HOLE_CARDS_SET` accepts one card).
 *
 * The `player-core` types are used directly, so a field added to the domain breaks this
 * file at compile time rather than being silently dropped by the persistence layer.
 */
import { unwrap, parseCards, type Card, type HandId, type PlayerId } from '@gto-self/shared';
import {
  DEFAULT_SNAPSHOT_CONFIDENCE_CONFIG,
  MODEL_STAT_KEYS,
  OBSERVED_POSITIONS,
  snapshotConfidence,
  spotKey,
  type BetSizeObservation,
  type ModelStatCount,
  type ObservedAction,
  type ObservedActionEffect,
  type ObservedPosition,
  type PlayerModelContent,
  type ShowEvidence,
  type SpotDescriptor,
  type SpotStatCount,
} from '@gto-self/player-core';

const CONFIG = DEFAULT_SNAPSHOT_CONFIDENCE_CONFIG;

const cards = (text: string): readonly Card[] => unwrap(parseCards(text));

const stat = (
  key: (typeof MODEL_STAT_KEYS)[number],
  position: ObservedPosition | null,
  opportunities: number,
  actions: number,
): ModelStatCount => ({
  key,
  position,
  opportunities,
  actions,
  confidence: snapshotConfidence(opportunities, CONFIG),
});

/** Effects in `OBSERVED_ACTION_EFFECTS` order; the record must sum to `opportunities`. */
const effects = (
  fold: number,
  check: number,
  call: number,
  bet: number,
  raise: number,
): Readonly<Record<ObservedActionEffect, number>> => ({
  FOLD: fold,
  CHECK: check,
  CALL: call,
  BET: bet,
  RAISE: raise,
});

/** Verbs in `OBSERVED_ACTIONS` order; the record must sum to `opportunities` too. */
const verbs = (
  fold: number,
  check: number,
  call: number,
  bet: number,
  raise: number,
  allIn: number,
): Readonly<Record<ObservedAction, number>> => ({
  FOLD: fold,
  CHECK: check,
  CALL: call,
  BET: bet,
  RAISE: raise,
  ALL_IN: allIn,
});

function spotCount(
  spot: SpotDescriptor,
  effectCounts: Readonly<Record<ObservedActionEffect, number>>,
  verbCounts: Readonly<Record<ObservedAction, number>>,
): SpotStatCount {
  const opportunities = Object.values(effectCounts).reduce((sum, value) => sum + value, 0);
  return {
    spotKey: spotKey(spot),
    spot,
    opportunities,
    effects: effectCounts,
    verbs: verbCounts,
    confidence: snapshotConfidence(opportunities, CONFIG),
  };
}

export interface ModelContentOptions {
  readonly playerId: PlayerId;
  /** Two DISTINCT hands that already exist in `hands` — the child tables key on them. */
  readonly handIds: readonly [HandId, HandId];
  readonly inputHash?: string;
  readonly algorithmVersion?: number;
  readonly sourceHandCount?: number;
}

/** A deterministic, deliberately awkward model document. */
export function buildModelContent(options: ModelContentOptions): PlayerModelContent {
  const { playerId } = options;
  const [handA, handB] = options.handIds;

  const globalStats: ModelStatCount[] = [];
  MODEL_STAT_KEYS.forEach((key, index) => {
    const opportunities = 3 + index * 2;
    globalStats.push(stat(key, null, opportunities, index % (opportunities + 1)));
    // Two keys also carry the full positional breakdown. They are SEPARATE buckets over the
    // same decisions and are never summed with the row above (ADR-0035).
    if (key === 'VPIP' || key === 'CBET_FLOP') {
      OBSERVED_POSITIONS.forEach((position, seat) => {
        globalStats.push(stat(key, position, seat + 1, seat));
      });
    }
  });

  const spots: SpotStatCount[] = [
    spotCount(
      {
        phase: 'PREFLOP',
        family: 'RFI',
        position: 'BTN',
        opponentPosition: null,
        lineup: 'HEADS_UP',
      },
      effects(4, 0, 1, 0, 7),
      verbs(4, 0, 1, 0, 6, 1),
    ),
    spotCount(
      {
        phase: 'PREFLOP',
        family: 'VS_LIMP',
        position: 'CO',
        opponentPosition: null,
        lineup: 'MULTIWAY',
      },
      effects(1, 0, 2, 0, 3),
      verbs(1, 0, 2, 0, 3, 0),
    ),
    spotCount(
      {
        phase: 'PREFLOP',
        family: 'BB_OPTION',
        position: 'BB',
        opponentPosition: null,
        lineup: 'MULTIWAY',
      },
      effects(0, 5, 0, 0, 1),
      verbs(0, 5, 0, 0, 1, 0),
    ),
    spotCount(
      {
        phase: 'PREFLOP',
        family: 'VS_OPEN',
        position: 'BB',
        opponentPosition: 'BTN',
        lineup: 'HEADS_UP',
      },
      effects(9, 0, 4, 0, 2),
      verbs(9, 0, 4, 0, 1, 1),
    ),
    spotCount(
      {
        phase: 'PREFLOP',
        family: 'SQUEEZE',
        position: 'BB',
        opponentPosition: 'CO',
        lineup: 'MULTIWAY',
      },
      effects(2, 0, 1, 0, 1),
      verbs(2, 0, 1, 0, 1, 0),
    ),
    spotCount(
      {
        phase: 'PREFLOP',
        family: 'VS_THREE_BET',
        position: 'HJ',
        opponentPosition: 'BTN',
        lineup: 'HEADS_UP',
      },
      effects(3, 0, 2, 0, 1),
      verbs(3, 0, 2, 0, 0, 1),
    ),
    spotCount(
      {
        phase: 'PREFLOP',
        family: 'VS_FOUR_BET',
        position: 'BTN',
        opponentPosition: 'HJ',
        lineup: 'HEADS_UP',
      },
      effects(1, 0, 1, 0, 0),
      verbs(1, 0, 1, 0, 0, 0),
    ),
    spotCount(
      {
        phase: 'PREFLOP',
        family: 'VS_MULTI_RAISE',
        position: 'SB',
        opponentPosition: null,
        lineup: 'MULTIWAY',
      },
      effects(1, 0, 0, 0, 0),
      verbs(1, 0, 0, 0, 0, 0),
    ),
    spotCount(
      {
        phase: 'POSTFLOP',
        street: 'FLOP',
        family: 'CBET',
        position: 'BTN',
        relation: 'IP',
        lineup: 'HEADS_UP',
        potType: 'SINGLE_RAISED',
        facingSize: 'NONE',
      },
      effects(0, 6, 0, 11, 0),
      verbs(0, 6, 0, 10, 0, 1),
    ),
    spotCount(
      {
        phase: 'POSTFLOP',
        street: 'FLOP',
        family: 'DONK_LEAD',
        position: 'BB',
        relation: 'OOP',
        lineup: 'HEADS_UP',
        potType: 'LIMPED',
        facingSize: 'NONE',
      },
      effects(0, 4, 0, 2, 0),
      verbs(0, 4, 0, 2, 0, 0),
    ),
    spotCount(
      {
        phase: 'POSTFLOP',
        street: 'FLOP',
        family: 'CHECKED_TO',
        position: 'CO',
        relation: 'IP',
        lineup: 'MULTIWAY',
        potType: 'THREE_BET',
        facingSize: 'NONE',
      },
      effects(0, 3, 0, 1, 0),
      verbs(0, 3, 0, 1, 0, 0),
    ),
    spotCount(
      {
        phase: 'POSTFLOP',
        street: 'TURN',
        family: 'FACING_CBET',
        position: 'BB',
        relation: 'OOP',
        lineup: 'MULTIWAY',
        potType: 'THREE_BET',
        facingSize: 'MEDIUM',
      },
      effects(5, 0, 3, 0, 1),
      verbs(5, 0, 3, 0, 1, 0),
    ),
    spotCount(
      {
        phase: 'POSTFLOP',
        street: 'TURN',
        family: 'FACING_BET',
        position: 'SB',
        relation: 'OOP',
        lineup: 'HEADS_UP',
        potType: 'SINGLE_RAISED',
        facingSize: 'SMALL',
      },
      effects(2, 0, 2, 0, 0),
      verbs(2, 0, 2, 0, 0, 0),
    ),
    spotCount(
      {
        phase: 'POSTFLOP',
        street: 'RIVER',
        family: 'FACING_RAISE',
        position: 'UTG',
        relation: 'IP',
        lineup: 'HEADS_UP',
        potType: 'FOUR_BET_PLUS',
        facingSize: 'OVERBET',
      },
      effects(1, 0, 1, 0, 1),
      verbs(1, 0, 1, 0, 0, 1),
    ),
  ];
  // The engine emits `spotStats` sorted by `spotKey`; the fixture matches, so the
  // round-trip assertion is over a realistic document rather than an accidental order.
  const spotStats = [...spots].sort((a, b) => (a.spotKey < b.spotKey ? -1 : 1));

  const betSizes: readonly BetSizeObservation[] = [
    {
      handId: handA,
      playerId,
      kind: 'PREFLOP_OPEN',
      spotKey: 'BTN_RFI',
      toAmount: 2_500,
      amount: 2_500,
      potBefore: 1_660,
      currentBetBefore: 1_000,
      bigBlind: 1_000,
      bucket: 'SMALL',
    },
    {
      handId: handA,
      playerId,
      kind: 'POSTFLOP_BET',
      spotKey: 'FLOP_CBET_BTN_IP_HEADS_UP_SINGLE_RAISED',
      toAmount: 3_000,
      amount: 3_000,
      potBefore: 6_660,
      currentBetBefore: 0,
      bigBlind: 1_000,
      bucket: 'SMALL',
    },
    {
      handId: handB,
      playerId,
      kind: 'PREFLOP_THREE_BET',
      spotKey: 'BB_VS_BTN_OPEN',
      toAmount: 9_000,
      amount: 8_000,
      potBefore: 4_160,
      currentBetBefore: 2_500,
      bigBlind: 1_000,
      bucket: 'HUGE',
    },
    {
      handId: handB,
      playerId,
      kind: 'PREFLOP_FOUR_BET_PLUS',
      spotKey: 'BTN_3BET_FACING_HJ_4BET',
      toAmount: 22_000,
      amount: 13_000,
      potBefore: 19_160,
      currentBetBefore: 9_000,
      bigBlind: 1_000,
      bucket: 'HUGE',
    },
    {
      handId: handB,
      playerId,
      kind: 'POSTFLOP_RAISE',
      spotKey: 'RIVER_FACING_RAISE_UTG_IP_HEADS_UP_FOUR_BET_PLUS_OVERBET',
      toAmount: 60_000,
      amount: 45_000,
      potBefore: 44_000,
      currentBetBefore: 15_000,
      bigBlind: 1_000,
      bucket: 'OVERBET',
    },
  ];

  const showEvidence: readonly ShowEvidence[] = [
    {
      handId: handA,
      playerId,
      position: 'BTN',
      cards: cards('As Kd'),
      board: cards('Ah 7d 2c 9s 3h'),
      lastStreet: 'RIVER',
      spotKeys: ['BTN_RFI', 'FLOP_CBET_BTN_IP_HEADS_UP_SINGLE_RAISED'],
      outcome: 'WON',
      wonGross: 41_500,
    },
    {
      // A LEGAL one-card reveal, on a hand that never saw a flop.
      handId: handB,
      playerId,
      position: 'BB',
      cards: cards('Qh'),
      board: [],
      lastStreet: 'PREFLOP',
      spotKeys: ['BB_VS_BTN_OPEN'],
      outcome: 'UNKNOWN',
      wonGross: 0,
    },
  ];

  const sourceObservationCount = spotStats.reduce((sum, spot) => sum + spot.opportunities, 0);

  return {
    playerId,
    analysisAlgorithmVersion: options.algorithmVersion ?? 1,
    inputHash: options.inputHash ?? 'a1b2c3d4e5f60718',
    sourceHandCount: options.sourceHandCount ?? 2,
    sourceObservationCount,
    sourceShowCount: showEvidence.length,
    globalStats,
    spotStats,
    showEvidence,
    betSizes,
    confidence: {
      k: CONFIG.k,
      learningThreshold: CONFIG.learningThreshold,
      knownThreshold: CONFIG.knownThreshold,
      overall: snapshotConfidence(options.sourceHandCount ?? 2, CONFIG),
    },
  };
}
