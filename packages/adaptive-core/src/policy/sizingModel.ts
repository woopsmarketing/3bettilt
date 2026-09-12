/**
 * THE WHOLE SIZING POLICY, AS DATA. Same convention as `frequencyModel.ts`: every number the
 * sizing pass uses is here and exported, and `sizing.ts` holds only control flow.
 *
 * ---------------------------------------------------------------------------------------
 * SIZING IS A SEPARATE PASS WITH A STRICTLY HIGHER GATE, AND POSTFLOP ONLY
 *
 * WHY SEPARATE. Frequency and size answer different questions ("how often do I bet" vs "how
 * much"), they move on different scales (a continuous 10000-bps mix vs eight discrete rungs),
 * and mixing them would mean a single deviation could move both at once with no way to say how
 * much of the change was which. Keeping the passes apart is also what lets the sizing gate be
 * higher without making the frequency gate higher.
 *
 * WHY HIGHER. A frequency shift is a change of emphasis inside a mix the user can see; a size
 * change is a different bet, and it is the more legible of the two to an opponent. One rung on
 * the ladder is a 25-to-50-point move in pot fraction — much larger, in the thing hero actually
 * risks, than 5 points of frequency. So it costs more evidence.
 *
 * WHY POSTFLOP ONLY (an MVP limitation, recorded as such). Preflop sizing in the REFERENCE
 * engine is a raise-TO rule in big blinds, not a pot fraction: there is no rung ladder to move
 * along, and inventing one here would be authoring a second preflop sizing model inside the
 * composition layer. Preflop sizes are therefore echoed unchanged.
 *
 * A MOVED SIZE IS STILL ONE OF THE ENGINE'S OWN EIGHT BUCKETS. The pass moves an INDEX into
 * `POT_FRACTION_BUCKETS` and then resolves it through `strategy-core`'s own
 * `potFractionToAmount` and `clampPostflopSizing`. ADAPTIVE cannot produce a size the REFERENCE
 * engine could not have produced, and it cannot produce an illegal one.
 * ---------------------------------------------------------------------------------------
 */
import type { AdaptiveStreet, AdaptiveStrengthCategory } from '../baseline.js';
import type { AdaptiveStatKey } from '../stats.js';
import type { AdaptiveReasonKey } from './reasons.js';
import type {
  AdaptiveRuleDirection,
  AdaptiveRuleScope,
  AdaptiveStatSelector,
} from './frequencyModel.js';

/**
 * The sizing rules: the four of the WP-J design contract §5.1. A closed union.
 *
 * WP-K §7 briefly added a fifth, `SIZE_WINNER_VALUE_UP`, which sized a value bet UP a rung
 * whenever `WSD` sat above its anchor. WP-K follow-up §2 REMOVED it, because the poker claim
 * behind it does not hold: a high `WSD` says an opponent WINS the showdowns they reach, which
 * is a statement about the strength of their showdown range — not, as that rule assumed, that
 * they call more. If anything it points the other way, and it directly contradicted `WSD`'s
 * own anchor note in `priors.ts` ("we have no directional opinion at all about this one"). The
 * stat is not discarded: it is now a SECONDARY signal, `suppressedWhen` below.
 */
export type AdaptiveSizingRuleId =
  | 'SIZE_STATION_VALUE_UP'
  | 'SIZE_STATION_VALUE_UP_FOLD'
  | 'SIZE_FOLDY_BLUFF_DOWN'
  | 'SIZE_CHECK_RAISE_DOWN';

/**
 * A SECONDARY signal: a second stat that can hold a rule back, but can never make one fire.
 *
 * WP-K follow-up §2. The primary sizing signals are the ones measured against the action hero
 * is taking — `WTSD` (does this opponent get to the end?) and `FOLD_TO_CBET` (does this
 * opponent release to a bet?). `WSD` is not one of them: it is measured only among the hands
 * that ALREADY reached a showdown, so on its own it says nothing about whether hero's bet gets
 * called. What it can do is DISAMBIGUATE a primary signal that has two readings, which is
 * exactly the job `SIZE_STATION_VALUE_UP` needs done.
 *
 * The shape is deliberately one-directional: a suppressor can only ever REMOVE a rung, never
 * add one and never flip a sign. That keeps the whole secondary mechanism inside the same
 * safety property every other bound in this file has — it can only make ADAPTIVE move less.
 */
export interface AdaptiveSizingSuppressor {
  readonly stat: AdaptiveStatKey;
  /** The side of the anchor on which the secondary stat withdraws support for the rule. */
  readonly direction: AdaptiveRuleDirection;
  /** MANDATORY. Why this second stat is allowed to hold the rule back. */
  readonly note: string;
}

/**
 * One sizing rule. It contributes RUNGS, not basis points — there is no `gainBps` and no
 * `maxBps`, because the ladder is discrete and the only sizes available are one step either
 * way. A rule either applies or it does not.
 */
