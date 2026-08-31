/**
 * Canonical POSTFLOP spot classification.
 *
 * Input is the neutral `StrategyQuery`; output is a total, deterministic description of the
 * LINE that led to hero's decision. It contains no strategy: it says what the spot IS, never
 * what to do in it — the same contract `preflop/spot.ts` holds.
 *
 * The family, first match wins:
 *
 *   0. not FLOP/TURN/RIVER, or no live opponent, or hero has no legal action -> UNSUPPORTED
 *   1. the last aggression this street is an ALL_IN and hero owes chips      -> FACING_ALL_IN
 *      (the family says hero faces a shove; `allInCollapsedTree` says whether anything is
 *       left to raise into, which multiway is a different question)
 *   2. two or more aggressions this street, hero owes chips                  -> FACING_RAISE
 *   3. one aggression this street, hero owes chips                           -> FACING_BET
 *   4. no live bet, hero had the previous street's initiative
 *        hero has already acted on this street                              -> DELAYED_CBET
 *        otherwise                                                          -> CBET
 *   5. no live bet, hero did not                                             -> PROBE
 *
 * `CBET` deliberately covers "hero raised preflop and the flop is checked to hero" AND "hero
 * bet the flop, the turn was checked to hero"; both are the same structural fact, which is
 * that hero owns the previous street's aggression and the pot is unbet.
 */
import { Money, type MilliBB } from '@gto-self/shared';
import type { PostflopPotType } from './scoreModel.js';
import type {
  StrategyActionRecord,
  StrategyPosition,
  StrategyQuery,
  StrategyStreet,
} from '../types.js';

export type PostflopSpotFamily =
  'CBET' | 'DELAYED_CBET' | 'PROBE' | 'FACING_BET' | 'FACING_RAISE' | 'FACING_ALL_IN';

export type PostflopUnsupportedReason =
  'NOT_POSTFLOP' | 'NO_ACTIVE_OPPONENT' | 'NO_LEGAL_ACTION' | 'BOARD_CARD_COUNT';

// 'IP' | 'OOP' — one declaration for both streets, from the preflop spot module.
import type { HeroRelativePosition } from '../preflop/spot.js';
export type { HeroRelativePosition };

export interface PostflopSpot {
  readonly kind: 'SPOT';
  readonly family: PostflopSpotFamily;
  readonly street: 'FLOP' | 'TURN' | 'RIVER';
  readonly heroPosition: StrategyPosition;
  readonly potType: PostflopPotType;
  /** Players dealt into the hand, 2..6. */
  readonly lineupSize: number;
  /** Live opponents other than hero. */
  readonly activeOpponentCount: number;
  readonly heroRelativePosition: HeroRelativePosition;
  /** Aggressive actions on THIS street. */
  readonly streetAggressionCount: number;
  /** Voluntary actions on this street before hero's decision. */
  readonly streetActionCount: number;
  /** Opponents who checked to hero on this street with no bet outstanding. */
  readonly checksBeforeHero: number;
  readonly heroHasActedThisStreet: boolean;
  /** The last aggressor on the street before this one, or null. */
  readonly previousStreetAggressor: StrategyPosition | null;
  readonly currentStreetAggressor: StrategyPosition | null;
  readonly heroHadInitiative: boolean;
  readonly heroIsCurrentStreetAggressor: boolean;
  readonly facingBet: boolean;
  readonly facingAllIn: boolean;
  /**
   * `facingAllIn` AND the tree has genuinely collapsed to a call-or-fold decision: hero has no
   * aggressive option, or no live opponent besides the shover remains. Heads-up against a shove
   * this is always true — there is nothing left to raise into. Multiway it is often FALSE: a
   * short stack shoves, a deep opponent is still to act, and isolating with a strong hand is an
   * ordinary line the policy must be able to express. Classification only; no strategy.
   */
  readonly allInCollapsedTree: boolean;
  /**
   * The last aggressive wager on this street as a fraction of the pot immediately BEFORE that
   * wager: `lastAggression.amountMbb / lastAggression.potBeforeMbb`, both read off the
   * aggressor's own action record. It is the SIZE VILLAIN CHOSE, which is what the model wants
   * to score — not hero's price, which differs from it whenever hero already has chips in on
   * the street or a player has called between the aggressor and hero. Null when hero is not
   * facing a bet, or the pot before the wager is not positive. A ratio, never money
   * (CLAUDE.md rule 1).
   */
  readonly facedBetFractionOfPot: number | null;
}

