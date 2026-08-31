/**
 * The POSTFLOP rule registry: every documented rule the postflop reference policy can apply,
 * with a stable string id, its inputs, its rationale and its provenance.
 *
 * The registry exists for the same reason `preflop/rules.ts` does: a recommendation reports
 * the ids it used, so a reviewer can go from a number on screen to the rule that produced it
 * without reading the policy code. `docs/reports/STRATEGY_WP_B3.md` reproduces this table.
 *
 * PROVENANCE, PER ADR-0056 AND THE ANCHOR DOC.
 *
 * `docs/reports/STRATEGY_ANCHORS.md` verified PREFLOP material only. It contains exactly ONE
 * postflop-applicable relationship: Anchor 6 / S14's pot-odds statement, "you need roughly
 * `call / (pot + call)` equity to break even on a call", which is SOURCE as a RELATIONSHIP
 * (never as a range table). Everything else this policy does — every weight, every threshold,
 * every score-to-frequency band, every sizing rule — is OUR OWN authored model and is
 * therefore `HEURISTIC`.
 *
 * So: **no postflop rule is ever `SOURCE`.** `POSTFLOP_REQUIRED_EQUITY` is `DERIVED` because
 * it is a mechanical restatement of that one sourced relationship; the four mechanics rules
 * mirrored from `preflop/rules.ts` (quantization, the tie-break, the legality clamp and the
 * legality substitution) keep the `DERIVED` classification A3 gave them, because they are
 * deterministic mappings with no strategy content at all. A test asserts the no-SOURCE
 * property over the whole registry.
 *
 * NOTHING here is GTO. This is 기본전략 · REFERENCE (CLAUDE.md rule 2).
 */
import { invariant } from '@gto-self/shared';
import type { Provenance } from '../provenance.js';

export type PostflopRuleId =
  // spot classification and the range model
  | 'POSTFLOP_SPOT_CLASSIFICATION'
  | 'VILLAIN_RANGE_FROM_PREFLOP'
  | 'VILLAIN_RANGE_NOT_NARROWED'
  | 'VILLAIN_RANGE_OFF_POLICY'
  | 'PRIMARY_VILLAIN_SELECTION'
  // measurement
  | 'POSTFLOP_REQUIRED_EQUITY'
  | 'HERO_EQUITY_MEASUREMENT'
  | 'HERO_EQUITY_FAIR_SHARE_NORMALIZATION'
  | 'RANGE_ADVANTAGE_MEASUREMENT'
  | 'NUT_ADVANTAGE_MEASUREMENT'
  | 'RANGE_PERCENTILE_MEASUREMENT'
  | 'EQUITY_SUBSAMPLED'
  // the scoring model
  | 'AGGRESSION_SCORE_MODEL'
  | 'CONTINUE_SCORE_MODEL'
  | 'AGGRESSION_FREQUENCY_BANDS'
  | 'CONTINUE_FREQUENCY_BANDS'
  | 'RAISE_SHARE_BANDS'
  // multiway
  | 'MULTIWAY_AGGRESSION_SCALE'
  | 'MULTIWAY_CONTINUE_PENALTY'
  | 'MULTIWAY_DEGRADE'
  // all-in
  | 'FACING_ALL_IN_POT_ODDS'
  | 'FACING_ALL_IN_ISOLATION'
  | 'ALL_IN_SPR_GATE'
  // sizing
  | 'SIZING_BUCKET_SET'
  | 'SIZING_BASE_BY_BAND'
  | 'SIZING_TEXTURE_MODIFIER'
  | 'SIZING_NUT_ADVANTAGE_MODIFIER'
  | 'SIZING_RANGE_ADVANTAGE_MODIFIER'
  | 'SIZING_SPR_MODIFIER'
  | 'SIZING_MULTIWAY_MODIFIER'
  | 'SIZING_STREET_MODIFIER'
  | 'SIZING_RAISE_MODIFIER'
  | 'SIZING_POT_FRACTION_TO_AMOUNT'
  // policy mechanics, mirrored from the preflop registry
  | 'LEGALITY_CLAMP'
  | 'LEGALITY_SUBSTITUTION'
  | 'FREQUENCY_QUANTIZATION'
  | 'PRIMARY_ACTION_TIE_BREAK'
  // degradation
  | 'STACK_BUCKET_NEARBY'
  | 'STACK_BUCKET_DISTANT'
  | 'STACK_BUCKET_OUT_OF_RANGE'
  | 'LINEUP_SHORT_HANDED'
  | 'LINEUP_VERY_SHORT_HANDED'
  | 'ENVIRONMENT_COMPATIBILITY';

