/**
 * Compact chart notation for an arbitrary `HandClassSet` — the `"66+,A3s+,K8s+,QJo"` style
 * every table in `strategy-core/src/preflop/tables.ts` is transcribed in, and the exact
 * inverse of `strategy-core`'s own `parseHandClasses` (`src/preflop/notation.ts`).
 *
 * `strategy-core` parses this grammar but never serializes it — checked (no `format`/
 * `toNotation`/`stringify` export exists anywhere in the package; see the WP-C report for
 * the search). A `HandClassSet`'s own `.notation` field is not a substitute: for a
 * DERIVED set such as `RFI_RANGES.SB` (`trimSbCompositeToRaiseOnly` in `tables.ts`) it is
 * literally the audit trail of set-difference operations that produced it
 * (`"(...) minus (...)"`), not something a reader should see. This module computes fresh
 * notation from the set's actual membership, so it is correct for ANY set regardless of how
 * it was built — union, difference, or a plain `handClassSet(...)` call.
 *
 * ALGORITHM. `strategy-core`'s grammar has exactly three run shapes per `notation.test.ts`
 * in that package:
 *   - pairs: `XX+` (a contiguous run of pairs reaching all the way up to AA) or `TT-88`
 *     (an explicit run that does not reach AA) or a bare `XX` for a single pair;
 *   - suited/offsuit at a fixed high card: `AXs+` (a contiguous run of kickers reaching all
 *     the way up to the strongest possible kicker for that high card) or `A5s-A2s` (an
 *     explicit run that does not) or a bare class for a single one.
 * This module finds maximal contiguous runs along each axis and picks the shortest legal
 * token for each, using `HandClass.highRank`/`.lowRank` (never `.row`/`.col` directly —
 * those are matrix COORDINATES, and for an OFFSUIT class the higher-ranked card sits in
 * `col`, not `row`; `highRank`/`lowRank` are the fields that are unconditionally correct,
 * see `handClass.ts`'s `computeClassOfCombo`).
 *
 * CORRECTNESS CONTRACT, and the one this module's test actually checks: `formatHandClassSet`
 * does not have to reproduce a source table's exact string. It has to round-trip —
 * `handClassSet(formatHandClassSet(set))` must denote the identical 169-class membership as
 * `set` — because two different token choices ("K8s+" vs "K8s-KQs") can name the same
 * classes, and membership, not spelling, is the property `strategy-core`'s own parser cares
 * about.
 */
import { RANKS_DESC, type Rank } from '@gto-self/shared';
import {
  HAND_CLASSES,
  hasHandClass,
  type HandClass,
  type HandClassSet,
} from '@gto-self/strategy-core';

/** 0 = A ... 12 = 2, matching `strategy-core`'s own `RANKS_DESC`-indexed convention. */
function descIndex(rank: Rank): number {
  return RANKS_DESC.indexOf(rank);
}

function rankAt(index: number): Rank {
  const rank = RANKS_DESC[index];
  if (rank === undefined) throw new Error(`rank index out of range: ${index}`);
  return rank;
}

/** One contiguous run of true values in `present`, over ascending index. */
interface Run {
  readonly start: number;
  readonly end: number;
}

function runsOf(present: readonly boolean[], from: number, to: number): readonly Run[] {
  const runs: Run[] = [];
  let start: number | null = null;
  for (let i = from; i <= to; i += 1) {
    if (present[i]) {
      if (start === null) start = i;
    } else if (start !== null) {
      runs.push({ start, end: i - 1 });
      start = null;
    }
  }
  if (start !== null) runs.push({ start, end: to });
  return runs;
}

function pairKey(index: number): string {
  const r = rankAt(index);
  return `${r}${r}`;
}

function formatPairs(set: HandClassSet, byPairIndex: readonly (HandClass | undefined)[]): string[] {
  const present = byPairIndex.map((hc) => hc !== undefined && hasHandClass(set, hc.index));
  const tokens: string[] = [];
  for (const { start, end } of runsOf(present, 0, 12)) {
    if (start === 0) tokens.push(`${pairKey(end)}+`);
    else if (start === end) tokens.push(pairKey(start));
    else tokens.push(`${pairKey(start)}-${pairKey(end)}`);
  }
  return tokens;
}

function suitedOrOffsuitKey(highIndex: number, lowIndex: number, suffix: 's' | 'o'): string {
  return `${rankAt(highIndex)}${rankAt(lowIndex)}${suffix}`;
}

/**
 * `byHighLow[high][low]` for one kind (SUITED or OFFSUIT), `high` in `0..11`, `low` in
 * `high+1..12`. Built once per format call from `HAND_CLASSES` rather than trusted
 * `row`/`col` arithmetic — see the module doc.
 */
function buildHighLowTable(kind: 'SUITED' | 'OFFSUIT'): (HandClass | undefined)[][] {
  const table: (HandClass | undefined)[][] = Array.from({ length: 13 }, () =>
    Array.from({ length: 13 }, () => undefined as HandClass | undefined),
  );
  for (const handClass of HAND_CLASSES) {
    if (handClass.kind !== kind) continue;
    const high = descIndex(handClass.highRank);
    const low = descIndex(handClass.lowRank);
    const row = table[high];
    if (row) row[low] = handClass;
  }
  return table;
}

function formatKind(set: HandClassSet, kind: 'SUITED' | 'OFFSUIT', suffix: 's' | 'o'): string[] {
  const table = buildHighLowTable(kind);
  const tokens: string[] = [];
  for (let high = 0; high <= 11; high += 1) {
    const row = table[high];
    if (!row) continue;
    const present = row.map((hc) => hc !== undefined && hasHandClass(set, hc.index));
    for (const { start, end } of runsOf(present, high + 1, 12)) {
      if (start === high + 1) {
        tokens.push(`${suitedOrOffsuitKey(high, end, suffix)}+`);
      } else if (start === end) {
        tokens.push(suitedOrOffsuitKey(high, start, suffix));
      } else {
        tokens.push(
          `${suitedOrOffsuitKey(high, start, suffix)}-${suitedOrOffsuitKey(high, end, suffix)}`,
        );
      }
    }
  }
  return tokens;
}

const PAIR_BY_INDEX: readonly (HandClass | undefined)[] = (() => {
  const byIndex: (HandClass | undefined)[] = Array.from({ length: 13 }, () => undefined);
  for (const handClass of HAND_CLASSES) {
    if (handClass.kind === 'PAIR') byIndex[descIndex(handClass.highRank)] = handClass;
  }
  return byIndex;
})();

/**
 * Total. `""` for the empty range. Ordered pairs first (strongest to weakest), then suited
 * by high card (A down to 3), then offsuit the same way — the order every table in
 * `tables.ts` is already written in, so a reader who knows that convention sees the same
 * shape here.
 */
export function formatHandClassSet(set: HandClassSet): string {
  const tokens = [
    ...formatPairs(set, PAIR_BY_INDEX),
    ...formatKind(set, 'SUITED', 's'),
    ...formatKind(set, 'OFFSUIT', 'o'),
  ];
  return tokens.join(',');
}