export interface UnsupportedPostflopSpot {
  readonly kind: 'UNSUPPORTED';
  readonly reason: PostflopUnsupportedReason;
  readonly detail: string;
  readonly heroPosition: StrategyPosition;
}

export type PostflopSpotClassification = PostflopSpot | UnsupportedPostflopSpot;

const STREET_ORDER: readonly StrategyStreet[] = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];

/** Total. The street before `street`, or null for PREFLOP. */
export function previousStreetOf(street: StrategyStreet): StrategyStreet | null {
  const index = STREET_ORDER.indexOf(street);
  return index <= 0 ? null : (STREET_ORDER[index - 1] ?? null);
}

/**
 * Total. The pot type, from the number of PREFLOP aggressions.
 * 0 -> LIMPED, 1 -> SINGLE_RAISED, 2 -> THREE_BET, 3 or more -> FOUR_BET_PLUS.
 */
export function potTypeOf(actions: readonly StrategyActionRecord[]): PostflopPotType {
  let raises = 0;
  for (const action of actions) {
    if (action.street === 'PREFLOP' && action.isAggressive) raises += 1;
  }
  if (raises === 0) return 'LIMPED';
  if (raises === 1) return 'SINGLE_RAISED';
  if (raises === 2) return 'THREE_BET';
  return 'FOUR_BET_PLUS';
}

function unsupported(
  reason: PostflopUnsupportedReason,
  detail: string,
  heroPosition: StrategyPosition,
): UnsupportedPostflopSpot {
  return { kind: 'UNSUPPORTED', reason, detail, heroPosition };
}

const EXPECTED_BOARD_CARDS: Readonly<Record<'FLOP' | 'TURN' | 'RIVER', number>> = {
  FLOP: 3,
  TURN: 4,
  RIVER: 5,
};

/**
 * Total. Classifies the postflop line. Never throws, never guesses; anything it cannot name
 * comes back as a typed `UNSUPPORTED` member the UI must be able to render.
 */
