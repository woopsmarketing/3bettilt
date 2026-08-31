/**
 * Every encoded preflop number, in ONE inspectable place.
 *
 * This is the reference strategy's constant surface — 기본전략 · REFERENCE. It is NOT solved
 * output and is never labelled GTO anywhere (CLAUDE.md rule 2).
 *
 * PROVENANCE CONTRACT for this file. Each constant below carries the anchor it traces to,
 * quoted from `docs/reports/STRATEGY_ANCHORS.md` section 3 ("Recommended V1 constants"),
 * whose verdicts are binding:
 *
 *   - VERIFIED across independent public sources        -> SOURCE
 *   - sources disagree, or a single source only         -> DERIVED (the chosen rule is stated)
 *   - no public source at all                           -> HEURISTIC (rationale is stated)
 *
 * Anything in this file marked HEURISTIC is a rule of thumb THIS PROJECT authored. It is
 * flagged as such all the way to the UI and must never be presented as more.
 *
 * Sizings live here as exact integer RATIOS (numerator/denominator). The milliBB arithmetic
 * that turns a ratio into a raise-TO amount happens in `sizing.ts`, through `Money.*` with
 * explicit rounding (CLAUDE.md rule 1). No milliBB constant is hard-coded here: the big
 * blind comes from the query's environment, because rake/blind/ante structure is policy, not
 * site knowledge (CLAUDE.md rule 10).
 */
import { handClassAt } from '../range/handClass.js';
import type { StrategyPosition } from '../types.js';
import {
  differenceHandClassSets,
  handClassesOf,
  handClassSet,
  percentageOf,
  unionHandClassSets,
  type HandClassSet,
} from './notation.js';

// ---------------------------------------------------------------------------
// 1. RFI (raise-first-in) ranges — anchor 1
// ---------------------------------------------------------------------------

/**
 * S1 (PokerCoaching.com) 6-max cash 100bb, transcribed VERBATIM. S1 is the only public
 * source found that publishes 13x13 hand-class detail for this spot, so per the anchor doc
 * the LISTS are DERIVED (single-sourced) while the PERCENTAGES they produce are corroborated
 * three ways (S1, S3, S4) and are asserted against those bands in `tables.test.ts`.
 */
export const RFI_NOTATION: Readonly<Record<'UTG' | 'HJ' | 'CO' | 'BTN', string>> = {
  UTG: '66+,A3s+,K8s+,Q9s+,J9s+,T9s,ATo+,KJo+,QJo',
  HJ: '55+,A2s+,K6s+,Q9s+,J9s+,T9s,98s,87s,76s,ATo+,KTo+,QTo+',
  CO: '33+,A2s+,K3s+,Q6s+,J8s+,T7s+,97s+,87s,76s,A8o+,KTo+,QTo+,JTo',
  BTN: '33+,A2s+,K2s+,Q3s+,J4s+,T6s+,96s+,85s+,75s+,64s+,53s+,A4o+,K8o+,Q9o+,J9o+,T8o+,98o',
};

/**
 * S1's SB list, also verbatim — but S1's own chart layout makes this a RAISE-OR-LIMP
 * composite (62.3%), which the anchor doc explicitly warns must NOT be used directly by a
 * raise-or-fold engine (anchor 1 "Disagreement noted", anchor 6).
 */
export const RFI_SB_COMPOSITE_NOTATION =
  '22+,A2s+,K2s+,Q2s+,J2s+,T3s+,94s+,84s+,74s+,63s+,53s+,43s,A2o+,K4o+,Q5o+,J7o+,T7o+,96o+,86o+';

/**
 * The cross-verified SB RAISE-ONLY band: S10 "40% to 50%", S3 "39-47%", S4 "39-47%". The
 * intersection all three support is 40-47%.
 */
export const SB_RAISE_ONLY_BAND = { minPct: 0.4, maxPct: 0.47 } as const;

