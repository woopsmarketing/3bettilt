/**
 * THE WHOLE FREQUENCY POLICY, AS DATA — the `postflop/scoreModel.ts` convention applied to the
 * ADAPTIVE layer. Every gain, ceiling, gate and cap the frequency arithmetic uses lives in this
 * file and is exported; `frequency.ts` holds control flow and integer arithmetic and no policy
 * number at all.
 *
 * ---------------------------------------------------------------------------------------
 * WHAT A RULE IS
 *
 * A rule is one sentence of poker reasoning, made falsifiable: "when THIS opponent stat sits on
 * THIS side of its zero-adjustment anchor, and hero's spot looks like THIS, move THIS much mass
 * toward THIS target, and never more than THAT." It fires on `estimate - prior`, so at zero
 * evidence it contributes exactly zero and ADAPTIVE is byte-identical to REFERENCE.
 *
 * EVERY NUMBER BELOW IS `HEURISTIC` (ADR-0056) AND CARRIES A MANDATORY NOTE. Nothing here is
 * solver output, nothing is scraped from any solution dataset, and nothing may ever be rendered
 * as a GTO frequency (CLAUDE.md rule 2). The notes are written as OUR OWN PRODUCT JUDGEMENT —
 * read them as "this is the exploit we are willing to state", never as "this is what is
 * correct". The type makes an unexplained number impossible to write.
 *
 * ---------------------------------------------------------------------------------------
 * HOW THE THREE NUMBERS ON A RULE RELATE
 *
 * ```
 *   dev    = estimate - prior                       // signed, from profile.ts
 *   raw    = floor(|dev| * gainBps / 10000)         // GAIN: how hard the read pulls
 *   scaled = floor(raw * confidenceBps / 10000)     // and how sure we are of the read
 *   capped = min(scaled, maxBps)                    // CEILING: the most this one read may do
 * ```
 *
 * GAIN is a slope and MAX is a ceiling, and they are chosen independently. A gain of 4000 says
 * "a 10-point deviation is worth 4 points of frequency"; the cap says "and no matter how
 * extreme the read, one stat never moves the mix by more than this". A rule with a big gain and
 * a small cap reaches its ceiling on a moderate read and then stops — which is exactly the
 * shape we want for a strong, well-understood read like fold-to-c-bet, and the opposite of what
 * we want for a noisy one.
 *
 * The whole table is bounded twice over: by each rule's own `maxBps`, and by
 * `MAX_TOTAL_SHIFT_BPS_*` across every rule at once. The second bound is the one that matters —
 * see `frequency.ts`.
 * ---------------------------------------------------------------------------------------
 */
import type { StrategyPosition } from '@gto-self/strategy-core';
import type {
  AdaptivePostflopStreet,
  AdaptiveStreet,
  AdaptiveStrengthCategory,
  AdaptiveTarget,
} from '../baseline.js';
import type { AdaptiveStatKey } from '../stats.js';
import type { AdaptiveReasonKey } from './reasons.js';

/* -------------------------------------------------------------------------- */
/* Rule vocabulary                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The frequency rules: the twelve of the WP-J design contract §4.2, plus
 * `FOLD_TO_CBET_LOW_VALUE_UP` (WP-K follow-up §1). A closed union.
 */
export type AdaptiveFrequencyRuleId =
  | 'FOLD_TO_CBET_HIGH'
  | 'FOLD_TO_CBET_LOW'
  | 'FOLD_TO_CBET_LOW_VALUE_UP'
  | 'CHECK_RAISE_HIGH'
  | 'WTSD_HIGH_BLUFF_DOWN'
  | 'WTSD_LOW_BLUFF_UP'
  | 'WTSD_HIGH_VALUE_UP'
  | 'VILLAIN_CBET_HIGH'
  | 'VILLAIN_CBET_LOW'
  | 'THREE_BET_HIGH_TIGHTEN'
  | 'FOLD_TO_3BET_HIGH'
  | 'FOLD_TO_3BET_LOW'
  | 'FOLD_BB_TO_STEAL_HIGH';

