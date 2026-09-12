/**
 * THE WHOLE PRIOR MODEL, AS DATA — the `postflop/scoreModel.ts` convention applied to the
 * ADAPTIVE layer. Every number the shrinkage arithmetic uses lives in this file and is
 * exported; `profile.ts` contains control flow and integer arithmetic and no model number.
 *
 * ---------------------------------------------------------------------------------------
 * A PRIOR HERE IS THE ZERO-ADJUSTMENT ANCHOR. IT IS NOT A CLAIM ABOUT A POPULATION.
 *
 * `ADAPTIVE_PRIORS[key]` is the value at which a stat produces NO ADJUSTMENT AT ALL. Every
 * rule in the policy layer fires on `estimate - prior`, so at `estimate === prior` every
 * contribution is exactly 0 and ADAPTIVE is byte-identical to REFERENCE. When confidence is
 * 0 the shrinkage formula returns `estimate === prior` by construction, which is what makes
 * "no data means no adjustment" structural rather than a special case someone remembered to
 * write.
 *
 * That is the entire job of these numbers. A prior never has to be TRUE — it has to be
 * NEUTRAL, and a reader can check the neutrality property without agreeing with any single
 * value. It follows that being "wrong" about a population costs nothing: it only shifts
 * where the no-adjustment point sits, and the deviation a rule reads is measured from that
 * point in both directions symmetrically.
 *
 * THESE ARE NOT GTO NUMBERS AND ARE NEVER LABELLED AS SUCH (CLAUDE.md rule 2). They are not
 * solver output, not scraped from any solution dataset, and not a measured population
 * average from any hand-history corpus we possess. Every entry is tagged `HEURISTIC`
 * (ADR-0056) with a mandatory note, and the type makes an unexplained one impossible to
 * write. The UI must never render one as a "GTO frequency"; it is an anchor.
 * ---------------------------------------------------------------------------------------
 */
import { heuristic, type Provenanced } from '@gto-self/strategy-core';
import { ADAPTIVE_STAT_KEYS, type AdaptiveStatKey } from './stats.js';

/**
 * The neutral anchor for each stat, in integer basis points (10000 = 100%).
 *
 * Read each note as "why is THIS the point at which we do nothing", not as "this is what
 * players do". Where a note cites a familiar 6-max figure it is naming the shape of a
 * player the reader can picture standing at the no-adjustment point — it is an orientation
 * device for review, not a source citation, and no public dataset is being represented.
 */
