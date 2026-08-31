/**
 * Canonical preflop spot classification.
 *
 * Input is the neutral `StrategyQuery` — no poker-core types reach this file. Output is a
 * total, deterministic classification of the LINE that led to hero's decision. It contains
 * no strategy: it says what the spot IS, never what to do in it.
 *
 * The rules, in the order they are applied (first match wins). "Aggression" means a BET,
 * a RAISE, or an ALL_IN that raised the price — `StrategyActionRecord.isAggressive`,
 * derived once at the adapter seam.
 *
 * TWO different questions are asked of the action list and they are answered by two
 * different filters (R1 MINOR-1):
 *
 *   WHO is the aggressor, how big was it, was it a shove   -> `isAggressive`
 *   HOW DEEP is the betting tree (open / 3-bet / 4-bet)    -> `isAggressive && isFullRaise`
 *
 * A short all-in that does not reach a full raise puts money in front of hero but does not
 * open a new betting round, so counting it as tree depth pushed genuine 3-bet spots into the
 * UNSUPPORTED cold-5-bet branch. `StrategyActionRecord` already carries both flags.
 * DEGENERATE CASE: when every aggression is a short all-in there is no full raise to count,
 * yet a raise IS standing in front of hero; the first aggression is then counted as the open
 * so the line can never be mistaken for RFI.
 *
 *  0. not preflop, or no live opponent            -> UNSUPPORTED
 *  1. hero is the current aggressor
 *       one raise and someone called behind       -> OPEN_PLUS_CALLER
 *       otherwise                                 -> UNSUPPORTED (hero cannot face itself)
 *  2. the last aggression was all-in, hero owes chips, AND the tree has COLLAPSED
 *                                                 -> VS_ALLIN   (raiseCount still reported)
 *  3. no aggression yet
 *       no limpers                                -> RFI
 *       limpers                                   -> VS_LIMP
 *  4. exactly one aggression (an open)
 *       hero and the opener are the last two, both blinds -> BLIND_VS_BLIND
 *       a caller behind the open, hero not yet in -> SQUEEZE
 *       a caller behind the open, hero already in -> OPEN_PLUS_CALLER
 *       otherwise                                 -> VS_OPEN
 *  5. two aggressions (a 3-bet)
 *       hero opened                               -> OPENER_VS_3BET
 *       hero has not acted                        -> COLD_4BET
 *       hero had already entered the pot          -> UNSUPPORTED (CALLER_FACING_THREE_BET)
 *  6. three aggressions (a 4-bet)
 *       hero 3-bet                                -> VS_4BET
 *       otherwise                                 -> UNSUPPORTED (COLD_FIVE_BET)
 *  7. four or more aggressions                    -> UNSUPPORTED (BEYOND_FOUR_BET)
 *
 * `blindVsBlind` is also reported as a FLAG on every family, so an SB-limp-into-BB spot is
 * `VS_LIMP` with the flag set rather than being force-fitted into `BLIND_VS_BLIND`.
 *
 * `facingAllIn` is the SAME kind of flag, and rule 2 above is deliberately narrow (R1 BLOCKER
 * B1). `VS_ALLIN` means "the decision really is call or fold": either the engine offers hero
 * no way to put in more money, or nobody but the shover is still able to act. An all-in that
 * leaves BOTH a legal raise and a live opponent behind has NOT collapsed the tree — hero can
 * still isolate — so the spot keeps its underlying family (`VS_OPEN`, `SQUEEZE`,
 * `OPENER_VS_3BET`, ...) and reports `facingAllIn: true`. Before that narrowing, a 3bb shove
 * from a short stack made hero flat AA with four players still to act behind it.
 *
 * Nothing here guesses. Everything the rules cannot name comes back as a typed
 * `UNSUPPORTED` member with a reason, which the UI must be able to render.
 */