/**
 * Which side of the anchor activates a rule. A rule NEVER fires on the other side: the two
 * directions of one stat are always two separate rules, so a reader can see both halves of the
 * exploit and disagree with either one independently.
 */
export type AdaptiveRuleDirection = 'ABOVE_PRIOR' | 'BELOW_PRIOR';

/**
 * Whether the rule pushes mass ONTO its target or OFF it.
 *
 * Separate from `direction` because the two are genuinely independent: `FOLD_TO_CBET_LOW`
 * activates BELOW the anchor and DECREASES aggression, while `FOLD_TO_3BET_LOW` also activates
 * below its anchor and also decreases aggression — but `WTSD_LOW_BLUFF_UP` activates below and
 * INCREASES it. Folding the two columns into one signed number would make that table
 * unreadable and the sign easy to get wrong.
 */
export type AdaptiveRuleEffect = 'INCREASE' | 'DECREASE';

/**
 * The spot shape a rule is scoped to. Every member is a property of the BASELINE the caller
 * supplied — never something this package derives from poker order.
 *
 * The predicates themselves live in `frequency.ts` as an exhaustive record over this union:
 * they are control flow (does this action set contain an aggressive row?) rather than model
 * numbers, and keeping them out of the data table is what lets the table read as a table.
 */
export type AdaptiveRuleScope =
  /** The baseline offers at least one BET / RAISE / ALL_IN row. */
  | 'HERO_MAY_AGGRESS'
  /** Hero is not facing a bet AND the baseline offers an aggressive row: hero would be betting. */
  | 'HERO_MAY_BET'
  /** Hero has a live bet to call. */
  | 'HERO_FACING_BET'
  /** Preflop, and the caller states hero's decision is a raise-first-in. */
  | 'PREFLOP_HERO_OPENING'
  /** Preflop, and hero has a raise in front to answer. */
  | 'PREFLOP_HERO_FACING_OPEN'
  /** Preflop, hero opening, and hero's position is one of `STEAL_POSITIONS`. */
  | 'PREFLOP_HERO_STEALING';

/**
 * How a rule names the stat it reads.
 *
 * Five of the rules read a STREET-RELATIVE family (`FOLD_TO_CBET_{FLOP,TURN,RIVER}`,
 * `CBET_{...}`, `CHECK_RAISE_{...}`). Modelling those as three near-duplicate rules each would
 * turn a thirteen-row table into a twenty-three-row one in which most rows differ only in a
 * suffix, and would fork one rule id — and therefore one line of UI copy and one stored trace
 * token — into three. A `BY_STREET` selector keeps the table at exactly the ids the design
 * contract names, and makes "this rule reads the current street's member of a family" a stated
 * property rather than a convention across three rows.
 *
 * A `BY_STREET` selector resolves to `null` on PREFLOP, where the family has no member. That is
 * what stops a postflop rule from firing preflop even if its scope somehow matched.
 */
export type AdaptiveStatSelector =
  | { readonly kind: 'FIXED'; readonly stat: AdaptiveStatKey }
  | {
      readonly kind: 'BY_STREET';
      readonly byStreet: Readonly<Record<AdaptivePostflopStreet, AdaptiveStatKey>>;
    };

/** Total. The stat a selector reads on this street, or `null` when the family has no member. */
export function resolveStat(
  selector: AdaptiveStatSelector,
  street: AdaptiveStreet,
): AdaptiveStatKey | null {
  if (selector.kind === 'FIXED') return selector.stat;
  return street === 'PREFLOP' ? null : selector.byStreet[street];
}

