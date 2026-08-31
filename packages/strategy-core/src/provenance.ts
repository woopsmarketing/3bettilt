/**
 * Where a number came from. A NEW axis, orthogonal to the `MOCK` tag in
 * `docs/GTO_BASELINE.md`: `MOCK` answers "is this real data?", provenance answers "how was
 * this value produced?". A value can be `SOURCE` and still be MOCK, and it can be
 * `DERIVED` from perfectly real data.
 *
 * The three members, VERBATIM from ADR-0056, which is the definition of record:
 *
 * - `SOURCE`    — directly represented by an accepted public reference rule or table,
 *                 verified against the cited page in `docs/reports/STRATEGY_ANCHORS.md`.
 *                 Note what this does NOT say: it is not "read out of a stored dataset".
 *                 A table this package types out from a cited public chart is `SOURCE`;
 *                 a number with no anchor is not, however mechanically it was produced.
 * - `DERIVED`   — deterministically mapped from a nearby reference environment or spot, with
 *                 the mapping rule documented (a bucket interpolation, a combo-to-class
 *                 aggregation, a mechanical trim of a sourced list). A deterministic function
 *                 of `HEURISTIC` inputs is `HEURISTIC`, not `DERIVED`: the tag describes the
 *                 weakest input, not the arithmetic.
 * - `HEURISTIC` — this project's own explicit deterministic fallback. It is NOT solved output,
 *                 must never be presented as one (CLAUDE.md rule 2), and carries a mandatory
 *                 explanatory note enforced below at the type level.
 *
 * This package DOES produce strategy numbers (`preflop/tables.ts`, `postflop/scoreModel.ts`)
 * and tags every one of them through `preflop/rules.ts` and `postflop/rules.ts`, where each
 * rule states its provenance, its anchor (or an explicit statement that no public source
 * covers it) and its rationale. An earlier version of this comment said the opposite; it was
 * written before those tables existed.
 */
export type Provenance = 'SOURCE' | 'DERIVED' | 'HEURISTIC';

export const PROVENANCES: readonly Provenance[] = ['SOURCE', 'DERIVED', 'HEURISTIC'];

/** Total. True for the three known members and nothing else. */
export function isProvenance(value: unknown): value is Provenance {
  return value === 'SOURCE' || value === 'DERIVED' || value === 'HEURISTIC';
}

/**
 * A value carrying its provenance. `note` is free text explaining the rule that produced
 * it; it is REQUIRED for `HEURISTIC` so an authored rule of thumb can never reach the UI
 * unexplained.
 */
export type Provenanced<T> =
  | { readonly provenance: 'SOURCE' | 'DERIVED'; readonly value: T; readonly note?: string }
  | { readonly provenance: 'HEURISTIC'; readonly value: T; readonly note: string };

/** Total. Tag a value as directly represented by a verified public anchor. */
export const sourced = <T>(value: T, note?: string): Provenanced<T> => ({
  provenance: 'SOURCE',
  value,
  ...(note === undefined ? {} : { note }),
});

/** Total. Tag a value as deterministically mapped from a nearby reference by a documented rule. */
export const derived = <T>(value: T, note?: string): Provenanced<T> => ({
  provenance: 'DERIVED',
  value,
  ...(note === undefined ? {} : { note }),
});

/** Total. Tag a value as an authored rule of thumb. The explanation is mandatory. */
export const heuristic = <T>(value: T, note: string): Provenanced<T> => ({
  provenance: 'HEURISTIC',
  value,
  note,
});