import { Money, type MilliBB } from '@gto-self/shared';
import type {
  StrategyActionRecord,
  StrategyPosition,
  StrategyQuery,
  StrategySeatProfile,
} from '../types.js';

export type PreflopSpotFamily =
  | 'RFI'
  | 'VS_LIMP'
  | 'VS_OPEN'
  | 'OPEN_PLUS_CALLER'
  | 'SQUEEZE'
  | 'OPENER_VS_3BET'
  | 'COLD_4BET'
  | 'VS_4BET'
  | 'BLIND_VS_BLIND'
  | 'VS_ALLIN';

export type PreflopSpotUnsupportedReason =
  | 'NOT_PREFLOP'
  | 'NO_ACTIVE_OPPONENT'
  | 'HERO_IS_CURRENT_AGGRESSOR'
  | 'CALLER_FACING_THREE_BET'
  | 'COLD_FIVE_BET'
  | 'BEYOND_FOUR_BET';

export type HeroRelativePosition = 'IP' | 'OOP';

export interface PreflopSpot {
  readonly kind: 'SPOT';
  readonly family: PreflopSpotFamily;
  readonly heroPosition: StrategyPosition;
  /** Players dealt into the hand: 2..6. */
  readonly lineupSize: number;
  /** Players who have not folded, hero included. */
  readonly playersRemaining: number;
  /** Aggressive actions so far. 1 = an open, 2 = a 3-bet, 3 = a 4-bet. */
  readonly raiseCount: number;
  /** Calls made before any aggression. */
  readonly limperCount: number;
  /** Calls made after the LAST aggression. */
  readonly callerCount: number;
  /** Calls made after the FIRST aggression — cold callers of the open. */
  readonly coldCallerCount: number;
  readonly openerPosition: StrategyPosition | null;
  /** Whoever made the last aggression: the opener, the 3-bettor, the 4-bettor. */
  readonly aggressorPosition: StrategyPosition | null;
  /** The open's raise-TO size. */
  readonly openSizeMbb: MilliBB | null;
  /** The same value in BB as a float — presentation/boundary only, never fed back to math. */
  readonly openSizeBB: number | null;
  /** The last aggression's raise-TO size (equals the open when raiseCount is 1). */
  readonly lastAggressionToMbb: MilliBB | null;
  readonly lastAggressionToBB: number | null;
  /** Hero's postflop order relative to the last aggressor. `null` when there is none. */
  readonly heroVsAggressor: HeroRelativePosition | null;
  /** Hero has already put in a voluntary action this street. */
  readonly heroHasActed: boolean;
  /** Only the two blinds are left in the hand. */
  readonly blindVsBlind: boolean;
  /** The last aggression was all-in and hero owes chips to continue. */
  readonly facingAllIn: boolean;
  /**
   * `facingAllIn` AND the tree has collapsed to a call/fold decision: hero has no aggressive
   * option, or no live opponent besides the shover remains. This is exactly the condition
   * under which `family` is `VS_ALLIN`; it is reported separately so a consumer can tell a
   * collapsed shove from one hero can still raise over.
   */
  readonly allInCollapsedTree: boolean;
}

export interface UnsupportedPreflopSpot {
  readonly kind: 'UNSUPPORTED';
  readonly reason: PreflopSpotUnsupportedReason;
  readonly detail: string;
  readonly heroPosition: StrategyPosition;
  readonly raiseCount: number;
}

export type PreflopSpotClassification = PreflopSpot | UnsupportedPreflopSpot;

function unsupported(
  reason: PreflopSpotUnsupportedReason,
  detail: string,
  heroPosition: StrategyPosition,
  raiseCount: number,
): UnsupportedPreflopSpot {
  return { kind: 'UNSUPPORTED', reason, detail, heroPosition, raiseCount };
}

function profileAt(
  query: StrategyQuery,
  position: StrategyPosition,
): StrategySeatProfile | undefined {
  return query.seats.find((seat) => seat.position === position);
}