/** One rule of the frequency policy. Every field is data; nothing here is a function. */
export interface AdaptiveFrequencyRule {
  readonly id: AdaptiveFrequencyRuleId;
  readonly stat: AdaptiveStatSelector;
  /** The streets the rule may fire on. */
  readonly streets: readonly AdaptiveStreet[];
  readonly appliesWhen: AdaptiveRuleScope;
  /** The hand-strength categories the rule is scoped to, or `null` for "no band condition". */
  readonly bands: readonly AdaptiveStrengthCategory[] | null;
  readonly direction: AdaptiveRuleDirection;
  readonly target: AdaptiveTarget;
  readonly effect: AdaptiveRuleEffect;
  /** Slope, in bps of contribution per bps of deviation, over 10000. */
  readonly gainBps: number;
  /** Ceiling. The most this single rule may ever contribute, in bps. */
  readonly maxBps: number;
  readonly provenance: 'HEURISTIC';
  readonly reasonKey: AdaptiveReasonKey;
  /** MANDATORY. The poker reasoning, as our own product judgement. Never a GTO claim. */
  readonly note: string;
}

/** The `FOLD_TO_CBET_*` family, keyed by street. */
const FOLD_TO_CBET_BY_STREET: AdaptiveStatSelector = {
  kind: 'BY_STREET',
  byStreet: {
    FLOP: 'FOLD_TO_CBET_FLOP',
    TURN: 'FOLD_TO_CBET_TURN',
    RIVER: 'FOLD_TO_CBET_RIVER',
  },
};

/** The `CBET_*` family, keyed by street. */
const CBET_BY_STREET: AdaptiveStatSelector = {
  kind: 'BY_STREET',
  byStreet: { FLOP: 'CBET_FLOP', TURN: 'CBET_TURN', RIVER: 'CBET_RIVER' },
};

/** The `CHECK_RAISE_*` family, keyed by street. */
const CHECK_RAISE_BY_STREET: AdaptiveStatSelector = {
  kind: 'BY_STREET',
  byStreet: {
    FLOP: 'CHECK_RAISE_FLOP',
    TURN: 'CHECK_RAISE_TURN',
    RIVER: 'CHECK_RAISE_RIVER',
  },
};

/** The three postflop streets, written once. */
const POSTFLOP: readonly AdaptiveStreet[] = ['FLOP', 'TURN', 'RIVER'];
const PREFLOP_ONLY: readonly AdaptiveStreet[] = ['PREFLOP'];

const THIN_AND_AIR: readonly AdaptiveStrengthCategory[] = ['MARGINAL', 'WEAK'];
const VALUE_ONLY: readonly AdaptiveStrengthCategory[] = ['VALUE'];

/**
 * The positions a preflop raise-first-in counts as a STEAL from.
 *
 * `STEAL` and `FOLD_BB_TO_STEAL` are both scoped to CO/BTN/SB by `analysis-core`, which is
 * where the learned counts come from. Listing the same three here is not a second opinion about
 * what a steal is; it is the same scope restated at the point the rule is gated, so a
 * `FOLD_BB_TO_STEAL` reading can never be applied to an under-the-gun open — which would be
 * reading a stat outside the spot it was measured in.
 */
export const STEAL_POSITIONS: readonly StrategyPosition[] = ['CO', 'BTN', 'SB'];

/* -------------------------------------------------------------------------- */
/* The table                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The thirteen rules, in the WP-J design contract §4.2's order with WP-K follow-up §1's
 * `FOLD_TO_CBET_LOW_VALUE_UP` inserted beside the rule it splits. That order is the order
 * contributions are summed and the order adjustments are emitted, so it is part of the output
 * contract and the determinism test compares it as a string.
 *
 * The set is deliberately SMALL and conservative. Thirteen rules over six stats is an MVP: it
 * covers the reads a live player actually acts on — how often this opponent folds, how often
 * they check-raise, whether they reach showdown, how wide they bet, and the two preflop
 * pressure stats — and nothing else. Adding a rule is cheap; removing one after it has shipped
 * inside stored traces is not, which is why the bar for a thirteenth is a stated read plus a
 * reason the existing thirteen do not already express it.
 */
