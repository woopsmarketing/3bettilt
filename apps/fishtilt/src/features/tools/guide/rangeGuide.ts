/**
 * The view model behind `/tools/range`'s guide (WP-S3-14). Everything a sentence on that
 * page states about the shipped range is read here from `strategy-core` through the app's
 * one range facade (`features/range/resolve.ts`) — combo counts, percentages, which seats
 * open a given hand, what the UTG and BTN lists have in common — so the guide cannot quote a
 * number the table does not show (CLAUDE.md rules 2 and 5, AGENT_COMMON_RULES rule 3).
 *
 * WHAT THIS MODULE MAY NOT SAY. It reports set arithmetic over two lists: how many combos,
 * how many are shared, how many appear in one and not the other. It does not explain WHY the
 * lists differ, and the guide that renders it says only what `RangeExplorer`'s own compare
 * card already says — the number of players still to act differs by seat — never that a
 * wider list is more profitable (`content/blog/btn-why-wide.mdx` refuses that claim too).
 *
 * The range is never called GTO, and its provenance is `RANGE_PROVENANCE_SENTENCE`, the one
 * shared constant (rule 4).
 */
import {
  comboCountOf,
  differenceHandClassSets,
  handClassByKey,
  handClassesOf,
  hasHandClass,
  percentageOf,
  STRATEGY_POSITIONS,
  type HandClass,
  type HandClassSet,
  type StrategyPosition,
} from '@gto-self/strategy-core';
import { handClassFacts } from '@gto-self/learn-core';
import {
  describeHandClassKorean,
  handClassReading,
  POSITION_GLOSS,
  POSITION_LABEL,
  RANGE_SPOTS,
  RANGE_STACK_DEPTHS,
  RANGE_TABLE_SIZES,
  resolveRange,
  SPOT_LABEL,
  stackDepthLabel,
  TABLE_SIZE_LABEL,
  UNSUPPORTED_REASON_LABEL,
  type RangeQuery,
  type RangeSpot,
  type RangeStackDepth,
  type RangeTableSize,
} from '../../range/index.js';

/** The only conditions the shipped range data is for — the same three the facade pins. */
export const GUIDE_TABLE_SIZE: RangeTableSize = 6;
export const GUIDE_STACK_DEPTH: RangeStackDepth = 100;
export const GUIDE_SPOT: RangeSpot = 'RFI';

function query(heroPosition: StrategyPosition): RangeQuery {
  return {
    heroPosition,
    spot: GUIDE_SPOT,
    stackDepth: GUIDE_STACK_DEPTH,
    tableSize: GUIDE_TABLE_SIZE,
  };
}

/** The shipped first-in range for a seat, or `null` when the facade says there is none (BB). */
export function shippedRangeFor(position: StrategyPosition): HandClassSet | null {
  const resolution = resolveRange(query(position));
  return resolution.kind === 'RANGE' ? resolution.range : null;
}

export interface PositionRangeRow {
  readonly position: StrategyPosition;
  readonly label: string;
  readonly gloss: string;
  /** `null` for a seat with no first-in range (BB) — rendered as the reason, never as 0. */
  readonly classCount: number | null;
  readonly comboCount: number | null;
  /** `0..1`. */
  readonly share: number | null;
  readonly unsupportedReason: string | null;
}

/** One row per seat, in table order, straight from the facade. */
export function positionRangeRows(): readonly PositionRangeRow[] {
  return STRATEGY_POSITIONS.map((position) => {
    const resolution = resolveRange(query(position));
    if (resolution.kind !== 'RANGE') {
      const [reason] = resolution.reasons;
      return {
        position,
        label: POSITION_LABEL[position],
        gloss: POSITION_GLOSS[position],
        classCount: null,
        comboCount: null,
        share: null,
        unsupportedReason: reason === undefined ? null : UNSUPPORTED_REASON_LABEL[reason],
      };
    }
    return {
      position,
      label: POSITION_LABEL[position],
      gloss: POSITION_GLOSS[position],
      classCount: handClassesOf(resolution.range).length,
      comboCount: resolution.comboCount,
      share: resolution.percentage,
      unsupportedReason: null,
    };
  });
}

/** The two seats the guide compares — the same pair `RangeExplorer` opens Compare mode on. */
export const COMPARE_A: StrategyPosition = 'UTG';
export const COMPARE_B: StrategyPosition = 'BTN';

export interface RangeComparison {
  readonly a: {
    readonly position: StrategyPosition;
    readonly range: HandClassSet;
    readonly combos: number;
    readonly share: number;
    readonly classes: number;
  };
  readonly b: {
    readonly position: StrategyPosition;
    readonly range: HandClassSet;
    readonly combos: number;
    readonly share: number;
    readonly classes: number;
  };
  /** Combos in BOTH lists. */
  readonly sharedCombos: number;
  /** Combos in A's list only / in B's list only. */
  readonly onlyACombos: number;
  readonly onlyBCombos: number;
  readonly onlyAClasses: number;
  readonly onlyBClasses: number;
  /** True when every class in A is also in B — a fact about the data, checked, not assumed. */
  readonly aIsSubsetOfB: boolean;
}