/**
 * RULE `PF.RFI.SB_RAISE_ONLY_TRIM` — DERIVED.
 *
 * Inputs: S1's SB composite list, the 40-47% raise-only band (S10/S3/S4).
 *
 * RULE (per-CLASS, not per-run — R1 MAJOR M1). Drop the composite's OFFSUIT classes ONE AT A
 * TIME, weakest first under the total order below, and STOP at the first list whose share of
 * the 1326-combo universe is at or below the band's top. Pairs and suited classes are never
 * touched: the composite's raise-or-limp surplus is entirely in its offsuit block.
 *
 * THE ORDER, stated so it can be audited:
 *
 *   1. ascending KICKER rank (the lower of the two cards) — the weakest kicker anywhere in
 *      the offsuit block goes first;
 *   2. ties broken by ascending HIGH card rank — with equal kickers the weaker high card
 *      goes first.
 *
 * Rationale, and why the kicker is the key: every published offsuit chart boundary is
 * written AS a kicker (`K4o+`, `Q5o+`, `J7o+` — S1's own notation). Walking the kicker down
 * is therefore not a new hand-strength metric, it is the same mechanical operation the
 * source's own notation performs, applied across the whole offsuit block at once instead of
 * one run at a time. It is DERIVED, not SOURCE: no public source states an SB raise-only
 * 13x13 list. The BAND is verified three ways; the TRIM is ours.
 *
 * WHY IT CHANGED. The previous version dropped whole RUNS ordered by high card, so `Q5o+`
 * died as a unit and took `QJo`/`QTo` with it while `K4o` survived — a range that folds QJo
 * and opens K4o is not a sane SB range at any width. Per-class trimming keeps the broadway
 * offsuit hands and removes the weakest kickers first. See `tables.test.ts`.
 *
 * Alternative considered and rejected: reusing the BTN list (43.5%, also inside the band).
 * It is inside the band by percentage but wrong by composition — SB acts against one player,
 * BTN against two, and the anchor doc gives no basis for equating them.
 */
function sbOffsuitTrimOrder(composite: HandClassSet): readonly string[] {
  return handClassesOf(composite)
    .map((index) => handClassAt(index))
    .filter((handClass) => handClass.kind === 'OFFSUIT')
    .map((handClass) => ({
      key: handClass.key,
      // `row`/`col` are descending-rank indices: 0 = A, 12 = '2'. LARGER means WEAKER, so a
      // plain ascending sort on (kicker, high) is already weakest-first.
      kicker: Math.max(handClass.row, handClass.col),
      high: Math.min(handClass.row, handClass.col),
    }))
    .sort((a, b) => b.kicker - a.kicker || b.high - a.high)
    .map((entry) => entry.key);
}

function trimSbCompositeToRaiseOnly(): HandClassSet {
  const composite = handClassSet(RFI_SB_COMPOSITE_NOTATION);
  const order = sbOffsuitTrimOrder(composite);
  const dropped: string[] = [];
  let current = composite;
  for (const key of order) {
    if (percentageOf(current) <= SB_RAISE_ONLY_BAND.maxPct) break;
    dropped.push(key);
    current = differenceHandClassSets(composite, handClassSet(dropped.join(',')));
  }
  return current;
}

export const RFI_RANGES: Readonly<Record<StrategyPosition, HandClassSet | null>> = {
  UTG: handClassSet(RFI_NOTATION.UTG),
  HJ: handClassSet(RFI_NOTATION.HJ),
  CO: handClassSet(RFI_NOTATION.CO),
  BTN: handClassSet(RFI_NOTATION.BTN),
  SB: trimSbCompositeToRaiseOnly(),
  /**
   * The big blind has no raise-first-in range: if the action folds to the BB the hand is
   * over. A query that somehow reaches RFI with hero in the BB routes to the documented
   * fallback rule instead of borrowing another seat's table.
   */
  BB: null,
};

/**
 * RULE `RFI_HEADS_UP_BUTTON` — HEURISTIC, and the note is mandatory (R1 MAJOR M6).
 *
 * THE PROBLEM. Heads-up, poker-core labels the button `BTN` by default (`headsUpButtonLabel`,
 * and `SB` under the other setting) and that seat posts the small blind and acts first. Both
 * labels used to resolve to a 6-max table authored for a seat with FOUR or ONE players behind
 * it — 42.8% (BTN) or the SB raise-only list. A heads-up button has ZERO players behind it and
 * every published heads-up strategy opens far wider than either.
 *
 * THE CONSTRUCTION, and it invents no percentage: the union of the two widest tables this
 * package has already justified — the BTN RFI list and the SB raise-only list. Nothing new is
 * authored; the widening is the set union of two lists that already exist, so the number it
 * produces is a consequence of the construction rather than a figure chosen to look right.
 *
 * THE LIMITATION, stated because a HEURISTIC that is quietly wrong is worse than none: this
 * is a FLOOR, not a heads-up range. `STRATEGY_ANCHORS.md` found no public heads-up table at
 * all (anchor 8 covers only 5- and 4-handed, and even that as HEURISTIC), and published
 * heads-up button ranges are substantially wider than the union below. The recommendation
 * carries the `HEADS_UP_BUTTON_APPROXIMATION` explanation feature and this rule's note so the
 * panel says so; the lineup degradation already forces every heads-up answer to HEURISTIC.
 *
 * Alternative considered and rejected: routing heads-up to `UNSUPPORTED_SPOT_FALLBACK`. That
 * fallback never authors a raise, so it would have the heads-up button FOLD ~90% of buttons —
 * further from any real heads-up strategy than the union is, and it would have required a new
 * `PreflopSpotUnsupportedReason` member, which is outside this package's boundary.
 */
