/**
 * Pure, React-free derivations over `@gto-self/learn-core`'s starting-hand strength ranking
 * (`handStrengthOf` / `topHandsByShare` / `handStrengthTied` — see `packages/learn-core/src/
 * strength/ranking.ts`). Nothing here computes a poker fact: every number is read from the
 * frozen dataset. This module only shapes it for the slider and the matrix — clamping the
 * slider's integer percent, turning a "top X%" cut into a `HandClassSet` `RangeMatrix` can
 * render, and deciding when two classes are tied closely enough that the panel must not
 * imply a false ordering between them.
 */
import { handClassSet, type HandClass, type HandClassSet } from '@gto-self/strategy-core';
import { unwrap } from '@gto-self/shared';
import {
  handStrengthOf,
  handStrengthTied,
  topHandsByShare,
  HAND_STRENGTH_BY_RANK,
  type HandStrengthEntry,
  type TopHandSelection,
} from '@gto-self/learn-core';

/** The slider's legal range. `1` (never `0`) so "top X%" always selects at least one class —
 *  an empty selection is a real answer `topHandsByShare` supports, but a slider that can be
 *  dragged to "show nothing" teaches nothing. */
export const MIN_TOP_PERCENT = 1;
export const MAX_TOP_PERCENT = 100;

/** The slider's initial position. Matches the illustrative "top 15%" example
 *  `FISHTILT_WP_R_STRENGTH_DATASET.md` §5 walks through (31 classes, 15.08% of the deal) —
 *  a reasonable starting point to demonstrate the cut on load, not a claim about any hand. */
export const DEFAULT_TOP_PERCENT = 15;

/**
 * Total. An out-of-range or non-finite value (a corrupt URL, a stray keystroke) falls back
 * to the nearest legal integer rather than being passed on to `topHandsByShare`, which would
 * refuse anything outside `0..1`. Never silently "worked anyway" — the caller always gets a
 * value it can render a pressed/consistent slider position for.
 */
export function clampTopPercent(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TOP_PERCENT;
  const rounded = Math.round(value);
  return Math.min(MAX_TOP_PERCENT, Math.max(MIN_TOP_PERCENT, rounded));
}

/** `15` -> `0.15`. The unit `topHandsByShare` actually takes. */
export function percentToShare(percent: number): number {
  return percent / 100;
}

/**
 * Total. The "top X%" cut for a slider position, clamped first so this can never hit
 * `topHandsByShare`'s `SHARE_OUT_OF_RANGE` — `clampTopPercent` guarantees a share in
 * `[0.01, 1]`, always inside the accepted `0..1`. `unwrap` therefore only ever throws if
 * that guarantee itself is broken, which is a programming error in this module, not a
 * runtime condition the UI has to handle.
 */
export function topSelectionForPercent(percent: number): TopHandSelection {
  return unwrap(topHandsByShare(percentToShare(clampTopPercent(percent))));
}

/**
 * Total. The selection's classes as a `HandClassSet`, the membership shape `RangeMatrix`
 * already knows how to highlight — reused rather than adding a second highlight mechanism.
 * `handClassSet`'s notation grammar accepts a bare comma-separated list of class keys
 * (`strategy-core`'s `preflop/notation.ts`), so joining the selection's own keys is enough;
 * nothing here re-derives which classes belong in the cut.
 */
export function handClassSetOfSelection(selection: TopHandSelection): HandClassSet {
  return handClassSet(selection.entries.map((entry) => entry.key).join(','));
}

/** Whether a class's rank is tied — bit-identical equity — with the class immediately
 *  stronger and/or immediately weaker than it. */
export interface TieInfo {
  readonly tiedWithStronger: boolean;
  readonly tiedWithWeaker: boolean;
}

/**
 * Total. `HAND_STRENGTH_BY_RANK` is 0-indexed, `entry.rank` is 1-indexed and 1 = strongest,
 * so the class one rank stronger sits at `rank - 2` and one rank weaker at `rank` in that
 * array. Both lookups are `undefined` at the ends of the ranking (rank 1 has no stronger
 * neighbour, rank 169 no weaker one), which reads as "not tied" — correct, since there is no
 * neighbour to be tied with.
 *
 * The shipped dataset's `exactTies` is empty (`HAND_STRENGTH.exactTies`), so this returns
 * `{ false, false }` for every one of the 169 classes today. It is still computed from
 * `handStrengthTied` — exact equality, never a tolerance — rather than assumed impossible,
 * because a future regeneration is the one thing licensed to change that, and the panel must
 * not have hard-coded its way into implying an order the data no longer contains.
 */
export function tieInfoFor(entry: HandStrengthEntry): TieInfo {
  const stronger = HAND_STRENGTH_BY_RANK[entry.rank - 2];
  const weaker = HAND_STRENGTH_BY_RANK[entry.rank];
  return {
    tiedWithStronger: stronger !== undefined && handStrengthTied(entry, stronger),
    tiedWithWeaker: weaker !== undefined && handStrengthTied(entry, weaker),
  };
}

/** Total. Convenience composition of `handStrengthOf` + `tieInfoFor` for a component that
 *  only holds a `HandClass`. */
export function strengthDetailOf(handClass: HandClass): {
  readonly entry: HandStrengthEntry;
  readonly tie: TieInfo;
} {
  const entry = handStrengthOf(handClass);
  return { entry, tie: tieInfoFor(entry) };
}