export const ADAPTIVE_FREQUENCY_RULES: readonly AdaptiveFrequencyRule[] = [
  {
    id: 'FOLD_TO_CBET_HIGH',
    stat: FOLD_TO_CBET_BY_STREET,
    streets: POSTFLOP,
    appliesWhen: 'HERO_MAY_AGGRESS',
    bands: null,
    direction: 'ABOVE_PRIOR',
    target: 'AGGRESSION',
    effect: 'INCREASE',
    gainBps: 4000,
    maxBps: 1000,
    provenance: 'HEURISTIC',
    reasonKey: 'OPPONENT_FOLDS_TOO_MUCH',
    note:
      'An opponent who folds to a bet more often than our neutral anchor pays us for betting ' +
      'more of our range at them, whatever we hold — which is why this is the one rule with no ' +
      'band condition. GAIN 4000 is the highest in the table and MAX 1000 the largest ceiling ' +
      'because fold-to-c-bet is the single read we are most confident acting on: it is measured ' +
      'directly against the action hero is about to take, unlike WTSD which is an inference ' +
      'across a whole hand. The ceiling still stops one stat at 10 points of frequency, so even ' +
      'a player who folds every flop cannot turn a mixed strategy into a pure bet.',
  },
  {
    id: 'FOLD_TO_CBET_LOW',
    stat: FOLD_TO_CBET_BY_STREET,
    streets: POSTFLOP,
    appliesWhen: 'HERO_MAY_AGGRESS',
    bands: THIN_AND_AIR,
    direction: 'BELOW_PRIOR',
    target: 'AGGRESSION',
    effect: 'DECREASE',
    gainBps: 4000,
    maxBps: 1000,
    provenance: 'HEURISTIC',
    reasonKey: 'OPPONENT_FOLDS_TOO_LITTLE',
    note:
      'The mirror image of the high twin, and deliberately the SAME gain and ceiling as it. A ' +
      'player who does not fold takes away the part of our betting range that was only ever ' +
      'winning uncontested pots, and the honest response is to bet less often. Making this side ' +
      'weaker than the high side would build a systematic bluff-more bias into the whole ' +
      'engine, which is the exact failure mode an exploit layer is most likely to have; ' +
      'symmetry in the MAGNITUDE is a safety property, not an aesthetic one. WP-K follow-up §1 ' +
      'scoped the BANDS to MARGINAL and WEAK: "they never fold" is a statement about hands that ' +
      'were betting to make someone fold, and it was previously applied to VALUE as well, ' +
      'which made a hand hero WANTS called bet LESS often against the one opponent most likely ' +
      'to call it. The value half of the same read is now its own rule below, exactly as WTSD ' +
      'has had both halves since WP-J.',
  },
  {
    id: 'FOLD_TO_CBET_LOW_VALUE_UP',
    stat: FOLD_TO_CBET_BY_STREET,
    streets: POSTFLOP,
    appliesWhen: 'HERO_MAY_AGGRESS',
    bands: VALUE_ONLY,
    direction: 'BELOW_PRIOR',
    target: 'AGGRESSION',
    effect: 'INCREASE',
    gainBps: 3000,
    maxBps: 800,
    provenance: 'HEURISTIC',
    reasonKey: 'OPPONENT_FOLDS_TOO_LITTLE',
    note:
      'The same reading as FOLD_TO_CBET_LOW, with the opposite conclusion because hero has a ' +
      'hand: an opponent who will not release to a bet is the opponent our value hands are ' +
      'most profitable against, so we bet them for value MORE often, not less. This is the ' +
      'exact shape WTSD_HIGH_BLUFF_DOWN / WTSD_HIGH_VALUE_UP already has, applied to the more ' +
      'direct of the two station reads. GAIN 3000 / MAX 800 sit one notch under the bluff ' +
      'half (4000 / 1000) for the reason WTSD_HIGH_VALUE_UP gives: against a station the ' +
      'interesting change is the SIZE, and the sizing table already carries this same read as ' +
      'SIZE_STATION_VALUE_UP_FOLD with a full rung. Note the §9 guard rail still zeroes this ' +
      'contribution when a known aggressor is behind, so the value half CAN be held at zero ' +
      'while the bluff half still de-escalates — that asymmetry is the guard, not this rule.',
  },
  {
    id: 'CHECK_RAISE_HIGH',
    stat: CHECK_RAISE_BY_STREET,
    streets: POSTFLOP,
    appliesWhen: 'HERO_MAY_BET',
    bands: THIN_AND_AIR,
    direction: 'ABOVE_PRIOR',
    target: 'AGGRESSION',
    effect: 'DECREASE',
    gainBps: 6000,
    maxBps: 1000,
    provenance: 'HEURISTIC',
    reasonKey: 'OPPONENT_CHECK_RAISES',
    note:
      'Betting into a habitual check-raiser turns a cheap decision into an expensive one: we ' +
      'invest, then face a raise with the worst of it and no initiative. GAIN 6000 is the ' +
      'steepest in the table BECAUSE the anchor is tiny (800 bps on the flop) — a player at 15% ' +
      'is only 7 points of raw deviation away from neutral, so a shallow gain would leave the ' +
      'most dangerous read in the file contributing almost nothing. WP-K follow-up §1 removed ' +
      'VALUE from the band list, which previously read all three. The sizing table had already ' +
      'stated the correct reasoning for the same stat — see SIZE_CHECK_RAISE_DOWN: "a VALUE ' +
      'hand facing a check-raiser wants the opposite treatment — being raised is the good ' +
      'outcome" — and the frequency pass contradicted it, betting a strong hand LESS often ' +
      'into the player most likely to put more money in. The two passes now agree. The rule ' +
      'still de-escalates MARGINAL, which is the hand class a check-raise genuinely blows off ' +
      'its equity, and the §9 guard rail is untouched and remains the engine\'s hard refusal ' +
      'to escalate into a known aggressor with cards behind.',
  },
  {
    id: 'WTSD_HIGH_BLUFF_DOWN',
    stat: { kind: 'FIXED', stat: 'WTSD' },
    streets: POSTFLOP,
    appliesWhen: 'HERO_MAY_BET',
    bands: THIN_AND_AIR,
    direction: 'ABOVE_PRIOR',
    target: 'AGGRESSION',
    effect: 'DECREASE',
    gainBps: 3000,
    maxBps: 800,
    provenance: 'HEURISTIC',
    reasonKey: 'OPPONENT_GOES_TO_SHOWDOWN',
    note:
      'A player who reaches showdown often is a player our bluffs do not get through. GAIN 3000 ' +
      'and MAX 800 are both a step below the fold-to-c-bet pair because WTSD is a WEAKER form ' +
      'of the same evidence: it is an outcome measured across a whole hand rather than a ' +
      'response to the specific bet hero is contemplating, so it deserves a smaller lever. ' +
      'Scoped to MARGINAL and WEAK: it is a statement about bluffing, and against a VALUE hand ' +
      'the same read points the other way (see WTSD_HIGH_VALUE_UP).',
  },
  {
    id: 'WTSD_LOW_BLUFF_UP',
    stat: { kind: 'FIXED', stat: 'WTSD' },
    streets: POSTFLOP,
    appliesWhen: 'HERO_MAY_BET',
    bands: THIN_AND_AIR,
    direction: 'BELOW_PRIOR',
    target: 'AGGRESSION',
    effect: 'INCREASE',
    gainBps: 3000,
    maxBps: 600,
    provenance: 'HEURISTIC',
    reasonKey: 'OPPONENT_AVOIDS_SHOWDOWN',
    note:
      'The opponent who rarely sees a showdown got there by folding somewhere, so a bluff has ' +
      'more equity than the anchor assumes. Same GAIN as its high twin but a SMALLER ceiling ' +
      '(600 against 800), and the asymmetry is intentional: this is the rule that spends money ' +
      'on a read rather than saving it, and an over-bluffing error costs chips immediately ' +
      'while an under-bluffing error only forgoes them. Where we are not sure, we are quieter ' +
      'in the direction that loses money.',
  },
  {
    id: 'WTSD_HIGH_VALUE_UP',
    stat: { kind: 'FIXED', stat: 'WTSD' },
    streets: POSTFLOP,
    appliesWhen: 'HERO_MAY_BET',
    bands: VALUE_ONLY,
    direction: 'ABOVE_PRIOR',
    target: 'AGGRESSION',
    effect: 'INCREASE',
    gainBps: 2500,
    maxBps: 600,
    provenance: 'HEURISTIC',
    reasonKey: 'OPPONENT_GOES_TO_SHOWDOWN',
    note:
      'The same reading as WTSD_HIGH_BLUFF_DOWN, with the opposite conclusion because hero has ' +
      'a hand: a player who will not fold is a player to bet FOR VALUE more often. The lowest ' +
      'gain of the three WTSD rules (2500) because the frequency lever is the wrong one for ' +
      'this read — against a station the interesting change is the SIZE, which is why the ' +
      'sizing table gives this same observation its own rule with a full rung of movement.',
  },
  {
    id: 'VILLAIN_CBET_HIGH',
    stat: CBET_BY_STREET,
    streets: POSTFLOP,
    appliesWhen: 'HERO_FACING_BET',
    bands: null,
    direction: 'ABOVE_PRIOR',
    target: 'CONTINUE',
    effect: 'INCREASE',
    gainBps: 3000,
    maxBps: 800,
    provenance: 'HEURISTIC',
    reasonKey: 'OPPONENT_BETS_WIDE',
    note:
      'A player who bets nearly every one of these spots is betting a range far wider than the ' +
      'one the baseline priced our call against, so the same holding continues more often. ' +
      'GAIN 3000 / MAX 800 rather than the fold-to-c-bet pair’s numbers because the ' +
      'inference is one step longer: bet frequency implies range width, which implies our ' +
      'equity, and each step is a place to be wrong. Mass goes to CONTINUE, never to ' +
      'AGGRESSION: "this opponent bets too much" is a reason to call more, not a licence to ' +
      'start raising — that would need a read about how they answer a raise, which is a ' +
      'different stat we do not consult here.',
  },
  {
    id: 'VILLAIN_CBET_LOW',
    stat: CBET_BY_STREET,
    streets: POSTFLOP,
    appliesWhen: 'HERO_FACING_BET',
    bands: null,
    direction: 'BELOW_PRIOR',
    target: 'FOLD',
    effect: 'INCREASE',
    gainBps: 3000,
    maxBps: 800,
    provenance: 'HEURISTIC',
    reasonKey: 'OPPONENT_BETS_NARROW',
    note:
      'A player who bets rarely is betting a strong, narrow range when they do, so the marginal ' +
      'part of our continuing range is now behind and should fold. Symmetric with its high twin ' +
      'in both numbers for the same anti-bias reason as the fold-to-c-bet pair. Note the target ' +
      'is FOLD rather than a negative CONTINUE: those differ whenever hero also has an ' +
      'aggressive row, and pushing mass explicitly to FOLD is the honest reading of "this bet ' +
      'is stronger than it looked".',
  },
  {
    id: 'THREE_BET_HIGH_TIGHTEN',
    stat: { kind: 'FIXED', stat: 'THREE_BET' },
    streets: PREFLOP_ONLY,
    appliesWhen: 'PREFLOP_HERO_OPENING',
    bands: null,
    direction: 'ABOVE_PRIOR',
    target: 'FOLD',
    effect: 'INCREASE',
    gainBps: 2500,
    maxBps: 800,
    provenance: 'HEURISTIC',
    reasonKey: 'OPPONENT_THREE_BETS_WIDE',
    note:
      'Opening into a frequent 3-bettor means our weakest opens get blown off the hand before ' +
      'they realise any equity, so the bottom of the opening range is worth folding instead. ' +
      'The LOWEST gain of any rule (2500) because the read is two steps removed from the ' +
      'decision: it is about what happens AFTER hero acts, and only for the fraction of the ' +
      'time this particular opponent is even dealt in behind. The 800 ceiling keeps it to at ' +
      'most a 8-point trim of the opening range.',
  },
  {
    id: 'FOLD_TO_3BET_HIGH',
    stat: { kind: 'FIXED', stat: 'FOLD_TO_THREE_BET' },
    streets: PREFLOP_ONLY,
    appliesWhen: 'PREFLOP_HERO_FACING_OPEN',
    bands: null,
    direction: 'ABOVE_PRIOR',
    target: 'AGGRESSION',
    effect: 'INCREASE',
    gainBps: 4000,
    maxBps: 1000,
    provenance: 'HEURISTIC',
    reasonKey: 'OPPONENT_FOLDS_TO_THREE_BET',
    note:
      'The preflop twin of FOLD_TO_CBET_HIGH, and it carries the same GAIN and ceiling for the ' +
      'same reason: the stat measures precisely the response to the action hero is considering. ' +
      'An opener who folds to 3-bets more than the anchor is paying us to 3-bet a wider range ' +
      'at them, and the ceiling of 1000 keeps that to 10 points of extra raising even against a ' +
      'player who folds almost everything.',
  },
  {
    id: 'FOLD_TO_3BET_LOW',
    stat: { kind: 'FIXED', stat: 'FOLD_TO_THREE_BET' },
    streets: PREFLOP_ONLY,
    appliesWhen: 'PREFLOP_HERO_FACING_OPEN',
    bands: null,
    direction: 'BELOW_PRIOR',
    target: 'AGGRESSION',
    effect: 'DECREASE',
    gainBps: 4000,
    maxBps: 800,
    provenance: 'HEURISTIC',
    reasonKey: 'OPPONENT_DEFENDS_THREE_BET',
    note:
      'An opener who defends against 3-bets takes away the fold equity our light 3-bets are ' +
      'built on, so we 3-bet less and call more. Same gain as the high side but an 800 rather ' +
      'than 1000 ceiling — unlike postflop, a preflop de-escalation here pushes mass into a ' +
      'CALL that plays a whole hand out of position, so the conservative move is not simply to ' +
      'de-escalate as hard as possible.',
  },
  {
    id: 'FOLD_BB_TO_STEAL_HIGH',
    stat: { kind: 'FIXED', stat: 'FOLD_BB_TO_STEAL' },
    streets: PREFLOP_ONLY,
    appliesWhen: 'PREFLOP_HERO_STEALING',
    bands: null,
    direction: 'ABOVE_PRIOR',
    target: 'AGGRESSION',
    effect: 'INCREASE',
    gainBps: 3000,
    maxBps: 800,
    provenance: 'HEURISTIC',
    reasonKey: 'OPPONENT_FOLDS_BLIND_TO_STEAL',
    note:
      'A big blind that over-folds to late-position opens makes the blinds themselves the prize, ' +
      'so hero opens wider from CO/BTN/SB. GAIN 3000 / MAX 800 rather than the fold-to-3-bet ' +
      'numbers because the stat is read from a POSITIONAL row and therefore accumulates far ' +
      'more slowly — fewer opportunities means a noisier estimate at the same nominal ' +
      'confidence, and the smaller lever is how we pay for that. The rule is gated to ' +
      'STEAL_POSITIONS so a big-blind fold rate is never applied to an under-the-gun open.',
  },
];

