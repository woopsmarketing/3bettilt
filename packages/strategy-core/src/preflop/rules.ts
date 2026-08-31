/**
 * The rule registry: every documented rule the preflop reference policy can apply, with a
 * stable string id, its inputs, its rationale and its provenance.
 *
 * Why a registry and not scattered comments: a recommendation reports the ids it used, so a
 * reviewer can go from a number on screen to the rule that produced it and from there to the
 * anchor that justifies it, without reading the policy code. `docs/reports/STRATEGY_WP_A3.md`
 * is generated from this table by hand and must stay in step with it.
 *
 * Provenance follows `docs/reports/STRATEGY_ANCHORS.md` section 3 verdicts, which are
 * binding: VERIFIED -> SOURCE, sources-disagree / single-sourced -> DERIVED, no public
 * source -> HEURISTIC.
 *
 * NOTHING here is GTO. This is 기본전략 · REFERENCE (CLAUDE.md rule 2).
 */
import { invariant } from '@gto-self/shared';
import type { Provenance } from '../provenance.js';

export type PreflopRuleId =
  // range selection, per spot family
  | 'RFI_TABLE'
  | 'RFI_SB_RAISE_ONLY_TRIM'
  | 'RFI_HEADS_UP_BUTTON'
  | 'VS_LIMP_ISO'
  | 'VS_LIMP_BB_VS_SB'
  | 'VS_OPEN_MIX'
  | 'BLIND_VS_BLIND_MIX'
  | 'SQUEEZE_MIX'
  | 'OPEN_PLUS_CALLER_CONTINUE'
  | 'OPENER_VS_3BET_MIX'
  | 'COLD_4BET_MIX'
  | 'VS_4BET_MIX'
  | 'VS_ALLIN_POT_ODDS'
  | 'FACING_ALLIN_IN_TREE'
  | 'UNSUPPORTED_SPOT_FALLBACK'
  // sizing
  | 'SIZE_RFI'
  | 'SIZE_ISO_VS_LIMP'
  | 'SIZE_BB_VS_SB_LIMP'
  | 'SIZE_THREE_BET_IP'
  | 'SIZE_THREE_BET_OOP'
  | 'SIZE_FOUR_BET_IP'
  | 'SIZE_FOUR_BET_OOP'
  | 'SIZE_SQUEEZE'
  | 'SIZE_FIVE_BET_SHOVE'
  | 'SIZE_FACING_ALLIN_JAM'
  // policy mechanics
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
  // environment
  | 'ENVIRONMENT_COMPATIBILITY';

export interface PreflopRule {
  readonly id: PreflopRuleId;
  readonly provenance: Provenance;
  /** Anchor doc citation: the anchor number and the sources behind it. */
  readonly anchor: string;
  /** What the rule reads. */
  readonly inputs: readonly string[];
  /** Why it is the rule it is — mandatory, and mandatory in prose for HEURISTIC. */
  readonly rationale: string;
}