export function classifyPostflopSpot(query: StrategyQuery): PostflopSpotClassification {
  const hero = query.heroPosition;
  if (query.street === 'PREFLOP') {
    return unsupported('NOT_POSTFLOP', 'The hand is still preflop', hero);
  }
  const street = query.street;
  const expected = EXPECTED_BOARD_CARDS[street];
  if (query.board.length !== expected) {
    return unsupported(
      'BOARD_CARD_COUNT',
      `The ${street} needs ${expected} board cards, got ${query.board.length}`,
      hero,
    );
  }
  if (query.activeOpponentCount === 0) {
    return unsupported('NO_ACTIVE_OPPONENT', 'No opponent is left in the hand', hero);
  }
  const legal = query.legalActions;
  if (!legal.canFold && !legal.canCheck && legal.call === null && legal.allIn === null) {
    return unsupported('NO_LEGAL_ACTION', 'The engine offers hero no action here', hero);
  }

  const streetActions = query.actions.filter((action) => action.street === street);
  const streetAggressions = streetActions.filter((action) => action.isAggressive);
  const lastAggression = streetAggressions.at(-1) ?? null;
  const facingBet = Money.isPositive(query.callAmountMbb);
  const facingAllIn = facingBet && lastAggression !== null && lastAggression.isAllIn;

  // Whether an all-in in front of hero has actually COLLAPSED the tree, read off the query and
  // never inferred (the same two clauses `preflop/spot.ts` uses for its `VS_ALLIN` collapse):
  //   - hero has an aggressive option: the engine offers a wager (a full raise, or a short
  //     all-in raise flagged `onlyAllIn`), or an all-in whose own effect is `RAISE`, and
  //   - a live opponent besides the shover: a dealt-in seat that is not hero, is `IN_HAND`
  //     (so neither folded nor already all-in) and is not the shover.
  const heroHasAggressiveOption =
    legal.wager !== null || (legal.allIn !== null && legal.allIn.effect === 'RAISE');
  const liveOpponentsBesidesAggressor = query.seats.filter(
    (seat) =>
      !seat.isHero && seat.status === 'IN_HAND' && seat.position !== lastAggression?.position,
  ).length;
  const allInCollapsedTree =
    facingAllIn && (!heroHasAggressiveOption || liveOpponentsBesidesAggressor === 0);

  const previous = previousStreetOf(street);
  const previousStreetAggressor = previous === null ? null : query.lastAggressorByStreet[previous];
  const currentStreetAggressor = lastAggression?.position ?? null;

  const heroHasActedThisStreet = streetActions.some((action) => action.position === hero);

  // Checks that came BEFORE hero with no bet outstanding — i.e. checks after the last
  // aggression on this street (or all of them when there has been none).
  const lastAggressionIndex = lastAggression === null ? -1 : streetActions.indexOf(lastAggression);
  const checksBeforeHero = streetActions
    .slice(lastAggressionIndex + 1)
    .filter((action) => action.kind === 'CHECK' && action.position !== hero).length;

  // The faced bet as a fraction of the pot = the LAST AGGRESSIVE WAGER measured against the pot
  // immediately BEFORE that wager. Both numbers are read off the aggressor's own action record
  // (`amountMbb`, `potBeforeMbb`), never reconstructed from hero's price:
  //   - hero's call amount is not the wager whenever hero already has chips in on the street
  //     (a raise over hero's own bet), and
  //   - `potBeforeDecision - call` is not the pot before the wager whenever anyone has called
  //     between the aggressor and hero — their call is counted as if it had been there first.
  // `Money.ratio` performs the division and is the one place money becomes a plain number: the
  // OUTPUT is a ratio, which CLAUDE.md rule 1 exempts explicitly, while every intermediate stays
  // inside `Money`. No raw `-` on money, and no `as number` cast.
  const lastWagerMbb: MilliBB | null = lastAggression?.amountMbb ?? null;
  const potBeforeWagerMbb: MilliBB | null = lastAggression?.potBeforeMbb ?? null;
  const facedBetFractionOfPot =
    facingBet &&
    lastWagerMbb !== null &&
    potBeforeWagerMbb !== null &&
    Money.isPositive(potBeforeWagerMbb)
      ? Money.ratio(lastWagerMbb, potBeforeWagerMbb)
      : null;

  const heroHadInitiative = previousStreetAggressor === hero;

  const family: PostflopSpotFamily = facingAllIn
    ? 'FACING_ALL_IN'
    : facingBet
      ? streetAggressions.length >= 2
        ? 'FACING_RAISE'
        : 'FACING_BET'
      : heroHadInitiative
        ? heroHasActedThisStreet
          ? 'DELAYED_CBET'
          : 'CBET'
        : 'PROBE';

  return {
    kind: 'SPOT',
    family,
    street,
    heroPosition: hero,
    potType: potTypeOf(query.actions),
    lineupSize: query.dealtInCount,
    activeOpponentCount: query.activeOpponentCount,
    heroRelativePosition: query.heroInPosition ? 'IP' : 'OOP',
    streetAggressionCount: streetAggressions.length,
    streetActionCount: streetActions.length,
    checksBeforeHero,
    heroHasActedThisStreet,
    previousStreetAggressor,
    currentStreetAggressor,
    heroHadInitiative,
    heroIsCurrentStreetAggressor: currentStreetAggressor === hero,
    facingBet,
    facingAllIn,
    allInCollapsedTree,
    facedBetFractionOfPot,
  };
}