export interface AdaptiveSizingRule {
  readonly id: AdaptiveSizingRuleId;
  readonly stat: AdaptiveStatSelector;
  readonly streets: readonly AdaptiveStreet[];
  /**
   * Present on sizing rules although the WP-J design contract §5.1 table has no such column.
   * `SIZE_CHECK_RAISE_DOWN` reads how often villain CHECK-raises, which is only a fact about
   * the decision in front of hero when hero is the one betting; applying it to a raise size
   * would be reading a stat outside the spot it describes. Reported as a deviation, and it can
   * only ever make the pass fire less often.
   */
  readonly appliesWhen: AdaptiveRuleScope;
  /** The hand-strength categories the rule is scoped to. Sizing rules are always band-scoped. */
  readonly bands: readonly AdaptiveStrengthCategory[];
  readonly direction: AdaptiveRuleDirection;
  /** Signed rung offset on `POT_FRACTION_BUCKETS`. Always exactly +1 or -1. */
  readonly steps: number;
  readonly provenance: 'HEURISTIC';
  readonly reasonKey: AdaptiveReasonKey;
  /** MANDATORY. The poker reasoning, as our own product judgement. Never a GTO claim. */
  readonly note: string;
  /**
   * Optional. A SECONDARY stat whose reading withdraws support for this rule. Absent on a
   * rule whose primary signal needs no disambiguation — which is three of the four.
   */
  readonly suppressedWhen?: AdaptiveSizingSuppressor;
}

const POSTFLOP: readonly AdaptiveStreet[] = ['FLOP', 'TURN', 'RIVER'];

const FOLD_TO_CBET_BY_STREET: AdaptiveStatSelector = {
  kind: 'BY_STREET',
  byStreet: {
    FLOP: 'FOLD_TO_CBET_FLOP',
    TURN: 'FOLD_TO_CBET_TURN',
    RIVER: 'FOLD_TO_CBET_RIVER',
  },
};

const CHECK_RAISE_BY_STREET: AdaptiveStatSelector = {
  kind: 'BY_STREET',
  byStreet: {
    FLOP: 'CHECK_RAISE_FLOP',
    TURN: 'CHECK_RAISE_TURN',
    RIVER: 'CHECK_RAISE_RIVER',
  },
};

const VALUE_ONLY: readonly AdaptiveStrengthCategory[] = ['VALUE'];
const WEAK_ONLY: readonly AdaptiveStrengthCategory[] = ['WEAK'];
const THIN_AND_AIR: readonly AdaptiveStrengthCategory[] = ['MARGINAL', 'WEAK'];

/**
 * The rules, in the order their steps are summed and their adjustments emitted.
 *
 * Read them as two pairs. The first two say "this opponent calls too much, so charge them more
 * when you have it". The second two say "this opponent either folds or raises, so risk less
 * when you do not". Nothing in the table sizes UP without a VALUE band, which is the property
 * that keeps the pass from turning a bluff into a bigger bluff against a station.
 *
 * `WSD` appears nowhere as a rule of its own (WP-K follow-up §2, see `AdaptiveSizingRuleId`).
 * It appears once, as `SIZE_STATION_VALUE_UP`'s `suppressedWhen`.
 */