export interface PostflopRule {
  readonly id: PostflopRuleId;
  readonly provenance: Provenance;
  /** Anchor doc citation, or an explicit statement that no public source covers this. */
  readonly anchor: string;
  /** What the rule reads. */
  readonly inputs: readonly string[];
  /** Why it is the rule it is — mandatory, and mandatory in prose for HEURISTIC. */
  readonly rationale: string;
}

const NO_ANCHOR = 'No public source in docs/reports/STRATEGY_ANCHORS.md covers this; authored.';

const RULES: readonly PostflopRule[] = [
  // -------------------------------------------------------------------------
  // Spot classification and the range model
  // -------------------------------------------------------------------------
  {
    id: 'POSTFLOP_SPOT_CLASSIFICATION',
    provenance: 'DERIVED',
    anchor: 'Mechanical: reads the query action list only.',
    inputs: ['street', 'actions', 'lastAggressorByStreet', 'legalActions', 'activeOpponentCount'],
    rationale:
      'The family (CBET / DELAYED_CBET / PROBE / FACING_BET / FACING_RAISE / FACING_ALL_IN) and the pot type (LIMPED / SINGLE_RAISED / THREE_BET / FOUR_BET_PLUS) are read off the action list by counting aggressions per street. No judgement is involved, so the classification is a deterministic mapping of the query.',
  },
  {
    id: 'VILLAIN_RANGE_FROM_PREFLOP',
    provenance: 'HEURISTIC',
    anchor: `${NO_ANCHOR} The preflop ranges it starts from carry their own (mostly HEURISTIC) provenance.`,
    inputs: ['preflop action list', 'propagatePreflopRanges'],
    rationale:
      "Every live seat's range is A3's end-of-preflop propagated range, conflict-filtered against the board and hero's cards. Reusing A3's propagation means there is exactly one strategy in the package: a preflop table edit moves the postflop range advantage with it.",
  },
  {
    id: 'VILLAIN_RANGE_NOT_NARROWED',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['postflop actions taken before hero'],
    rationale:
      "Postflop actions already taken this hand do NOT narrow any range. Narrowing would require the policy to condition on its own output for every combo, and the policy's own inputs (range equity, nut advantage) are range-level, so villain's range would depend on villain's policy which depends on villain's range — a fixed point with no convergence guarantee and a latency cost measured in seconds. A3 already settled the honest alternative for actions a model cannot condition on: leave the range alone and FLAG it. The flag is typed, surfaced as an explanation feature, and degrades the answer whenever a postflop action exists.",
  },
  {
    id: 'VILLAIN_RANGE_OFF_POLICY',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['PropagatedRange.offPolicy'],
    rationale:
      "A seat that took a preflop line the reference policy never takes carries an UNCHANGED (uninformative) range, per A3's off-policy rule. Range advantage and nut advantage computed against such a range are near-meaningless, so the flag is surfaced and the answer's confidence drops.",
  },
  {
    id: 'PRIMARY_VILLAIN_SELECTION',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['lastAggressorByStreet', 'postflopOrder', 'seat status'],
    rationale:
      'Range-vs-range equity is computed against ONE villain, because running it against each of up to five would multiply the dominant cost by five. The chosen villain is, in order: the current-street aggressor, else the previous-street aggressor, else the live opponent with the lowest postflop order. Deterministic, and it picks the opponent whose range the action most constrains.',
  },

  // -------------------------------------------------------------------------
  // Measurement
  // -------------------------------------------------------------------------
  {
    id: 'POSTFLOP_REQUIRED_EQUITY',
    provenance: 'DERIVED',
    anchor: 'Anchor 6 / S14 (CardPlayer): the pot-odds relationship is SOURCE as a relationship.',
    inputs: ['callAmountMbb', 'potBeforeDecisionMbb'],
    rationale:
      'S14 states the break-even relationship in worked numbers (roughly 23% equity vs a 2.5bb raise into a 5bb pot, 29% vs 6bb). `call / (pot + call)` is that same relationship written once as a formula, so it is DERIVED from a sourced relationship rather than authored. It is the ONLY postflop input this package can trace to a public source.',
  },
  {
    id: 'HERO_EQUITY_MEASUREMENT',
    // HEURISTIC, not DERIVED, and the anchor line says why: the ENUMERATION is exact
    // arithmetic, but a deterministic function of HEURISTIC inputs is HEURISTIC — the tag
    // describes the weakest input, not the arithmetic (`provenance.ts`). There is no postflop
    // anchor in STRATEGY_ANCHORS.md that could source a villain range (R1B MINOR-9).
    provenance: 'HEURISTIC',
    anchor:
      'Mechanical enumeration (B2); the RANGES it runs against are HEURISTIC, and no public anchor covers a postflop villain range, so the measurement inherits their provenance.',
    inputs: ["hero's two cards", 'board', 'villain ranges'],
    rationale:
      "B2's enumeration is exact showdown arithmetic, so nothing about the MEASUREMENT is a judgement. It is only ever as good as the ranges fed into it, which is why the recommendation's overall quality is the WORST contributing provenance and lands on HEURISTIC. The number is POOLED across every live villain: it is hero's share of the pot, not a per-opponent win rate, which is why the scoring model normalizes it before banding (HERO_EQUITY_FAIR_SHARE_NORMALIZATION) and why the pot-odds comparison uses it raw.",
  },
  {
    id: 'HERO_EQUITY_FAIR_SHARE_NORMALIZATION',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['heroEquity', 'activeOpponentCount'],
    rationale:
      "HERO_EQUITY_BANDS is a 0.5-centred table: 0.5 means break-even against the field. Pooled multiway equity is not on that scale — five ways, an even split is 0.20 — so the raw number is rescaled piecewise-linearly around hero's fair share 1/(1+opponents) before the table is consulted: below fair share onto [0, 0.5], above it onto [0.5, 1]. Heads-up the fair share IS 0.5 and the mapping is the identity, so no heads-up answer changes. Without it a five-way hand holding 92% of its fair share scored identically to one holding 34% of it, because both fell off the bottom of the table. The choice of the fair-share centre and of a piecewise-linear (rather than ratio) rescaling is ours and no public source states it, hence HEURISTIC. It is applied ONLY to HERO_EQUITY: range and nut advantage are measured against the primary villain alone and are already pairwise, and the pot-odds margin is a price comparison that wants the pooled number unmodified.",
  },
  {
    id: 'RANGE_ADVANTAGE_MEASUREMENT',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['hero range', 'primary villain range', 'board'],
    rationale:
      "Range advantage is defined as `rangeVsRangeEquity(hero, primaryVillain, board).equity - 0.5`: how much better than a coin flip hero's WHOLE range does on this board. Defining it against 0.5 rather than against a solved baseline is an authored choice; the number is a genuine measurement of authored ranges.",
  },
  {
    id: 'NUT_ADVANTAGE_MEASUREMENT',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['hero range', 'primary villain range', 'board', 'nutStrengthOnBoard'],
    rationale:
      "Nut advantage is `nutShare(hero) - nutShare(villain)`, where `nutShare(R)` is R's weighted share at or above an ABSOLUTE strength cutoff read off the board's own all-1326-combo strength distribution at the documented NUT percentile. Using a board-referenced absolute cutoff (rather than each range's own percentile) is what makes the two shares comparable. Both the percentile and the use of made-hand strength (rather than equity) are authored choices; strength is used because it costs ~1.3ms per range against ~65ms for an equity distribution.",
  },
  {
    id: 'RANGE_PERCENTILE_MEASUREMENT',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['equityDistribution(hero, primary villain, board)', "hero's combo"],
    rationale:
      "How strong hero's actual hand is WITHIN hero's own range, as the weighted share of hero's range with equity at or above hero's. 0 means the top of the range. Authored as an input to the model; the measurement is B2's. THE BASIS IS PAIRWISE ON BOTH SIDES: the ranked number and every number it is ranked against are hero-combo-vs-PRIMARY-VILLAIN equity on this board, never hero-vs-the-whole-field. Multiway those are different quantities — pooled field equity is systematically lower — so ranking one inside the other understates hero's rank (measured 0.9467 against a coherent 0.9882 for 2h2s three-way on Ah7d2c). FALLBACK, stated explicitly because it is reachable: when hero's actual combo carries no weight in hero's own propagated range the distribution never scored it, and the pairwise number is then obtained from one EXACT `equityVsRange` call against the same primary villain rather than substituted from the multiway measurement. Heads-up that value is already in hand and the answer is unchanged. PRECISION: on the flop and turn the distribution it is ranked in is SUBSAMPLED under the default budget (153 of 1176 flop runouts), which is reported unconditionally through the `EQUITY_METHOD` explanation feature and, when either equity is subsampled, the `EQUITY_SUBSAMPLED` rule. Measured on a full-range flop against a full enumeration: max per-combo equity error 0.0541, max rank error 0.1207 when the ranked value comes from the same subsample, 0.0374 when it is exact.",
  },
  {
    id: 'EQUITY_SUBSAMPLED',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['EquityResult.method'],
    rationale:
      'At least one equity number behind this recommendation was estimated from a deterministic subsample rather than enumerated exactly (B2 §4 measures the error). The recommendation carries the flag so the UI can label it, and its confidence drops one step.',
  },

  // -------------------------------------------------------------------------
  // The scoring model
  // -------------------------------------------------------------------------
  {
    id: 'AGGRESSION_SCORE_MODEL',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['every component in AGGRESSION_COMPONENTS'],
    rationale:
      'The weighted sum of the documented components (see `scoreModel.ts` — the exported component tables are the authoritative list and count) divided by the total weight. Every weight, every threshold and every point value lives in `scoreModel.ts` as exported data with its own rationale. Deliberately NO single component can carry a decision: the largest single weighted contribution is bounded by its weight share, which is asserted in a test, so "top pair therefore bet" is unrepresentable.',
  },
  {
    id: 'CONTINUE_SCORE_MODEL',
    provenance: 'HEURISTIC',
    anchor: 'Its heaviest component (POT_ODDS_MARGIN) rests on the DERIVED required-equity rule.',
    inputs: ['every component in CONTINUE_COMPONENTS'],
    rationale:
      'The same machinery, applied to the fold-or-continue question when hero faces a bet. Its heaviest weight is the pot-odds margin, which is the one traceable relationship this policy has; the rest (hand strength, draw quality, position, multiway, bet size faced, range percentile) are authored.',
  },
  {
    id: 'AGGRESSION_FREQUENCY_BANDS',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['aggression score'],
    rationale:
      'Seven documented score bands map to seven aggression frequencies on the 5-point grid. The extremes are 9500 and 0: a REFERENCE policy with no solver behind it never claims a pure 100% bet, and never claims a pure bluff either.',
  },
  {
    id: 'CONTINUE_FREQUENCY_BANDS',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['continue score'],
    rationale:
      'Seven documented score bands map to seven continue (call-or-raise) frequencies. 10000 IS reachable at the top: a hand that beats the price by a wide margin should never be shown a fold frequency.',
  },
  {
    id: 'RAISE_SHARE_BANDS',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['aggression score'],
    rationale:
      'Once the continue mass is fixed, the aggression score decides how much of it raises. Splitting the decision in two (continue first, then how) keeps a hand that is priced in but not strong from being forced to choose between folding and raising.',
  },

  // -------------------------------------------------------------------------
  // Multiway
  // -------------------------------------------------------------------------
  {
    id: 'MULTIWAY_AGGRESSION_SCALE',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['activeOpponentCount'],
    rationale:
      'A multiplicative scale on the aggression frequency, applied AFTER the band lookup, one entry per opponent count, floored onto the 5-point grid. It exists on top of the MULTIWAY score component so the reduction is structural rather than incidental: a ceiling would only bite when a spot happened to sit above it, whereas a scale makes every non-zero aggression frequency strictly lower with each extra opponent. With more players to get through, both bluffs and thin value must fire less often.',
  },
  {
    id: 'MULTIWAY_CONTINUE_PENALTY',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['activeOpponentCount', 'pot-odds margin (as the floor)'],
    rationale:
      'A flat bps penalty subtracted from the continue frequency per extra opponent. Every additional live opponent is another range that has to be beaten, so the continuing threshold tightens structurally, not just through the score. It is a reduction, never a cap, and it stops at the frequency the PRICE alone already justifies at hero equity margin (the same graded pot-odds table the all-in path uses): a subtraction about extra ranges must not argue a hand out of a call the price has settled, which is what produced a fold frequency for three-handed quads before the floor existed.',
  },
  {
    id: 'MULTIWAY_DEGRADE',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['activeOpponentCount'],
    rationale:
      "B2 note 8 is explicit that the equity engine treats multiway ranges as independent priors and models no correlation between them, and B2 §4 measures multiway flop equity as roughly plus or minus two points. A multiway answer is therefore materially less trustworthy than a heads-up one, and says so: confidence drops and the recommendation's provenance is degraded a step.",
  },

  // -------------------------------------------------------------------------
  // All-in
  // -------------------------------------------------------------------------
  {
    id: 'FACING_ALL_IN_POT_ODDS',
    provenance: 'HEURISTIC',
    anchor: 'Anchor 6 / S14 for the price; the MARGIN and the graded bands are authored.',
    inputs: ['hero equity', 'required equity', 'ALL_IN_CALL_MARGIN'],
    rationale:
      "Facing a committed stack there are no later streets to win, so how OFTEN hero continues is a price question: the continuing mass comes from the graded pot-odds bands rather than from the continue score. The price comparison is the DERIVED required-equity rule; the band table around it, and the margin that absorbs range-model and subsampling error, are authored. The bands are graded rather than a hard cut precisely because a binary answer would claim a precision the range model does not have. This rule fixes the continuing mass only — whether any of it can RAISE is FACING_ALL_IN_ISOLATION's question, because 'there is nothing left to raise into' is true heads-up and false multiway.",
  },
  {
    id: 'FACING_ALL_IN_ISOLATION',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['allInCollapsedTree', 'legalActions.wager', 'aggression score', 'RAISE_SHARE_BANDS'],
    rationale:
      'An all-in in front of hero collapses the decision to call or fold only when the TREE has collapsed: hero has no legal aggression, or no live opponent besides the shover remains. That is always the case heads-up and often not the case multiway — a short stack shoves, a deep opponent is still to act, and isolating with a strong hand is the standard line, not an exotic one. When the tree is still live the continuing mass is split by the same RAISE_SHARE band the ordinary facing-a-bet path uses, so the raise is reachable exactly when the aggression score supports it; when it has collapsed the raising share is structurally zero. No public source covers a postflop spot with a shove and live players behind it, so the adjustment is authored and says so.',
  },
  {
    id: 'ALL_IN_SPR_GATE',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['spr', 'aggression band', 'legalActions.allIn.effect'],
    rationale:
      "ALL_IN is the top sizing bucket and is selectable only when the remaining-stack-to-pot ratio is at or below the documented gate AND the aggression band is at least the documented minimum. Above the gate a shove is a size no pot-fraction bucket would ever produce, so offering it would be inventing a line. A shove the ENGINE classifies as a CALL (`allIn.effect === 'CALL'` — hero cannot cover the outstanding bet, so the last chip in raises nothing) is not an aggressive action at all and is refused for the same chain: emitting it would put a second row carrying identical money beside CALL and understate the call frequency. In both cases the aggressive frequency falls through to the passive action and is merged into it, and this rule id is reported so the fall-through is visible. A clamp to the engine maximum can still produce an all-in amount from an ordinary bucket; that path is recorded as a clamp, not as a shove.",
  },

  // -------------------------------------------------------------------------
  // Sizing
  // -------------------------------------------------------------------------
  {
    id: 'SIZING_BUCKET_SET',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['POT_FRACTION_BUCKETS'],
    rationale:
      'A fixed eight-member ladder of pot fractions (25/33/50/67/75/100/125/150) plus ALL_IN. A size is always one of these, so a recommendation can never emit a pseudo-precise 47.83% pot. The ladder is what CLAUDE.md rule 2 looks like applied to sizing.',
  },
  {
    id: 'SIZING_BASE_BY_BAND',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['aggression band'],
    rationale:
      'The starting rung of the ladder, one per aggression band. Bluff-weighted bands start at the SAME rung as the value band immediately above them, so a bluff is not sized differently from the value hands it represents.',
  },
  {
    id: 'SIZING_TEXTURE_MODIFIER',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['BoardFeatures.tendency'],
    rationale:
      "One rung down on a STATIC board, one up on a DYNAMIC one. A static board's equities barely move, so a small size buys the same fold; a dynamic board charges draws and protects made hands. Reuses B1's authored tendency rule rather than re-deriving texture.",
  },
  {
    id: 'SIZING_NUT_ADVANTAGE_MODIFIER',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['nut advantage'],
    rationale:
      'One rung up when hero holds the documented nut-advantage margin, one down when villain does. A range that holds the top of the board can use a size the other range cannot profitably continue against; a range that does not, cannot.',
  },
  {
    id: 'SIZING_RANGE_ADVANTAGE_MODIFIER',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['range advantage', 'BoardFeatures.tendency'],
    rationale:
      'One rung DOWN when hero has the documented range-advantage margin on a STATIC board. This is the "small and frequent" shape, and it is deliberately conditioned on the texture: the same range advantage on a dynamic board does not want the small size, which is why this modifier and the texture modifier are separate entries rather than one combined number.',
  },
  {
    id: 'SIZING_SPR_MODIFIER',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['spr'],
    rationale:
      'One rung up at low SPR (the stack is nearly committed, so the size that sets up the next street is larger relative to the pot), one down at high SPR (more streets remain to apply pressure over).',
  },
  {
    id: 'SIZING_MULTIWAY_MODIFIER',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['activeOpponentCount'],
    rationale:
      'One rung down against three or more opponents. The extra folds a multiway pot needs are bought by betting LESS OFTEN (the cap and the score component), not by betting bigger into more ranges; sizing up here would compound the risk instead of reducing it.',
  },
  {
    id: 'SIZING_STREET_MODIFIER',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['street'],
    rationale:
      'One rung up on the river. No cards remain, so the size no longer has to leave room for a later street and the range is at its most polarized.',
  },
  {
    id: 'SIZING_RAISE_MODIFIER',
    provenance: 'HEURISTIC',
    anchor: NO_ANCHOR,
    inputs: ['facing a bet'],
    rationale:
      'One rung up when the aggressive action is a RAISE rather than a BET. A raise has to charge a range that has already committed money, and the pot it is measured against already contains that money.',
  },
  {
    id: 'SIZING_POT_FRACTION_TO_AMOUNT',
    provenance: 'DERIVED',
    anchor: 'Mechanical: integer milliBB arithmetic with one explicit rounding.',
    inputs: ['pot fraction', 'potBeforeDecisionMbb', 'callAmountMbb', "hero's street contribution"],
    rationale:
      "A BET of fraction f is `heroStreetContribution + round(potBeforeDecision * f)`. A RAISE of fraction f is `callToAmount + round((potBeforeDecision + callAmount) * f)` — the fraction applies to the pot AS IT WOULD BE after hero calls, which is the standard reading of 'raise to X% of the pot'. All integer milliBB through `Money.mulRatio` with exactly one rounding (CLAUDE.md rule 1).",
  },

  // -------------------------------------------------------------------------
  // Policy mechanics — mirrored from `preflop/rules.ts`, same classification
  // -------------------------------------------------------------------------
  {
    id: 'LEGALITY_CLAMP',
    provenance: 'DERIVED',
    anchor: "A3's clamp-and-degrade policy, applied unchanged.",
    inputs: ['requested bet/raise-TO', 'wager bounds'],
    rationale:
      "The requested TO amount is clamped into the engine's legal bounds; the ORIGINAL request is retained beside it (CLAUDE.md rule 3), the direction is recorded, and the sizing's provenance drops one step because a clamped size is no longer the size the rule prescribed. An illegal size is never emitted.",
  },
  {
    id: 'LEGALITY_SUBSTITUTION',
    provenance: 'DERIVED',
    anchor: "A3's substitution chains, extended for BET.",
    inputs: ['legalActions'],
    rationale:
      "First legal candidate wins: BET -> RAISE -> ALL_IN -> CHECK -> CALL -> FOLD; RAISE -> BET -> ALL_IN -> CALL -> CHECK -> FOLD; CALL -> CHECK -> FOLD; FOLD -> CHECK -> FOLD -> CALL. As preflop, the fold bucket reaches for CHECK before FOLD, because when continuing is free a check strictly dominates a fold. Legality is read from the engine and never inferred: a wager candidate needs the engine's own `wager.kind`, and the ALL_IN candidate needs `allIn.effect` to be BET or RAISE, because a shove the engine classifies as a CALL is the call. Frequencies are then merged by kind so the total is preserved exactly.",
  },
  {
    id: 'FREQUENCY_QUANTIZATION',
    provenance: 'DERIVED',
    anchor: 'ADR-0056; the same `quantizeFrequencies` the preflop policy uses.',
    inputs: ['raw frequencies'],
    rationale:
      'Every emitted frequency is a multiple of 500 bps and the set sums to exactly 10000, apportioned by largest remainder with a fixed tie-break. This engine has no solver behind it and will never state a frequency finer than five percentage points.',
  },
  {
    id: 'PRIMARY_ACTION_TIE_BREAK',
    provenance: 'DERIVED',
    anchor: "A3's tie-break, with BET slotted between CALL and RAISE.",
    inputs: ['action frequencies'],
    rationale:
      'Highest frequency wins; a tie goes to the LEAST committing action (FOLD < CHECK < CALL < BET < RAISE < ALL_IN), so a genuine 50/50 is never displayed as if the aggressive line were the recommendation.',
  },

  // -------------------------------------------------------------------------
  // Degradation and environment — same triggers as preflop
  // -------------------------------------------------------------------------
  {
    id: 'STACK_BUCKET_NEARBY',
    provenance: 'DERIVED',
    anchor: 'ADR-0056 stack buckets.',
    inputs: ['stackBucket'],
    rationale:
      'The effective stack is one bucket away from the reference depth. The model is not re-tuned per bucket — inventing per-depth thresholds would be inventing data — so what changes is the honesty label.',
  },
  {
    id: 'STACK_BUCKET_DISTANT',
    provenance: 'HEURISTIC',
    anchor: 'ADR-0056 stack buckets.',
    inputs: ['stackBucket'],
    rationale:
      'Two or more buckets from the reference depth. The SPR component does react to depth, but the score bands themselves were authored at reference depth, so the answer is forced HEURISTIC.',
  },
  {
    id: 'STACK_BUCKET_OUT_OF_RANGE',
    provenance: 'HEURISTIC',
    anchor: "ADR-0056's typed OUT_OF_RANGE member.",
    inputs: ['stackBucket'],
    rationale:
      'Below 40bb effective. Nothing in this package was authored for that depth; the answer is forced HEURISTIC and an UNMODELLED_STACK_DEPTH feature is emitted so the UI can say so.',
  },
  {
    id: 'LINEUP_SHORT_HANDED',
    provenance: 'HEURISTIC',
    anchor: 'Anchor 8: the mechanical reuse rule is UNVERIFIED -> HEURISTIC.',
    inputs: ['dealtInCount'],
    rationale:
      "5 or 4 dealt in. The preflop ranges this policy's range advantage rests on were authored for a 6-max ladder, and anchor 8's own verdict on reusing that ladder short-handed is UNVERIFIED. (A3's registry classified the same trigger DERIVED on its brief's instruction and flagged the divergence in its report; this registry follows the anchor doc.)",
  },
  {
    id: 'LINEUP_VERY_SHORT_HANDED',
    provenance: 'HEURISTIC',
    anchor: 'Anchor 8: no public source states a 3-handed or heads-up range table at all.',
    inputs: ['dealtInCount'],
    rationale:
      '3 dealt in or heads-up. Forced HEURISTIC for the same reason as LINEUP_SHORT_HANDED, more strongly: at three-handed the positional ladder the preflop ranges assume has collapsed entirely.',
  },
  {
    id: 'ENVIRONMENT_COMPATIBILITY',
    provenance: 'DERIVED',
    anchor: 'Anchor 9 + ADR-0056.',
    inputs: ['environment'],
    rationale:
      'The live table is compared to the environment the reference material assumes and reported as APPROXIMATE or DIVERGENT. There is deliberately no EXACT member, and no numeric ante or rake adjustment is applied anywhere.',
  },
];

const BY_ID = new Map<PostflopRuleId, PostflopRule>(RULES.map((rule) => [rule.id, rule]));
invariant(BY_ID.size === RULES.length, 'the postflop rule registry has a duplicate id');

/** Every rule, in declaration order. */
export const POSTFLOP_RULES: readonly PostflopRule[] = RULES;

/** Throws on an unknown id — a programmer error, since ids are a closed union. */
export function postflopRule(id: PostflopRuleId): PostflopRule {
  const rule = BY_ID.get(id);
  invariant(rule !== undefined, `no postflop rule registered for ${id}`);
  return rule;
}
