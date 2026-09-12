/**
 * The one place a `RangeQuery` becomes either real range data or an honest `UNSUPPORTED`
 * answer. CLAUDE.md rule 2 and rule 5, and `POKER_EDUCATIONAL_DATA_AUDIT.md` §5's
 * "no-fake-data enforcement": there is no fallback range, no nearest-stack-depth borrowing,
 * no interpolation. A query this module cannot answer comes back saying exactly which part
 * of it is the problem — never a plausible-looking number.
 *
 * The whole reachable query space is `RangeQuery`'s four axes
 * (`heroPosition` x `spot` x `stackDepth` x `tableSize` = 6 x 3 x 4 x 3 = 216 points).
 * Every one of them resolves to exactly one of the two `RangeResolution` members below —
 * `resolve.test.ts` enumerates all 216 and proves it.
 */
import {
  comboCountOf,
  COMBO_COUNT,
  percentageOf,
  RFI_RANGES,
  type HandClassSet,
} from '@gto-self/strategy-core';
import { formatHandClassSet } from './notation.js';
import type { RangeQuery, RangeUnsupportedReason } from './types.js';

export interface RangeResolutionSupported {
  readonly kind: 'RANGE';
  readonly query: RangeQuery;
  readonly range: HandClassSet;
  /** Compact chart notation (`formatHandClassSet`), e.g. `"66+,A3s+,...,QJo"`. */
  readonly notation: string;
  readonly comboCount: number;
  readonly totalCombos: number;
  /** `0..1`. Never money (CLAUDE.md rule 1). */
  readonly percentage: number;
}

export interface RangeResolutionUnsupported {
  readonly kind: 'UNSUPPORTED';
  readonly query: RangeQuery;
  /** Every axis of `query` that failed to resolve — can be more than one at once. */
  readonly reasons: readonly RangeUnsupportedReason[];
  /**
   * The nearest query that DOES resolve to `'RANGE'`, keeping `heroPosition` fixed — or
   * `null` when no such query exists (the only case: `heroPosition: 'BB'`, which has no
   * RFI range at any stack depth or table size because the hand is over before it acts).
   * The UI uses this for the one-click "supported filter" path the audit's §5.5 asks for;
   * it is never offered when it would itself be unsupported.
   */
  readonly nearestSupportedQuery: RangeQuery | null;
}

export type RangeResolution = RangeResolutionSupported | RangeResolutionUnsupported;

const SUPPORTED_SPOT = 'RFI';
const SUPPORTED_STACK_DEPTH = 100;
const SUPPORTED_TABLE_SIZE = 6;

function nearestSupportedQueryFor(query: RangeQuery): RangeQuery | null {
  if (query.heroPosition === 'BB') return null;
  return {
    heroPosition: query.heroPosition,
    spot: SUPPORTED_SPOT,
    stackDepth: SUPPORTED_STACK_DEPTH,
    tableSize: SUPPORTED_TABLE_SIZE,
  };
}

function unsupportedReasonsOf(query: RangeQuery): readonly RangeUnsupportedReason[] {
  const reasons: RangeUnsupportedReason[] = [];
  if (query.spot !== SUPPORTED_SPOT) reasons.push('SPOT_NOT_SHIPPED');
  if (query.stackDepth !== SUPPORTED_STACK_DEPTH) reasons.push('STACK_DEPTH_NOT_SHIPPED');
  if (query.tableSize !== SUPPORTED_TABLE_SIZE) reasons.push('TABLE_SIZE_NOT_SHIPPED');
  // The BB rule of the game applies specifically to RFI — a query that has already missed
  // the spot is reported for that miss, not doubled up with a BB reason that would not even
  // apply once FACING_OPEN ships and the BB becomes a normal position again.
  if (query.spot === SUPPORTED_SPOT && query.heroPosition === 'BB') {
    reasons.push('BB_HAS_NO_RFI_RANGE');
  }
  return reasons;
}

/**
 * Total — never throws. The single entry point every page and filter control calls; there
 * is no other way to get a range in 3BetTilt (CLAUDE.md rule 2).
 */
export function resolveRange(query: RangeQuery): RangeResolution {
  const reasons = unsupportedReasonsOf(query);
  if (reasons.length > 0) {
    return {
      kind: 'UNSUPPORTED',
      query,
      reasons,
      nearestSupportedQuery: nearestSupportedQueryFor(query),
    };
  }

  // Every unsupported axis has already been ruled out above, so this is exactly the RFI /
  // 100bb / 6-max / non-BB point — the one point in the whole 216-point space with data.
  const range = RFI_RANGES[query.heroPosition];
  if (range === null) {
    // Unreachable given the check above (a BB query already produced BB_HAS_NO_RFI_RANGE),
    // kept only so this function stays total instead of asserting on a case it has already
    // named — see the `no invented third branch` test.
    return {
      kind: 'UNSUPPORTED',
      query,
      reasons: ['BB_HAS_NO_RFI_RANGE'],
      nearestSupportedQuery: null,
    };
  }

  return {
    kind: 'RANGE',
    query,
    range,
    notation: formatHandClassSet(range),
    comboCount: comboCountOf(range),
    totalCombos: COMBO_COUNT,
    percentage: percentageOf(range),
  };
}