/* -------------------------------------------------------------------------- */
/* Gates and caps                                                              */
/* -------------------------------------------------------------------------- */

/**
 * HEURISTIC. The confidence a stat must reach before a FREQUENCY rule may fire at all.
 *
 * WHY A GATE EXISTS AT ALL when the shrinkage already scales every contribution by confidence.
 * Two reasons, and only the second is arithmetic. The first is HONESTY OF DISPLAY: a rule that
 * fires at 3% confidence produces a 1 bps nudge and a line of explanation in the UI that reads
 * exactly like a 60%-confidence read. A user cannot act on a reason list whose entries do not
 * mean anything, and "we adjusted, invisibly, because of one hand" is worse than "not enough
 * data yet". The second is that a floor at 25% removes the long tail of rules that would fire,
 * round to zero and get dropped anyway.
 *
 * WHY 2500. It is the confidence at which the estimate has moved a third of the way from the
 * anchor to the reading, which is the point where a deviation starts to be a description of the
 * player rather than of the sample. In opportunities that is `n >= K/3`: 14 for a flop-scoped
 * stat (K 40), 9 for a river-scoped one (K 25), 17 for VPIP (K 50). Those are the sample sizes
 * at which a live player would start to have an opinion, which is the standard we are matching.
 * Raising this number makes ADAPTIVE more conservative and can never make it move further; that
 * is the safe direction to move it.
 */