export const ADAPTIVE_PRIORS: Readonly<Record<AdaptiveStatKey, Provenanced<number>>> = {
  VPIP: heuristic(
    2400,
    'Zero-adjustment anchor for preflop entry. 24% sits between the ranges a nit and a ' +
      'loose-passive 6-max regular enter with, so a reading either side of it is a signed ' +
      'deviation with a clear meaning rather than a one-directional correction.',
  ),
  PFR: heuristic(
    1900,
    'Zero-adjustment anchor for preflop raising. Held a few points under the VPIP anchor ' +
      'so that the neutral player is raising most of what they enter with; an anchor at or ' +
      'above VPIP would describe an impossible player and skew every deviation one way.',
  ),
  THREE_BET: heuristic(
    700,
    'Zero-adjustment anchor for 3-betting. A small anchor for a rare action: the deviations ' +
      'that matter here are a player at 2% versus one at 14%, and 7% is the midpoint of ' +
      'that span so neither extreme is measured from a corner.',
  ),
  FOLD_TO_THREE_BET: heuristic(
    5500,
    'Zero-adjustment anchor for folding to a 3-bet. Slightly above the middle of the range ' +
      'because a player who continues to a 3-bet more often than they fold is the rarer and ' +
      'more exploitable case, and it should read as a clear negative deviation.',
  ),
  STEAL: heuristic(
    3000,
    'Zero-adjustment anchor for a late-position raise-first-in (CO/BTN/SB). Wider than the ' +
      'VPIP anchor, because opening from late position is a wider action than entering a ' +
      'pot from anywhere; anchoring it at VPIP would make every late-position regular read ' +
      'as a maniac.',
  ),
  FOLD_BB_TO_STEAL: heuristic(
    6500,
    'Zero-adjustment anchor for folding the big blind to a steal. Set above the middle ' +
      'because folding is the majority response even for a defensive player, and an anchor ' +
      'at 50% would make almost every opponent read as a nit.',
  ),
  CBET_FLOP: heuristic(
    5500,
    'Zero-adjustment anchor for betting the flop as the previous street aggressor. The ' +
      'highest of the three c-bet anchors: the flop is the street on which a player with ' +
      'initiative bets most often, so the anchor descends by street.',
  ),
  CBET_TURN: heuristic(
    4500,
    'Zero-adjustment anchor for the turn barrel. Ten points under the flop anchor, ' +
      'reflecting only that fewer hands keep barrelling — it is the SHAPE of the descent ' +
      'that is being asserted, not the exact value.',
  ),
  CBET_RIVER: heuristic(
    4000,
    'Zero-adjustment anchor for the river barrel. The lowest of the three, continuing the ' +
      'same descent. A flat anchor across streets would make a normal river give-up read as ' +
      'a large negative deviation on every hand.',
  ),
  FOLD_TO_CBET_FLOP: heuristic(
    4500,
    'Zero-adjustment anchor for folding to a flop c-bet. Deliberately just under half: the ' +
      'two reads this stat exists to separate — the station and the fold-happy player — sit ' +
      'symmetrically either side, so neither is measured from a corner of the range.',
  ),
  FOLD_TO_CBET_TURN: heuristic(
    4500,
    'Zero-adjustment anchor for folding to a turn barrel. Held equal to the flop anchor on ' +
      'purpose: we have no basis for asserting a street-by-street shape for the DEFENDER, ' +
      'and inventing one would be inventing a poker claim (CLAUDE.md rule 2).',
  ),
  FOLD_TO_CBET_RIVER: heuristic(
    4500,
    'Zero-adjustment anchor for folding to a river barrel. Equal to the other two for the ' +
      'same reason: no asserted street shape on the defending side.',
  ),
  CHECK_RAISE_FLOP: heuristic(
    800,
    'Zero-adjustment anchor for check-raising the flop. A small anchor for a rare action. ' +
      'The read this feeds is "this opponent check-raises noticeably more than nothing", ' +
      'and the highest of the three because the flop is where a check-raise costs least.',
  ),
  CHECK_RAISE_TURN: heuristic(
    600,
    'Zero-adjustment anchor for the turn check-raise. Below the flop anchor, following the ' +
      'same descent as the c-bet anchors and for the same structural reason.',
  ),
  CHECK_RAISE_RIVER: heuristic(
    400,
    'Zero-adjustment anchor for the river check-raise. The rarest of the three; the lowest ' +
      'anchor keeps a single observed river check-raise from reading as an enormous ' +
      'deviation once its (deliberately small) sample earns any confidence.',
  ),
  WTSD: heuristic(
    2700,
    'Zero-adjustment anchor for went-to-showdown. Placed so that the calling station and ' +
      'the player who gives up on every turn sit on opposite signs; this stat drives both a ' +
      'bluff-down and a value-up rule, so a lopsided anchor would bias one of them.',
  ),
  WSD: heuristic(
    5000,
    'Zero-adjustment anchor for won-at-showdown. Exactly the midpoint, because unlike every ' +
      'other stat here we have no directional opinion at all about this one: it is carried ' +
      'for display and for future rules, and the midpoint guarantees it contributes nothing ' +
      'until a rule deliberately reads it.',
  ),
  // Generic, street-blind readings (WP-K) — a source that reports one Cont-Bet /
  // Fold-to-C-Bet / Check-Raise number with no street breakdown (an external HUD).
  // Each anchor is honestly borrowed from that stat's FLOP anchor above, since flop is the
  // street the underlying action happens on most often and is the single best one-number
  // stand-in we have evidence for — never a new, independently-derived figure.
  CBET_ANY_STREET: heuristic(
    5500,
    'Zero-adjustment anchor for a street-blind continuation-bet reading (WP-K). Equal to ' +
      'the flop c-bet anchor: a source with no street breakdown is dominated by flop ' +
      'continuation bets, so the flop anchor is the honest one-number stand-in rather than ' +
      'an average across three anchors that would assert a street mix nobody measured.',
  ),
  FOLD_TO_CBET_ANY_STREET: heuristic(
    4500,
    'Zero-adjustment anchor for a street-blind fold-to-c-bet reading (WP-K). Equal to the ' +
      'flop anchor, for the same reason as `CBET_ANY_STREET`.',
  ),
  CHECK_RAISE_ANY_STREET: heuristic(
    800,
    'Zero-adjustment anchor for a street-blind check-raise reading (WP-K). Equal to the ' +
      'flop anchor: check-raises are rarer on later streets, so a flop-dominated one-number ' +
      'reading sits closer to the flop anchor than to an average of all three.',
  ),
};

/**
 * The `K` of `confidenceWeightBps(n, K)` per stat: the number of observations at which the
 * reading is trusted exactly half as much as the anchor.
 *
 * HEURISTIC, and the note is the shape rather than the value. `player-core`'s
 * `DEFAULT_SNAPSHOT_CONFIDENCE_CONFIG.k` is 30 for a generic model stat; ADAPTIVE varies it
 * per stat for one reason only: THE RARER THE OPPORTUNITY, THE LOWER THE K MUST BE, or a
 * street-scoped stat could never earn any confidence inside a session. A river spot arises
 * a fraction as often as a preflop one, so demanding 50 river opportunities before half
 * weight would mean the river stats never fire at all, which is not caution — it is a
 * silently dead code path.
 *
 * The three tiers, and why each stat sits in one:
 *
 * - `50` — every-hand stats (`VPIP`, `PFR`) and `WTSD`, whose denominator is "hands played".
 *          Cheap to accumulate, so we demand the most before halving the anchor's weight.
 * - `40` — once-per-hand-when-it-arises stats: the preflop 3-bet family, the steal family,
 *          `WSD`, and every FLOP-scoped stat.
 * - `30` / `25` — turn and river scoped stats, stepping down as the opportunity gets rarer.
 *
 * Raising a K makes ADAPTIVE more conservative for that stat and can never make it move
 * further; that is the safe direction, and it is the direction to move if a K is disputed.
 */