function isPassiveEntry(action: StrategyActionRecord): boolean {
  return action.kind === 'CALL' || (action.kind === 'ALL_IN' && !action.isAggressive);
}

/**
 * Total. Can hero put MORE money in than a call? The engine offers a `wager` for a full
 * raise and also for a short all-in raise (`onlyAllIn`); when it offers neither, an `allIn`
 * whose `effect` is `RAISE` is still an aggressive option. `effect: 'CALL'` is not — that
 * all-in is hero calling with the last of the stack.
 */
function heroCanRaise(query: StrategyQuery): boolean {
  const legal = query.legalActions;
  if (legal.wager !== null) return true;
  return legal.allIn !== null && legal.allIn.effect === 'RAISE';
}

/**
 * Total. Live opponents OTHER than the seat that shoved: not hero, not folded, not already
 * all-in themselves. These are the players an isolation raise would still be charging.
 */
function liveOpponentsBehindShover(query: StrategyQuery, shover: StrategyPosition | null): number {
  return query.seats.filter(
    (seat) =>
      !seat.isHero &&
      seat.status !== 'FOLDED' &&
      seat.status !== 'ALL_IN' &&
      seat.position !== shover,
  ).length;
}

/**
 * Total. Classifies the preflop line. Never throws, never guesses; every unnamed line comes
 * back as `{ kind: 'UNSUPPORTED', reason }`.
 */