export const FREQUENCY_MIN_CONFIDENCE_BPS = 2500;

/**
 * HEURISTIC. The most the WHOLE rule set may move the mix, heads-up, measured as
 * `sum(|adapted - baseline|) / 2` in bps.
 *
 * THIS IS THE MOST IMPORTANT NUMBER IN THE PACKAGE. Every other bound is per-rule; this one is
 * the promise that ADAPTIVE is a correction to REFERENCE and not a replacement for it. At 2000
 * bps the strategy can move by at most 20 points of frequency in total — a `BET 55%` can become
 * a `BET 75%`, and it cannot become a pure bet. A user who switches to the ADAPTIVE tab is
 * always looking at a recognisable variation on the baseline they just read, which is what makes
 * the two tabs comparable and what makes a wrong opponent read a bounded mistake.
 *
 * WHY 2000 AND NOT MORE. Our opponent model is a handful of frequencies with no range, no
 * board texture and no history; it is simply not evidence for a larger move than that. Note
 * also that 2000 is four steps of the engine's own 500 bps display grid, so the cap is
 * expressible in the units the user actually sees rather than being rounded away.
 */
export const MAX_TOTAL_SHIFT_BPS_HEADS_UP = 2000;

/**
 * HEURISTIC. The same cap multiway (`activeOpponentCount >= 2`), at exactly half.
 *
 * Every rule is keyed to ONE villain (the PRIMARY, see `multiway.ts`), but the pot contains
 * others whose profiles are not driving anything. An exploit sized for a heads-up pot is
 * therefore being applied to a decision that is only partly about the player it was derived
 * from, and the more players there are the smaller that fraction is. Halving is a blunt
 * expression of that and is deliberately not a per-opponent formula: we have no basis for a
 * finer one, and inventing a curve would be inventing a poker claim (CLAUDE.md rule 7).
 */