export const ADAPTIVE_STAT_K: Readonly<Record<AdaptiveStatKey, number>> = {
  VPIP: 50,
  PFR: 50,
  THREE_BET: 40,
  FOLD_TO_THREE_BET: 40,
  STEAL: 40,
  FOLD_BB_TO_STEAL: 40,
  CBET_FLOP: 40,
  CBET_TURN: 30,
  CBET_RIVER: 25,
  FOLD_TO_CBET_FLOP: 40,
  FOLD_TO_CBET_TURN: 30,
  FOLD_TO_CBET_RIVER: 25,
  CHECK_RAISE_FLOP: 40,
  CHECK_RAISE_TURN: 30,
  CHECK_RAISE_RIVER: 25,
  WTSD: 50,
  WSD: 40,
  // Generic, street-blind readings (WP-K). `K` matters only when `MANUAL_HUD` or
  // `LEARNED_MODEL` someday supply one of these (neither does today — see
  // `EXTERNAL_HUD_CONFIDENCE_BPS` below for how an `EXTERNAL_HUD` reading is weighted
  // instead). Set to the flop tier, for the same "flop-dominated" reasoning as their priors.
  CBET_ANY_STREET: 40,
  FOLD_TO_CBET_ANY_STREET: 40,
  CHECK_RAISE_ANY_STREET: 40,
};

/**
 * The fixed confidence an `EXTERNAL_HUD` reading is given, whenever one exists for a stat
 * (ADR-0067). NOT the `n/(n+K)` formula `MANUAL_HUD`/`LEARNED_MODEL` share — an external
 * profile's `sampleN` is always `null` (`@gto-self/player-core`'s `externalHud.ts`), and
 * inventing an `n` to feed that formula would be exactly the "sample size we don't have"
 * problem `CLAUDE.md` rule 2 forbids.
 *
 * This is a POLICY CHOICE, not a statistical estimate: an established LIFETIME read is
 * trusted close to fully, but short of certain, because the true `n` is unknown and player
 * behavior can drift since the lifetime figure was captured. 9000 (90%) sits above every
 * gate this package has (`FREQUENCY_MIN_CONFIDENCE_BPS`, both `SIZING_MIN_CONFIDENCE_BPS_*`
 * — see `policy/frequencyModel.ts` / `sizingModel.ts`) so an external reading can drive
 * both frequency AND sizing rules on its own, unlike a lone manual HUD entry
 * (`MANUAL_HUD_MAX_CONFIDENCE_BPS`, `inputs.ts`, capped below the sizing gates on purpose).
 * `docs/reports/EXTERNAL_ADAPTIVE_00_AUDIT.md` §3 records the alternative considered (a
 * synthetic large `n` through the shared formula) and why it was rejected.
 */
export const EXTERNAL_HUD_CONFIDENCE_BPS = 9000;

/**
 * The `SnapshotConfidenceConfig` thresholds ADAPTIVE displays a stat's state with.
 *
 * `k` is supplied PER STAT from `ADAPTIVE_STAT_K` at the call site, so only the two display
 * thresholds are fixed here. They are `player-core`'s ADR-0062e defaults verbatim
 * (`UNKNOWN < 5 <= LEARNING < 30 <= KNOWN`), reused rather than re-picked so that one
 * opponent's stat cannot be `LEARNING` in the player screen and `KNOWN` in the strategy
 * panel over the same sample.
 */
export const ADAPTIVE_LEARNING_THRESHOLD = 5;
export const ADAPTIVE_KNOWN_THRESHOLD = 30;

/**
 * Total. The anchor value for a stat, unwrapped from its provenance.
 *
 * The `Provenanced` wrapper is what the UI and the report renderer read; the arithmetic
 * wants the number. `ADAPTIVE_STAT_KEYS` is exhaustive over the record's key type, so the
 * lookup cannot miss — but `noUncheckedIndexedAccess` does not know that about a
 * `Record<Union, T>` accessed through a variable of the union type, hence no `!`: the
 * record IS typed by the union, so this indexing is checked and total.
 */
export const priorBpsFor = (key: AdaptiveStatKey): number => ADAPTIVE_PRIORS[key].value;

/** Total. The `K` for a stat. Same totality argument as `priorBpsFor`. */
export const kFor = (key: AdaptiveStatKey): number => ADAPTIVE_STAT_K[key];

/**
 * Every prior and every `K` is present and in range. Exported so the barrel's consumers and
 * the tests share one definition of "the model is well-formed" rather than each asserting
 * their own idea of it.
 */
export const ADAPTIVE_MODEL_KEY_COUNT = ADAPTIVE_STAT_KEYS.length;