export const RFI_HEADS_UP_BUTTON: HandClassSet = unionHandClassSets([
  handClassSet(RFI_NOTATION.BTN),
  trimSbCompositeToRaiseOnly(),
]);

/** The published percentage bands, for the assertion in `tables.test.ts`. */
export const RFI_PERCENT_BANDS: Readonly<
  Record<'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB', { readonly min: number; readonly max: number }>
> = {
  UTG: { min: 0.15, max: 0.176 },
  HJ: { min: 0.19, max: 0.22 },
  CO: { min: 0.25, max: 0.3 },
  BTN: { min: 0.4, max: 0.48 },
  SB: { min: SB_RAISE_ONLY_BAND.minPct, max: SB_RAISE_ONLY_BAND.maxPct },
};

// ---------------------------------------------------------------------------
// 2. Continue ("defense") tiers — HEURISTIC
// ---------------------------------------------------------------------------

/**
 * ALL FOUR TIERS ARE HEURISTIC, and the anchor doc says exactly why: no public source found
 * publishes a defend-X%-of-combos table against an open (anchor 6 — "UNVERIFIED for a
 * specific 'defend X% of hands vs each position' number ... must be classified HEURISTIC").
 * The only VERIFIED thing in that anchor is the RELATIONSHIP (S14): a bigger raise demands
 * more equity, and closing the action from the BB is the cheapest continue in the game.
 *
 * So the tiers encode the RELATIONSHIP's direction and nothing else: four widths, selected
 * by how expensive and how positionally awkward the continue is. The specific hand lists are
 * this project's authored rule of thumb and are labelled HEURISTIC everywhere they surface.
 */
export const DEFEND_PREMIUM = handClassSet('TT+,AQs+,AKo');
export const DEFEND_TIGHT = handClassSet('88+,ATs+,KJs+,QJs,JTs,AJo+,KQo');
export const DEFEND_MEDIUM = handClassSet('55+,A8s+,A5s-A2s,K9s+,Q9s+,J9s+,T9s,98s,ATo+,KJo+,QJo');
export const DEFEND_WIDE = handClassSet(
  '22+,A2s+,K7s+,Q8s+,J8s+,T8s+,97s+,87s,76s,65s,A8o+,KTo+,QTo+,JTo',
);
export const DEFEND_VERY_WIDE = handClassSet(
  '22+,A2s+,K2s+,Q4s+,J6s+,T6s+,95s+,85s+,74s+,64s+,54s,A2o+,K7o+,Q9o+,J9o+,T8o+,98o',
);

// ---------------------------------------------------------------------------
// 3. Aggression subsets — HEURISTIC
// ---------------------------------------------------------------------------

/**
 * The value / mixed / bluff split inside a continue range. HEURISTIC: S5 (Upswing) is the
 * only public source found on 3-bet RANGE CONSTRUCTION and gives shape guidance only
 * ("linear when players remain behind, polarized in position"), which the anchor doc already
 * classifies DERIVED and single-sourced — it names no hands and no frequencies. These lists
 * follow that shape (a premium value core plus a suited-wheel-ace / suited-broadway bluff
 * core) but the membership is authored here.
 *
 * Frequencies are quantized to 5-percentage-point steps by construction: a policy that says
 * "3-bet this 30% of the time" is a coarse authored mix, not solver precision, and
 * `recommendation.ts` re-quantizes every output anyway.
 *
 * Sets are applied in a fixed precedence (value, then mixed, then bluff, then the tier), so
 * an overlap can never produce two answers; `tables.test.ts` asserts they are disjoint.
 */
export const THREE_BET_VALUE = handClassSet('QQ+,AKs,AKo');
export const THREE_BET_MIXED = handClassSet('TT,JJ,AQs,AJs,KQs');
export const THREE_BET_BLUFF = handClassSet('A5s-A2s,KJs,QJs,JTs');

export const FOUR_BET_VALUE = handClassSet('QQ+,AKs');
export const FOUR_BET_BLUFF = handClassSet('A5s-A4s');
export const FOUR_BET_CALL = handClassSet('TT,JJ,AQs,AJs,KQs,AKo');

export const COLD_FOUR_BET_VALUE = handClassSet('KK+');
export const COLD_FOUR_BET_MIXED = handClassSet('QQ,AKs');

export const FIVE_BET_VALUE = handClassSet('KK+');
export const FIVE_BET_CALL = handClassSet('QQ,AKs,AKo');

export const SQUEEZE_VALUE = handClassSet('QQ+,AKs,AKo');
export const SQUEEZE_BLUFF = handClassSet('A5s,A4s,KQs');
export const SQUEEZE_CALL = handClassSet('TT,JJ,AQs,AJs');