export const ADAPTIVE_SIZING_RULES: readonly AdaptiveSizingRule[] = [
  {
    id: 'SIZE_STATION_VALUE_UP',
    stat: { kind: 'FIXED', stat: 'WTSD' },
    streets: POSTFLOP,
    appliesWhen: 'HERO_MAY_AGGRESS',
    bands: VALUE_ONLY,
    direction: 'ABOVE_PRIOR',
    steps: 1,
    provenance: 'HEURISTIC',
    reasonKey: 'OPPONENT_GOES_TO_SHOWDOWN',
    note:
      'A player who reaches showdown more often than the anchor is a player who pays off, and ' +
      'the whole value of that read is collected through the SIZE rather than the frequency: ' +
      'betting 75% instead of 67% into someone who was going to call either way is free money, ' +
      'while betting more OFTEN against them is not. One rung and not two because the ladder ' +
      'steps are large (25 to 50 points of pot) and because a size far outside the range the ' +
      'engine chose starts to be information the opponent can use.',
    suppressedWhen: {
      stat: 'WSD',
      direction: 'ABOVE_PRIOR',
      note:
        'A high WTSD has TWO readings and this rule assumes only one of them. The station ' +
        'reaches showdown often because they call too wide with hands that cannot win; the ' +
        'strong player reaches showdown often because they get there with hands that do. WSD ' +
        'is the stat that separates them — it says what actually happens once the showdown ' +
        'arrives — so an opponent who is BOTH above the WTSD anchor and above the WSD anchor ' +
        'is not evidently the player this rule was written about, and charging them an extra ' +
        'rung is charging a range that tends to be ahead. Note what this does NOT do: it never ' +
        'sizes DOWN, and it never touches SIZE_STATION_VALUE_UP_FOLD, whose signal ' +
        '(fold-to-c-bet) is measured directly against hero\'s bet and needs no disambiguating.',
    },
  },
  {
    id: 'SIZE_STATION_VALUE_UP_FOLD',
    stat: FOLD_TO_CBET_BY_STREET,
    streets: POSTFLOP,
    appliesWhen: 'HERO_MAY_AGGRESS',
    bands: VALUE_ONLY,
    direction: 'BELOW_PRIOR',
    steps: 1,
    provenance: 'HEURISTIC',
    reasonKey: 'OPPONENT_FOLDS_TOO_LITTLE',
    note:
      'The same conclusion from the more direct measurement: not folding to a bet IS the ' +
      'station read, observed against the exact action hero is taking rather than inferred from ' +
      'how hands ended. It is a separate rule from the WTSD one so that either stat can carry ' +
      'the read on its own, and so that an opponent for whom both are true does not silently ' +
      'get a two-rung move — MAX_SIZING_BUCKET_DELTA collapses the pair back to one rung and ' +
      'records the clip.',
  },
  {
    id: 'SIZE_FOLDY_BLUFF_DOWN',
    stat: FOLD_TO_CBET_BY_STREET,
    streets: POSTFLOP,
    appliesWhen: 'HERO_MAY_AGGRESS',
    bands: WEAK_ONLY,
    direction: 'ABOVE_PRIOR',
    steps: -1,
    provenance: 'HEURISTIC',
    reasonKey: 'OPPONENT_FOLDS_TOO_MUCH',
    note:
      'Against a player who folds too much, a bluff only has to be big enough to fold them out ' +
      'once — every extra chip is risked for nothing. Scoped to WEAK alone, never MARGINAL: a ' +
      'thin value hand betting small is already the base rung the engine itself picks for that band, and ' +
      'stacking a second reduction onto it would size a made hand off the bottom of the ladder. ' +
      'Note this pairs with FOLD_TO_CBET_HIGH raising the bluff FREQUENCY: bluff more often, ' +
      'for less, is the whole exploit and it needs both passes to express.',
  },
  {
    id: 'SIZE_CHECK_RAISE_DOWN',
    stat: CHECK_RAISE_BY_STREET,
    streets: POSTFLOP,
    appliesWhen: 'HERO_MAY_BET',
    bands: THIN_AND_AIR,
    direction: 'ABOVE_PRIOR',
    steps: -1,
    provenance: 'HEURISTIC',
    reasonKey: 'OPPONENT_CHECK_RAISES',
    note:
      'When the bet we make can be raised off us, the bet is a price we pay to see what happens; ' +
      'a habitual check-raiser makes that price worth paying less often and worth paying less. ' +
      'Scoped to MARGINAL and WEAK because a VALUE hand facing a check-raiser wants the opposite ' +
      'treatment — being raised is the good outcome — and this rule must never quietly shrink a ' +
      'value bet into an induce.',
  },
];

/* -------------------------------------------------------------------------- */
/* Gates and caps                                                              */
/* -------------------------------------------------------------------------- */

/**
 * HEURISTIC. The confidence a stat must reach before a SIZING rule may fire, heads-up.
 *
 * WHY 5000 — exactly double `FREQUENCY_MIN_CONFIDENCE_BPS`, and chosen for what that number
 * means rather than for the ratio. 5000 bps is the point at which the shrinkage formula gives
 * the READING and the ANCHOR equal weight: by construction (`confidenceWeightBps(n, K)`), it is
 * reached at `n = K`. So the rule is "we will change the size once we have seen this opponent
 * in this situation as many times as the stat's own half-weight point demands, and not before"
 * — 40 flop-scoped opportunities, 25 river-scoped ones. Below that the estimate is still mostly
 * our own anchor talking, and moving a rung on the strength of an anchor would be adapting to
 * nobody.
 */
export const SIZING_MIN_CONFIDENCE_BPS_HEADS_UP = 5000;

/**
 * HEURISTIC. The same gate multiway (`activeOpponentCount >= 2`).
 *
 * WHY 7500. It is the confidence at which the reading outweighs the anchor three to one,
 * reached at `n = 3K`. Multiway, the size hero picks is being paid by several players and only
 * one of them is the villain the rule read; a rung that is right against the primary can be
 * badly wrong against the rest of the field. Demanding three times the sample of the heads-up
 * gate is the blunt expression of "this evidence now has to carry more than it did".
 */
export const SIZING_MIN_CONFIDENCE_BPS_MULTIWAY = 7500;

/**
 * HEURISTIC. The largest NET rung movement, in either direction, after every rule has voted.
 *
 * One rung, never two, even when three rules agree. The ladder's steps are large and the
 * engine's chosen rung already encodes texture, SPR, multiway and street; a two-rung move would
 * be a bigger correction than the entire authored sizing model applies for any single board
 * feature (`SIZING_MODIFIERS` are all +/-1 as well). Clipping the sum is also what keeps a
 * station who is extreme on BOTH station stats from getting double credit for one read.
 */
export const MAX_SIZING_BUCKET_DELTA = 1;

/**
 * Total. The applicable sizing gate for a spot. `activeOpponentCount <= 1` is heads-up.
 */
export const sizingMinConfidenceBpsFor = (activeOpponentCount: number): number =>
  activeOpponentCount <= 1
    ? SIZING_MIN_CONFIDENCE_BPS_HEADS_UP
    : SIZING_MIN_CONFIDENCE_BPS_MULTIWAY;