const RULES: readonly PreflopRule[] = [
  {
    id: 'RFI_TABLE',
    provenance: 'DERIVED',
    anchor: 'Anchor 1 (S1 hand lists; percentages corroborated by S1/S3/S4)',
    inputs: ['heroPosition'],
    rationale:
      'S1 is the only public source with 13x13 detail for 6-max cash 100bb, so the LIST is single-sourced; the percentage each list produces is corroborated three ways and is asserted against the published band.',
  },
  {
    id: 'RFI_SB_RAISE_ONLY_TRIM',
    provenance: 'DERIVED',
    anchor: 'Anchor 1 + Anchor 6 (S1 composite; band from S10/S3/S4)',
    inputs: ['S1 SB raise-or-limp composite list', 'the 40-47% raise-only band'],
    rationale:
      "S1's 62.3% SB figure is a raise-or-limp composite the anchor doc forbids using directly in a raise-or-fold engine. The composite's OFFSUIT classes are dropped ONE AT A TIME — weakest kicker first, ties broken by the weaker high card — until the list first falls inside the cross-verified 40-47% raise-only band. Ordering by the kicker is the same operation the source's own `K4o+` / `Q5o+` notation performs, so no new hand-strength metric is invented; trimming per CLASS rather than per RUN is what keeps the broadway offsuit hands (QJo, QTo, JTo) in a range that would otherwise fold them while opening K4o.",
  },
  {
    id: 'RFI_HEADS_UP_BUTTON',
    provenance: 'HEURISTIC',
    anchor: 'None — no public heads-up table exists (Anchor 8 stops at 5- and 4-handed)',
    inputs: ['lineupSize', 'RFI_NOTATION.BTN', 'the SB raise-only list'],
    rationale:
      'Heads-up the button has NO players behind it, and the 6-max BTN and SB tables were authored for a seat with four or one. Both are far too tight for the spot. The heads-up button range is therefore the UNION of those two lists — a widening whose construction is stated rather than a percentage that was chosen — and it is a FLOOR, not a heads-up range: no public source publishes a heads-up chart, and real heads-up button ranges are substantially wider. Every heads-up recommendation is already forced to HEURISTIC by LINEUP_VERY_SHORT_HANDED and additionally carries the HEADS_UP_BUTTON_APPROXIMATION explanation feature.',
  },
  {
    id: 'VS_LIMP_ISO',
    provenance: 'HEURISTIC',
    anchor: 'No public iso-raise range found; sizing side is S8 (see SIZE_ISO_VS_LIMP)',
    inputs: ['heroPosition', 'limperCount'],
    rationale:
      'Authored: iso-raise exactly the hands the position opens first-in and give up the rest, mirroring the raise-or-fold design. No public source publishes an iso-raise range, so only the direction (raise or fold, never limp behind) is borrowed from the SB raise-or-fold verdict.',
  },
  {
    id: 'VS_LIMP_BB_VS_SB',
    provenance: 'DERIVED',
    anchor: 'Anchor 7 (S13, single-sourced)',
    inputs: ['blindVsBlind', 'heroPosition'],
    rationale:
      'S13 states the BB raises an SB limp with "around 40-45% of the hands"; the SB raise-only list derived for RFI is the nearest range this package already has, so it is reused rather than a second list being authored. DIVERGENCE, recorded rather than hidden: after the per-class trim that list is 46.9%, just above S13\'s stated 40-45%. Widening the trim to land inside S13\'s narrower window would have moved the RFI table off the 40-47% band three sources agree on, and the RFI band is the better-corroborated of the two.',
  },
  {
    id: 'VS_OPEN_MIX',
    provenance: 'HEURISTIC',
    anchor: 'Anchor 6 (UNVERIFIED -> HEURISTIC) + Anchor 3 range-construction shape (S5)',
    inputs: ['heroPosition', 'openerPosition', 'heroVsAggressor', 'handClass'],
    rationale:
      'No public source publishes a defend-percentage table, so the four continue tiers and the value/mixed/bluff split are authored. Only the direction is sourced: closing the action cheaply from the BB defends widest, out-of-position continues are tightest (S14 pot-odds relationship, S5 range shape).',
  },
  {
    id: 'BLIND_VS_BLIND_MIX',
    provenance: 'HEURISTIC',
    anchor: 'Anchor 7 (S10 BvB sizing, qualitative) + Anchor 6',
    inputs: ['heroPosition', 'heroVsAggressor', 'handClass'],
    rationale:
      'Authored, same machinery as VS_OPEN_MIX: the BB closing against an SB open gets the widest tier because it is the cheapest continue in the game; an SB facing a BB raise takes the medium tier because it is out of position for every remaining street.',
  },
  {
    id: 'SQUEEZE_MIX',
    provenance: 'HEURISTIC',
    anchor: 'No public squeeze RANGE found; the sizing side is Anchor 5 (S7/S8)',
    inputs: ['heroVsAggressor', 'coldCallerCount', 'handClass'],
    rationale:
      'Authored: cold money in the pot in front of a player who has not yet acted narrows the profitable continue set sharply, so the squeeze range is value-heavy with a small suited-ace bluff core and cold-calling is reserved for position.',
  },
  {
    id: 'OPEN_PLUS_CALLER_CONTINUE',
    provenance: 'HEURISTIC',
    anchor: 'No public source for this line',
    inputs: ['handClass'],
    rationale:
      'Authored: hero has already put money in and now faces a raise plus at least one caller. Multiway and with the initiative gone, the policy continues only with the tight tier and re-raises only the value core.',
  },
  {
    id: 'OPENER_VS_3BET_MIX',
    provenance: 'HEURISTIC',
    anchor: 'No public 4-bet RANGE found; the sizing side is Anchor 4 (S1/S6)',
    inputs: ['heroVsAggressor', 'handClass'],
    rationale:
      'Authored: a premium 4-bet value core, a suited-wheel-ace bluff core at an even mix, and a continue set that flats the rest. Sizing is the only sourced half of this spot.',
  },
  {
    id: 'COLD_4BET_MIX',
    provenance: 'HEURISTIC',
    anchor: 'No public source for cold 4-bet ranges',
    inputs: ['handClass'],
    rationale:
      'Authored and deliberately the tightest table in the file: hero has shown nothing, two players have shown strength, and cold-calling a 3-bet out of the blind is the line this policy declines to author at all.',
  },
  {
    id: 'VS_4BET_MIX',
    provenance: 'HEURISTIC',
    anchor: 'No public 5-bet range or sizing found',
    inputs: ['handClass'],
    rationale:
      'Authored: at reference stack depth the 5-bet is a shove or nothing, so the table is a shove core, a call core and a fold. Frequencies are 100/0 by design — a mixed 5-bet frequency would be fake precision.',
  },
  {
    id: 'VS_ALLIN_POT_ODDS',
    provenance: 'HEURISTIC',
    anchor: 'Anchor 6 (S14 pot-odds relationship is SOURCE; the ranges that clear it are not)',
    inputs: ['potOdds', 'handClass'],
    rationale:
      "S14's worked equity thresholds are verified as a RELATIONSHIP, so the tier is selected by the pot odds the engine already computed; the four calling ranges themselves are authored, because no public source states which range clears a given equity threshold. This rule applies ONLY to a COLLAPSED tree — hero cannot raise, or nobody but the shover can still act. An all-in hero can still raise over, with live players behind it, keeps its own family and is answered by FACING_ALLIN_IN_TREE.",
  },
  {
    id: 'FACING_ALLIN_IN_TREE',
    provenance: 'HEURISTIC',
    anchor: 'Anchor 6 (S14 pot-odds relationship is SOURCE; nothing else here is)',
    inputs: ['facingAllIn', 'potOdds', 'the family outcome'],
    rationale:
      "An all-in in front of hero that leaves BOTH a legal raise and a live opponent behind has not collapsed the tree: hero can still isolate, so the spot keeps its own family and that family's answer is adjusted, not replaced. The adjustment is deterministic. (1) RAISE frequency is kept exactly as the family assigned it — the value core still wants the money in, and a premium hand must never flat a shove while players are still to act. (2) CALL frequency survives only if the class also clears the pot-odds tier the engine's own price selects (S14's relationship, the one sourced input here), because continuing against a committed stack is a pure equity question with no later streets to win. (3) Whatever leaves CALL goes to FOLD. Authored: no public source covers a preflop spot with a short shove and live players behind it.",
  },
  {
    id: 'UNSUPPORTED_SPOT_FALLBACK',
    provenance: 'HEURISTIC',
    anchor: 'None — this rule exists because the spot is outside the modelled tree',
    inputs: ['potOdds', 'handClass', 'legalActions'],
    rationale:
      'Authored catch-all so hero always gets an answer in a line `spot.ts` reports UNSUPPORTED (a caller facing a 3-bet, a cold 5-bet, anything beyond a 4-bet). Narrow and passive on purpose: it continues with a small premium set and never authors a raise in a line the package does not model.',
  },

  {
    id: 'SIZE_RFI',
    provenance: 'SOURCE',
    anchor: 'Anchor 2 (S1, S3, S4 identical)',
    inputs: ['bigBlindMbb', 'heroPosition'],
    rationale: 'Raise to 2.5bb first in, 3bb from the small blind.',
  },
  {
    id: 'SIZE_ISO_VS_LIMP',
    provenance: 'DERIVED',
    anchor: 'Anchor 2 (S8, single-sourced for the limper term)',
    inputs: ['bigBlindMbb', 'heroPosition', 'limperCount'],
    rationale:
      'The RFI size plus 1bb per limper. The base is SOURCE, the per-limper term is stated only by S8, so the combined rule is DERIVED.',
  },
  {
    id: 'SIZE_BB_VS_SB_LIMP',
    provenance: 'DERIVED',
    anchor: 'Anchor 7 (S13, single-sourced)',
    inputs: ['bigBlindMbb'],
    rationale:
      'S13 gives "3.5-4 big blinds" against a balanced limper; the low end is used and the high end is the documented alternative.',
  },
  {
    id: 'SIZE_THREE_BET_IP',
    provenance: 'DERIVED',
    anchor: 'Anchor 3 (S5 and S8 say 3x, S1 says 3.5x — sources disagree)',
    inputs: ['openSizeMbb'],
    rationale:
      "3.0x the open, the figure two of three independent sources state. S1's 3.5x is kept in `tables.ts` as `THREE_BET_IP_ALTERNATIVE` so the disagreement stays visible.",
  },
  {
    id: 'SIZE_THREE_BET_OOP',
    provenance: 'SOURCE',
    anchor: 'Anchor 3 (S1 4x, S5 4-4.5x, S8 4x)',
    inputs: ['openSizeMbb'],
    rationale: '4x the open out of position; all three sources agree on ~4x.',
  },
  {
    id: 'SIZE_FOUR_BET_IP',
    provenance: 'SOURCE',
    anchor: 'Anchor 4 (S6 cash "around 2.3x"; S1 cash 6-max "2.3x")',
    inputs: ['lastAggressionToMbb'],
    rationale: '2.3x the 3-bet in position.',
  },
  {
    id: 'SIZE_FOUR_BET_OOP',
    provenance: 'SOURCE',
    anchor: 'Anchor 4 (S6 "2.5x to 2.6x"; S1 "2.5x")',
    inputs: ['lastAggressionToMbb'],
    rationale: '2.5x the 3-bet out of position, the figure both sources share.',
  },
  {
    id: 'SIZE_SQUEEZE',
    provenance: 'DERIVED',
    anchor: 'Anchor 5 (S8 chosen; S7 flat 3x+1x/caller is the documented alternative)',
    inputs: ['openSizeMbb', 'heroVsAggressor', 'coldCallerCount'],
    rationale:
      '4x the open in position, 5x out of position, plus 1x the open for each cold caller beyond the first. Chosen over S7 because it is more granular and matches the IP<OOP asymmetry already adopted for plain 3-bets.',
  },
  {
    id: 'SIZE_FIVE_BET_SHOVE',
    provenance: 'HEURISTIC',
    anchor: 'None — no public 5-bet sizing found',
    inputs: ['legalActions.wager.maxToAmountMbb'],
    rationale:
      'Authored: at reference depth a 5-bet that is not all-in commits the stack anyway, so the policy shoves rather than inventing a non-committing 5-bet size no source supports.',
  },
  {
    id: 'SIZE_FACING_ALLIN_JAM',
    provenance: 'HEURISTIC',
    anchor: 'None — no public source sizes a raise over a preflop shove',
    inputs: [
      'the family sizing request',
      'legalActions.wager bounds',
      "hero's street contribution",
    ],
    rationale:
      "When hero raises over an all-in, the family's own sizing formula is used unchanged as long as it leaves a real stack behind. It is replaced by the JAM once the requested raise-TO reaches the midpoint between hero's current street contribution and the engine's maximum, because past that point the raise cannot fold out the stack that is already committed and leaves hero too short to fold to the players behind. The midpoint is authored — half a stack is the conventional commitment line, not a sourced figure — and a request that simply exceeds the maximum is handled by LEGALITY_CLAMP as before.",
  },

  {
    id: 'LEGALITY_CLAMP',
    provenance: 'DERIVED',
    anchor: 'None — an engine-legality rule, not a strategy number',
    inputs: ['requested raise-TO', 'legalActions.wager bounds'],
    rationale:
      "CLAMP-AND-DEGRADE: a requested raise-TO outside the engine's legal bounds is clamped into them, the ORIGINAL request is retained beside it (CLAUDE.md rule 3), and the sizing's provenance drops one step because a clamped size is no longer the size the source prescribed.",
  },
  {
    id: 'LEGALITY_SUBSTITUTION',
    provenance: 'DERIVED',
    anchor: 'None — an engine-legality rule, not a strategy number',
    inputs: ['policy action kinds', 'legalActions'],
    rationale:
      'A policy action the engine does not offer hands its frequency to a documented substitute, first legal candidate wins: RAISE -> ALL_IN -> CALL -> CHECK -> FOLD; CALL -> CHECK -> FOLD; FOLD -> CHECK -> FOLD -> CALL. The fold bucket reaches for CHECK before FOLD, because a free continue strictly dominates folding: "not in the continue range" must render as a check in an unraised pot. Frequencies are merged by kind afterwards, so the total is preserved exactly.',
  },
  {
    id: 'FREQUENCY_QUANTIZATION',
    provenance: 'DERIVED',
    anchor: 'None — an output-shape rule',
    inputs: ['per-action frequencies'],
    rationale:
      'Every emitted frequency is a multiple of 500 bps (5 percentage points) and the set sums to exactly 10000, via the largest-remainder apportionment in `../bps.ts` over 20 five-point units. Anything finer would present authored guesses as solver precision.',
  },
  {
    id: 'PRIMARY_ACTION_TIE_BREAK',
    provenance: 'DERIVED',
    anchor: 'None — a presentation rule',
    inputs: ['per-action frequencies'],
    rationale:
      'The primary action is the highest frequency; a tie is broken toward the LEAST committing action (FOLD < CHECK < CALL < RAISE < ALL_IN), because a genuine 50/50 must never be shown as if the aggressive line were the recommendation.',
  },

  {
    id: 'STACK_BUCKET_NEARBY',
    provenance: 'DERIVED',
    anchor: 'Anchors are authored for 100bb; ADR-0016 item 5 / `stackBucket.ts`',
    inputs: ['stackBucket'],
    rationale:
      'The 60-79 and 120-159 buckets adjoin the 80-119 reference bucket and reuse its tables with every provenance degraded one step.',
  },
  {
    id: 'STACK_BUCKET_DISTANT',
    provenance: 'HEURISTIC',
    anchor: 'None',
    inputs: ['stackBucket'],
    rationale:
      'The 40-59 and 160+ buckets are two or more steps from the reference bucket. The tables are still the only ones this package has, so they are reused with every provenance forced to HEURISTIC.',
  },
  {
    id: 'STACK_BUCKET_OUT_OF_RANGE',
    provenance: 'HEURISTIC',
    anchor: 'None — `stackBucket.ts` models nothing below 40bb',
    inputs: ['stackBucket'],
    rationale:
      'Below 40bb there is no bucket at all. The reference tables are reused, everything is forced to HEURISTIC, and the recommendation carries an explicit unmodelled-depth feature. Short-stack play is a different game and this package does not model it.',
  },
  {
    id: 'LINEUP_SHORT_HANDED',
    provenance: 'DERIVED',
    anchor: 'Anchor 8 (S11 mechanism SOURCE; the mechanical reuse rule is our extrapolation)',
    inputs: ['lineupSize'],
    rationale:
      'At 5 and 4 dealt in, the positions still present keep their 6-max tables. S11 documents the mechanism (shrinking the field removes the tightest seats first) but states no numeric short-handed table, so this is an extrapolation, not a source.',
  },
  {
    id: 'LINEUP_VERY_SHORT_HANDED',
    provenance: 'HEURISTIC',
    anchor: 'None — no public 3-handed or heads-up table found',
    inputs: ['lineupSize'],
    rationale:
      "At 3 dealt in and heads-up the positional ladder no longer resembles the one the tables were authored for, so the tables are reused with every provenance forced to HEURISTIC. Heads-up the button additionally opens its own widened table (RFI_HEADS_UP_BUTTON) rather than a 6-max seat's list, because a seat with nobody behind it is the one case where reuse is not merely approximate but directionally wrong.",
  },

  {
    id: 'ENVIRONMENT_COMPATIBILITY',
    provenance: 'DERIVED',
    anchor: 'Anchor 9 (S12: direction only, no cash-applicable numeric ante factor exists)',
    inputs: ['environment.anteEnabled', 'environment.rake', 'stackBucket', 'lineupSize'],
    rationale:
      'The tables were authored against public 100bb 6-max cash charts whose rake and ante structure is not stated. A live table with an ante and a rake is therefore APPROXIMATE at best and never an exact match; NO numeric ante adjustment is applied, because no public source gives one for a cash structure.',
  },
];

const RULE_BY_ID = new Map<PreflopRuleId, PreflopRule>(RULES.map((rule) => [rule.id, rule]));

/** Every rule, in declaration order. */
export const PREFLOP_RULES: readonly PreflopRule[] = RULES;

/** Throws on an unknown id (the union is closed over `RULES`). */
export function preflopRule(id: PreflopRuleId): PreflopRule {
  const found = RULE_BY_ID.get(id);
  invariant(found !== undefined, `unknown preflop rule ${id}`);
  return found;
}