/**
 * VS_ALLIN calling tiers, selected by the pot odds the query already carries. HEURISTIC:
 * S14's equity thresholds (23% / 16% / 29%) are VERIFIED as a RELATIONSHIP but no public
 * source gives the range that clears them, so the four widths below are authored.
 */
export const ALLIN_CALL_PREMIUM = handClassSet('QQ+,AKs');
export const ALLIN_CALL_TIGHT = handClassSet('TT+,AQs+,AKo');
export const ALLIN_CALL_MEDIUM = handClassSet('77+,ATs+,KQs,AQo+');
export const ALLIN_CALL_WIDE = handClassSet('22+,A2s+,KTs+,QJs,JTs,ATo+,KQo');

/**
 * The catch-all continue range for a spot `spot.ts` reports as UNSUPPORTED. Deliberately
 * narrow and deliberately passive: an unmodelled line is the LAST place to author
 * aggression. HEURISTIC.
 */
export const FALLBACK_CONTINUE = handClassSet('99+,AJs+,KQs,AQo+');

// ---------------------------------------------------------------------------
// 4. Sizing ratios — anchors 2, 3, 4, 5, 7
// ---------------------------------------------------------------------------

/** An exact rational multiplier. Kept integral so `Money.mulRatio` never sees a float. */
export interface SizingRatio {
  readonly numerator: number;
  readonly denominator: number;
}

export const SIZING = {
  /** SOURCE (S1, S3, S4 identical): "Raise to 2.5bb first in". */
  RFI_STANDARD_BB: { numerator: 5, denominator: 2 } satisfies SizingRatio,
  /** SOURCE (S1, S3, S4 identical; S10 corroborates ~3x for blind-vs-blind). */
  RFI_SB_BB: { numerator: 3, denominator: 1 } satisfies SizingRatio,
  /** DERIVED, single-sourced (S8): "add 1 BB per limper before you act." */
  ISO_PER_LIMPER_BB: { numerator: 1, denominator: 1 } satisfies SizingRatio,
  /** DERIVED, single-sourced (S13): BB raises an SB limp "to 3.5-4 big blinds". Low end. */
  BB_VS_SB_LIMP_BB: { numerator: 7, denominator: 2 } satisfies SizingRatio,

  /**
   * DERIVED — sources disagree. S5 and S8 both say 3x the open in position; S1 says 3.5x.
   * CHOSEN: 3.0x, the figure two of the three independent sources state. S1's 3.5x is the
   * documented alternative and is recorded in `THREE_BET_IP_ALTERNATIVE`.
   */
  THREE_BET_IP: { numerator: 3, denominator: 1 } satisfies SizingRatio,
  /** The rejected alternative, kept so the disagreement stays visible in code. */
  THREE_BET_IP_ALTERNATIVE: { numerator: 7, denominator: 2 } satisfies SizingRatio,
  /** SOURCE (S1 4x, S5 4-4.5x, S8 4x): ~4x the open out of position. */
  THREE_BET_OOP: { numerator: 4, denominator: 1 } satisfies SizingRatio,

  /** SOURCE (S6 cash "around 2.3x his 3-bet size"; S1 cash 6-max "2.3x the 3-bet IP"). */
  FOUR_BET_IP: { numerator: 23, denominator: 10 } satisfies SizingRatio,
  /** SOURCE (S6 "2.5x to 2.6x"; S1 cash 6-max "2.5x the 3-bet OOP"). Low end of S6. */
  FOUR_BET_OOP: { numerator: 5, denominator: 2 } satisfies SizingRatio,

  /**
   * DERIVED — sources disagree. S8: "at least 4x the open-raise when playing in position,
   * and 5x when playing out of position", plus "an extra 1x the open-raise for each
   * additional caller". S7 (SplitSuit) instead gives a flat "3x + 1x/caller" with no IP/OOP
   * split. CHOSEN: S8, because it is the more granular formula and its IP<OOP asymmetry
   * matches the plain-3-bet anchor already adopted above. S7's flat formula is the
   * documented alternative (`SQUEEZE_FLAT_ALTERNATIVE`).
   */
  SQUEEZE_IP: { numerator: 4, denominator: 1 } satisfies SizingRatio,
  SQUEEZE_OOP: { numerator: 5, denominator: 1 } satisfies SizingRatio,
  /** S8: +1x the open per cold caller BEYOND the first. */
  SQUEEZE_PER_EXTRA_CALLER: { numerator: 1, denominator: 1 } satisfies SizingRatio,
  /** S7's rejected alternative: 3x the open + 1x per caller, no IP/OOP split. */
  SQUEEZE_FLAT_ALTERNATIVE: { numerator: 3, denominator: 1 } satisfies SizingRatio,
} as const;