export const MAX_TOTAL_SHIFT_BPS_MULTIWAY = 1000;

/**
 * HEURISTIC. The confidence a BEHIND opponent's aggression stat must reach before the §9 guard
 * rail refuses every positive aggression contribution.
 *
 * Held EQUAL to `FREQUENCY_MIN_CONFIDENCE_BPS` on purpose: the guard must trip at exactly the
 * confidence at which we would have been willing to act on the same stat ourselves. A higher
 * gate would let ADAPTIVE increase a bluff on evidence it simultaneously considers good enough
 * to reason from; a lower one would let a single observed check-raise silence the whole
 * aggressive half of the table.
 */
export const BEHIND_AGGRESSION_GATE_BPS = 2500;

/**
 * Total. The applicable global shift cap for a spot.
 *
 * `activeOpponentCount <= 1` is heads-up. Zero opponents (everyone folded to hero) also lands
 * here; the rule table needs a PRIMARY villain to fire at all, so the cap is unreachable there
 * and the branch is only ever exercised at exactly one opponent.
 */
export const maxTotalShiftBpsFor = (activeOpponentCount: number): number =>
  activeOpponentCount <= 1 ? MAX_TOTAL_SHIFT_BPS_HEADS_UP : MAX_TOTAL_SHIFT_BPS_MULTIWAY;