export function classifyPreflopSpot(query: StrategyQuery): PreflopSpotClassification {
  const hero = query.heroPosition;
  if (query.street !== 'PREFLOP') {
    return unsupported('NOT_PREFLOP', `The hand is on the ${query.street}`, hero, 0);
  }

  const acts = query.actions.filter((action) => action.street === 'PREFLOP');
  const aggressions = acts.filter((action) => action.isAggressive);
  // Tree depth counts FULL raises only (MINOR-1). When every aggression is a short all-in
  // there is still a raise standing in front of hero, so the first one counts as the open.
  const fullRaises = aggressions.filter((action) => action.isFullRaise);
  const structural: readonly StrategyActionRecord[] =
    fullRaises.length > 0 ? fullRaises : aggressions.slice(0, 1);
  const raiseCount = structural.length;

  if (query.activeOpponentCount === 0) {
    return unsupported('NO_ACTIVE_OPPONENT', 'No opponent is left in the hand', hero, raiseCount);
  }

  // The OPEN is the first structural raise; the AGGRESSOR is whoever acted last, full raise
  // or not, because that is the bet hero is actually facing.
  const firstAggression = structural[0] ?? null;
  const lastAggression = aggressions.at(-1) ?? null;
  const firstAggressionIndex = firstAggression === null ? -1 : acts.indexOf(firstAggression);
  const lastAggressionIndex = lastAggression === null ? -1 : acts.indexOf(lastAggression);

  const limperCount =
    firstAggressionIndex === -1
      ? acts.filter(isPassiveEntry).length
      : acts.slice(0, firstAggressionIndex).filter(isPassiveEntry).length;
  const coldCallerCount =
    firstAggressionIndex === -1
      ? 0
      : acts.slice(firstAggressionIndex + 1).filter(isPassiveEntry).length;
  const callerCount =
    lastAggressionIndex === -1
      ? 0
      : acts.slice(lastAggressionIndex + 1).filter(isPassiveEntry).length;

  const heroHasActed = acts.some((action) => action.position === hero);
  const heroProfile = profileAt(query, hero);
  const aggressorProfile =
    lastAggression === null ? undefined : profileAt(query, lastAggression.position);
  const heroVsAggressor: HeroRelativePosition | null =
    heroProfile === undefined || aggressorProfile === undefined
      ? null
      : heroProfile.postflopOrder > aggressorProfile.postflopOrder
        ? 'IP'
        : 'OOP';

  const remaining = query.seats.filter((seat) => seat.status !== 'FOLDED');
  const blindVsBlind = remaining.length === 2 && remaining.every((seat) => seat.blindRole !== null);

  const facingAllIn =
    lastAggression !== null && lastAggression.isAllIn && Money.isPositive(query.callAmountMbb);

  /**
   * B1. The tree has collapsed only when hero cannot raise at all, or when nobody except the
   * shover is still able to act. Either way the decision really is call-or-fold (or
   * call/fold/jam-for-less against the shover alone). Anything else still has fold equity to
   * play for against the players behind, so it keeps its own family.
   */
  const allInCollapsedTree =
    facingAllIn &&
    (!heroCanRaise(query) ||
      liveOpponentsBehindShover(query, lastAggression?.position ?? null) === 0);

  const base: Omit<PreflopSpot, 'family'> = {
    kind: 'SPOT',
    heroPosition: hero,
    lineupSize: query.dealtInCount,
    playersRemaining: remaining.length,
    raiseCount,
    limperCount,
    callerCount,
    coldCallerCount,
    openerPosition: firstAggression?.position ?? null,
    aggressorPosition: lastAggression?.position ?? null,
    openSizeMbb: firstAggression?.toAmountMbb ?? null,
    openSizeBB:
      firstAggression === null || firstAggression.toAmountMbb === null
        ? null
        : Money.toBB(firstAggression.toAmountMbb),
    lastAggressionToMbb: lastAggression?.toAmountMbb ?? null,
    lastAggressionToBB:
      lastAggression === null || lastAggression.toAmountMbb === null
        ? null
        : Money.toBB(lastAggression.toAmountMbb),
    heroVsAggressor,
    heroHasActed,
    blindVsBlind,
    facingAllIn,
    allInCollapsedTree,
  };

  const spot = (family: PreflopSpotFamily): PreflopSpot => ({ ...base, family });

  // 1. Hero cannot be facing its own aggression.
  if (lastAggression !== null && lastAggression.position === hero) {
    if (raiseCount === 1 && callerCount >= 1) return spot('OPEN_PLUS_CALLER');
    return unsupported(
      'HERO_IS_CURRENT_AGGRESSOR',
      'Hero made the last aggression and faces no new one',
      hero,
      raiseCount,
    );
  }

  // 2. An all-in in front of hero collapses the tree ONLY when there is nothing left to
  //    raise into: no legal aggression, or no live opponent besides the shover.
  if (allInCollapsedTree) return spot('VS_ALLIN');

  // 3. Nobody has raised.
  if (raiseCount === 0) return spot(limperCount === 0 ? 'RFI' : 'VS_LIMP');

  // 4. One open.
  if (raiseCount === 1) {
    if (blindVsBlind) return spot('BLIND_VS_BLIND');
    if (coldCallerCount >= 1) return spot(heroHasActed ? 'OPEN_PLUS_CALLER' : 'SQUEEZE');
    return spot('VS_OPEN');
  }

  // 5. A 3-bet.
  if (raiseCount === 2) {
    if (firstAggression !== null && firstAggression.position === hero) {
      return spot('OPENER_VS_3BET');
    }
    if (!heroHasActed) return spot('COLD_4BET');
    return unsupported(
      'CALLER_FACING_THREE_BET',
      'Hero had already entered the pot and now faces a 3-bet; this line is not modelled',
      hero,
      raiseCount,
    );
  }

  // 6. A 4-bet.
  if (raiseCount === 3) {
    const threeBettor = structural[1] ?? null;
    if (threeBettor !== null && threeBettor.position === hero) return spot('VS_4BET');
    return unsupported(
      'COLD_FIVE_BET',
      'Hero faces a 4-bet without having 3-bet; this line is not modelled',
      hero,
      raiseCount,
    );
  }

  // 7. Beyond a 4-bet.
  return unsupported(
    'BEYOND_FOUR_BET',
    `${raiseCount} preflop raises is beyond the modelled tree`,
    hero,
    raiseCount,
  );
}