/** UTG against BTN, as set arithmetic. Throws if either seat has no shipped range. */
export function compareRanges(
  positionA: StrategyPosition = COMPARE_A,
  positionB: StrategyPosition = COMPARE_B,
): RangeComparison {
  const rangeA = shippedRangeFor(positionA);
  const rangeB = shippedRangeFor(positionB);
  if (rangeA === null || rangeB === null) {
    throw new Error(`no shipped first-in range for ${positionA} or ${positionB}`);
  }
  const onlyA = differenceHandClassSets(rangeA, rangeB);
  const onlyB = differenceHandClassSets(rangeB, rangeA);
  const combosA = comboCountOf(rangeA);
  const onlyACombos = comboCountOf(onlyA);
  return {
    a: {
      position: positionA,
      range: rangeA,
      combos: combosA,
      share: percentageOf(rangeA),
      classes: handClassesOf(rangeA).length,
    },
    b: {
      position: positionB,
      range: rangeB,
      combos: comboCountOf(rangeB),
      share: percentageOf(rangeB),
      classes: handClassesOf(rangeB).length,
    },
    sharedCombos: combosA - onlyACombos,
    onlyACombos,
    onlyBCombos: comboCountOf(onlyB),
    onlyAClasses: handClassesOf(onlyA).length,
    onlyBClasses: handClassesOf(onlyB).length,
    aIsSubsetOfB: handClassesOf(onlyA).length === 0,
  };
}

/**
 * The hand the guide walks through. Offsuit, and in the button's list but not the first
 * seat's — so the walk actually crosses the line the comparison above draws. `rangeGuide.test.ts`
 * asserts that property against the data rather than trusting this comment.
 */
export const WALKTHROUGH_HAND_KEY = 'A9o';

export interface WalkthroughSeat {
  readonly position: StrategyPosition;
  readonly label: string;
  /** `true` in the list, `false` not in it, `null` when the seat has no first-in list. */
  readonly inRange: boolean | null;
}

export interface Walkthrough {
  readonly handClass: HandClass;
  readonly key: string;
  readonly reading: string;
  readonly description: string;
  readonly comboCount: number;
  /** `0..1` — this class's share of the 1326 deals. */
  readonly universeShare: number;
  readonly seats: readonly WalkthroughSeat[];
  /** The seats whose list contains the hand, in table order. */
  readonly openedFrom: readonly StrategyPosition[];
}

export function walkthrough(key: string = WALKTHROUGH_HAND_KEY): Walkthrough {
  const handClass = handClassByKey(key);
  if (handClass === undefined) throw new Error(`"${key}" is not one of the 169 hand classes`);
  const facts = handClassFacts(handClass);
  const seats = STRATEGY_POSITIONS.map((position): WalkthroughSeat => {
    const range = shippedRangeFor(position);
    return {
      position,
      label: POSITION_LABEL[position],
      inRange: range === null ? null : hasHandClass(range, handClass.index),
    };
  });
  return {
    handClass,
    key: handClass.key,
    reading: handClassReading(handClass),
    description: describeHandClassKorean(handClass),
    comboCount: facts.comboCount,
    universeShare: facts.universeShare,
    seats,
    openedFrom: seats.filter((seat) => seat.inRange === true).map((seat) => seat.position),
  };
}

/** The supported condition, in the facade's own vocabulary — one line. */
export function supportedConditionLabel(): string {
  return `${TABLE_SIZE_LABEL[GUIDE_TABLE_SIZE]} · ${stackDepthLabel(GUIDE_STACK_DEPTH)} · ${SPOT_LABEL[GUIDE_SPOT]}`;
}

export interface UnsupportedCondition {
  readonly label: string;
  readonly reason: string;
}

/**
 * Every condition the filters OFFER that the data does not cover, derived from the typed
 * unions the facade exposes and checked through `resolveRange` — so a spot or stack that
 * ships later drops off this list on its own, and one this list names is genuinely refused
 * by the tool above it.
 */
export function unsupportedConditions(): readonly UnsupportedCondition[] {
  const out: UnsupportedCondition[] = [];
  const base = query('BTN');
  for (const spot of RANGE_SPOTS) {
    if (spot === GUIDE_SPOT) continue;
    const resolution = resolveRange({ ...base, spot });
    if (resolution.kind === 'UNSUPPORTED') {
      out.push({ label: SPOT_LABEL[spot], reason: UNSUPPORTED_REASON_LABEL.SPOT_NOT_SHIPPED });
    }
  }
  for (const stackDepth of RANGE_STACK_DEPTHS) {
    if (stackDepth === GUIDE_STACK_DEPTH) continue;
    const resolution = resolveRange({ ...base, stackDepth });
    if (resolution.kind === 'UNSUPPORTED') {
      out.push({
        label: stackDepthLabel(stackDepth),
        reason: UNSUPPORTED_REASON_LABEL.STACK_DEPTH_NOT_SHIPPED,
      });
    }
  }
  for (const tableSize of RANGE_TABLE_SIZES) {
    if (tableSize === GUIDE_TABLE_SIZE) continue;
    const resolution = resolveRange({ ...base, tableSize });
    if (resolution.kind === 'UNSUPPORTED') {
      out.push({
        label: TABLE_SIZE_LABEL[tableSize],
        reason: UNSUPPORTED_REASON_LABEL.TABLE_SIZE_NOT_SHIPPED,
      });
    }
  }
  const bb = resolveRange(query('BB'));
  if (bb.kind === 'UNSUPPORTED' && bb.reasons.includes('BB_HAS_NO_RFI_RANGE')) {
    out.push({
      label: `${POSITION_LABEL.BB} (${POSITION_GLOSS.BB})`,
      reason: UNSUPPORTED_REASON_LABEL.BB_HAS_NO_RFI_RANGE,
    });
  }
  return out;
}
