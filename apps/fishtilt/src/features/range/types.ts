/**
 * The neutral query shape every range-consuming page builds (homepage table, the Range
 * Explorer's filters in WP-D, a learn article's embedded matrix, a hand page). Nothing here
 * knows Korean copy or React; this is the typed contract between "what the reader asked
 * for" and `resolve.ts`'s answer.
 *
 * The four axes below are exactly the ones `docs/reports/FISHTILT_00_AUDIT_AND_PLAN.md`
 * §5.4/§10 and `docs/reports/POKER_EDUCATIONAL_DATA_AUDIT.md` §2/§6 name as the dimensions
 * 3BetTilt's UI can plausibly expose a control for. Only ONE point in this space has real
 * data — `{ spot: 'RFI', stackDepth: 100, tableSize: 6 }` for any position but `BB` — and
 * `resolve.ts` is the single place that draws that line. Nothing else in the app is allowed
 * to grow a second opinion about which combinations are real (CLAUDE.md rule 2).
 */
import type { StrategyPosition } from '@gto-self/strategy-core';

/**
 * The preflop situation. Only `'RFI'` ships data — `RFI_RANGES` in `strategy-core`. The
 * other two are named explicitly in the audit's "datasets that do not exist" table (§10):
 * `strategy-core` carries `DEFEND_*` / `THREE_BET_*` for them, but every one of those is
 * tagged `HEURISTIC` with the rationale "no public source publishes this table" — exactly
 * the category (`POKER_EDUCATIONAL_DATA_AUDIT.md` §1, kind C) 3BetTilt does not show a
 * beginner. They are still named here, rather than omitted, so a filter control CAN offer
 * them as an honest "준비 중" option instead of the UI silently pretending they do not
 * exist as a concept.
 */
export type RangeSpot = 'RFI' | 'FACING_OPEN' | 'FACING_3BET';

export const RANGE_SPOTS: readonly RangeSpot[] = ['RFI', 'FACING_OPEN', 'FACING_3BET'];

/**
 * Effective stack depth in BB. Only `100` ships data (`strategy-core`'s tables are
 * authored at 100bb only). 40/60/150 are named in audit §10 as explicitly NOT shipped —
 * "nearby buckets reuse it with degraded provenance" is a private-engine thing, and this
 * app never does that (CLAUDE.md rule 2: no interpolation, ever).
 */
export type RangeStackDepth = 40 | 60 | 100 | 150;

export const RANGE_STACK_DEPTHS: readonly RangeStackDepth[] = [40, 60, 100, 150];

/**
 * Table size, in players dealt in. Only `6` (6-max) ships data. `2` (heads-up) and `9`
 * (9-max) are named in audit §10 ("Formats other than 6-max cash (9-max, MTT, HU)") as not
 * shipped — heads-up exists in `strategy-core` only as a `HEURISTIC` union and is therefore
 * out of MVP the same way `FACING_OPEN`/`FACING_3BET` are.
 */
export type RangeTableSize = 2 | 6 | 9;

export const RANGE_TABLE_SIZES: readonly RangeTableSize[] = [2, 6, 9];

export interface RangeQuery {
  readonly heroPosition: StrategyPosition;
  readonly spot: RangeSpot;
  readonly stackDepth: RangeStackDepth;
  readonly tableSize: RangeTableSize;
}

/**
 * Every way a query can fail to resolve to a shipped range. A query can carry more than one
 * of these at once (e.g. `FACING_OPEN` at 60bb 9-max fails three ways) — `resolve.ts`
 * reports every one that applies, not just the first, so the UI can explain the whole gap.
 *
 * `BB_HAS_NO_RFI_RANGE` is deliberately distinct from `SPOT_NOT_SHIPPED`: it is not a
 * missing dataset, it is a rule of the game (if the action folds to the big blind the hand
 * is over, so there is no "first in" decision to have a range for). It only ever appears
 * for `spot: 'RFI'` — the big blind is a perfectly normal position to hold data for once
 * `FACING_OPEN` ships.
 */
export type RangeUnsupportedReason =
  'SPOT_NOT_SHIPPED' | 'STACK_DEPTH_NOT_SHIPPED' | 'TABLE_SIZE_NOT_SHIPPED' | 'BB_HAS_NO_RFI_RANGE';
