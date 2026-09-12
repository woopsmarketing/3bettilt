/**
 * WHO the rules are about, and who they must be afraid of — WP-J design contract §9.
 *
 * ---------------------------------------------------------------------------------------
 * TWO SEPARATE IDEAS, AND KEEPING THEM SEPARATE IS THE POINT
 *
 * 1. ONE villain drives the rule table. Every rule in `frequencyModel.ts` is a sentence about a
 *    single opponent ("this player folds too much"), and averaging three opponents' fold
 *    frequencies would produce a player who does not exist and then exploit them. So exactly
 *    one opponent is named PRIMARY and only that profile is read.
 *
 * 2. The OTHERS still constrain us. A read that says "bet more" is only safe if the players who
 *    have not acted yet are not waiting to punish it. That is what the BEHIND role and the
 *    guard rail below are for. They never ADD an adjustment; they can only refuse one.
 *
 * ---------------------------------------------------------------------------------------
 * THIS MODULE COMPUTES NO POKER ORDER
 *
 * `adaptive-core` cannot import `poker-core` and holds no notion of button, blinds or action
 * order. Every ordering fact — who is live, who acts after hero, who put in the last bet —
 * arrives as an explicit field on `AdaptiveOpponentOrdering`, supplied by the caller that
 * already has the hand state. What this module owns is the POLICY on top of those facts: which
 * role each opponent gets, and what a role licenses. If the caller supplies nothing, there is
 * no primary villain, no rule fires, and ADAPTIVE reports `INSUFFICIENT_DATA` — which is the
 * correct degenerate answer, not a fallback that guesses.
 * ---------------------------------------------------------------------------------------
 */
import type { AdaptiveStreet } from './baseline.js';
import type { PlayerAdjustmentProfile } from './profile.js';
import { BEHIND_AGGRESSION_GATE_BPS } from './policy/frequencyModel.js';
import type { AdaptiveStatKey } from './stats.js';

/**
 * The ordering facts about ONE opponent, all supplied by the caller.
 *
 * Every field is a statement about the hand as it stands at hero's decision. None of them is
 * derived here, and none of them is optional-with-a-default: a caller that does not know
 * something says `false`, which always makes the layer do less.
 */
export interface AdaptiveOpponentOrdering {
  readonly playerId: string;
  readonly seatIndex: number;
  /** Still in the hand and still able to act. A folded or all-in seat is not live. */
  readonly isLive: boolean;
  /** Acts AFTER hero on this street, in the caller's own computed action order. */
  readonly actsAfterHero: boolean;
  /**
   * Put in the last bet or raise on this street. At most one opponent should carry it; if the
   * caller sets several, the lowest `actionOrderIndex` wins, deterministically.
   */
  readonly isLastAggressorThisStreet: boolean;
  /**
   * The caller's own action-order position for this seat on this street. Used ONLY to order
   * candidates deterministically — never to work out who acts when.
   */
  readonly actionOrderIndex: number;
}

/** What one opponent is to hero's decision. Exactly one role per opponent. */
export type AdaptiveOpponentRoleKind = 'PRIMARY' | 'BEHIND' | 'OTHER';

export interface AdaptiveOpponentRole {
  readonly playerId: string;
  readonly seatIndex: number;
  readonly role: AdaptiveOpponentRoleKind;
  /**
   * Carried through from the caller's ordering facts because the §9 guard rail needs them
   * INDEPENDENTLY of the role. `role` answers "whose profile drives the rules"; these two
   * answer "who can still punish hero's aggression", and the PRIMARY is very often both.
   */
  readonly isLive: boolean;
  readonly actsAfterHero: boolean;
}

/**
 * Total. Assigns a role to every opponent the caller listed, preserving the caller's order.
 *
 * PRIMARY — the villain hero's decision most directly faces:
 *   - hero facing a bet: the live opponent who made it (`isLastAggressorThisStreet`);
 *   - otherwise: the first live opponent still to act after hero, by `actionOrderIndex`.
 * There is at most one, and there may be none (nobody live, or nobody behind in a spot where
 * hero is not facing a bet — hero closing the action on the river, for instance).
 *
 * BEHIND — every OTHER live opponent who acts after hero this street. The primary is excluded
 * deliberately: when hero is not facing a bet the primary is itself a player behind, and its
 * own aggression is already fully represented by the rules reading its profile. The guard rail
 * exists for the THIRD party whose profile nothing else consults.
 *
 * OTHER — everyone else: folded, all-in, or live but already acted this street.
 */
export function classifyOpponents(
  orderings: readonly AdaptiveOpponentOrdering[],
  heroFacingBet: boolean,
): readonly AdaptiveOpponentRole[] {
  const primaryId = primaryOpponentIdOf(orderings, heroFacingBet);
  return orderings.map((ordering) => ({
    playerId: ordering.playerId,
    seatIndex: ordering.seatIndex,
    role:
      ordering.playerId === primaryId
        ? 'PRIMARY'
        : ordering.isLive && ordering.actsAfterHero
          ? 'BEHIND'
          : 'OTHER',
    isLive: ordering.isLive,
    actsAfterHero: ordering.actsAfterHero,
  }));
}

/**
 * Total. The PRIMARY villain's `playerId`, or `null` when the caller's facts name none.
 *
 * Ties are broken by the lowest `actionOrderIndex`, then by the lowest `seatIndex`, then by
 * `playerId` compared as a string — three levels, because the output is a stored trace and a
 * tie that resolved differently between two runs would make the trace irreproducible.
 */
export function primaryOpponentIdOf(
  orderings: readonly AdaptiveOpponentOrdering[],
  heroFacingBet: boolean,
): string | null {
  const candidates = orderings.filter((ordering) =>
    heroFacingBet
      ? ordering.isLive && ordering.isLastAggressorThisStreet
      : ordering.isLive && ordering.actsAfterHero,
  );
  let best: AdaptiveOpponentOrdering | null = null;
  for (const candidate of candidates) {
    if (best === null || comparePrimaryCandidates(candidate, best) < 0) best = candidate;
  }
  return best === null ? null : best.playerId;
}

/** Internal. Strict total order over candidates, so the choice never depends on input order. */
function comparePrimaryCandidates(
  a: AdaptiveOpponentOrdering,
  b: AdaptiveOpponentOrdering,
): number {
  if (a.actionOrderIndex !== b.actionOrderIndex) return a.actionOrderIndex - b.actionOrderIndex;
  if (a.seatIndex !== b.seatIndex) return a.seatIndex - b.seatIndex;
  return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
}

/**
 * The stats the guard rail reads, in the order it reads them.
 *
 * `CHECK_RAISE_{street}` postflop and `THREE_BET` on every street. Both measure the same thing
 * from hero's point of view: how often this player, sitting behind hero, turns hero's bet into
 * a decision for hero's stack. `THREE_BET` is included postflop as well as preflop because a
 * player's willingness to re-raise is not a preflop-only trait and it is the only such stat we
 * have that is not street-scoped.
 */
function guardStatsFor(street: AdaptiveStreet): readonly AdaptiveStatKey[] {
  if (street === 'PREFLOP') return ['THREE_BET'];
  const checkRaise: AdaptiveStatKey =
    street === 'FLOP'
      ? 'CHECK_RAISE_FLOP'
      : street === 'TURN'
        ? 'CHECK_RAISE_TURN'
        : 'CHECK_RAISE_RIVER';
  return [checkRaise, 'THREE_BET'];
}

/** The guard rail's finding: whether it trips, and on whose evidence. */
export interface BehindAggressionFinding {
  readonly tripped: boolean;
  /** The opponent whose stat tripped it, or `null`. */
  readonly playerId: string | null;
  /** The stat that tripped it, or `null`. */
  readonly stat: AdaptiveStatKey | null;
  readonly confidenceBps: number;
  readonly deviationBps: number;
}

/** The finding when nothing trips. Written once so the shape cannot drift between branches. */
const NO_FINDING: BehindAggressionFinding = {
  tripped: false,
  playerId: null,
  stat: null,
  confidenceBps: 0,
  deviationBps: 0,
};

/**
 * Total. THE J9 GUARD RAIL.
 *
 * If ANY live opponent STILL TO ACT — the primary included, see the body — check-raises this
 * street, or 3-bets, ABOVE its anchor at `confidenceBps >= BEHIND_AGGRESSION_GATE_BPS`, then
 * every POSITIVE `AGGRESSION` contribution is refused (`cappedBy:
 * 'AGGRESSIVE_PLAYER_BEHIND'`). Negative — de-escalating — contributions survive untouched,
 * and so does everything targeting CONTINUE or FOLD.
 *
 * WHY THIS EXISTS. It is the one composition error that a per-opponent rule table cannot catch
 * on its own. The primary villain folds to c-bets 70% of the time, so the table says bet more;
 * meanwhile a known check-raiser is sitting behind with cards. Betting more there is not an
 * exploit, it is walking into the only player at the table who has shown they will punish it.
 * The asymmetry — positive refused, negative kept — is deliberate and is the safe direction: a
 * player behind is never a reason to become MORE aggressive.
 *
 * Deterministic: opponents are scanned in the caller's order, stats in `guardStatsFor`'s order,
 * and the FIRST trip is reported. Which one is reported changes only the explanation, never the
 * effect, but it still has to be stable for a stored trace to reproduce.
 */
export function findAggressivePlayerBehind(
  roles: readonly AdaptiveOpponentRole[],
  profiles: ReadonlyMap<string, PlayerAdjustmentProfile>,
  street: AdaptiveStreet,
): BehindAggressionFinding {
  const stats = guardStatsFor(street);
  for (const role of roles) {
    // EVERY live opponent still to act, INCLUDING the PRIMARY — not just role `BEHIND`.
    //
    // This used to read `role.role !== 'BEHIND'`, on the reasoning that when hero is not
    // facing a bet the PRIMARY is itself a player behind and its own aggression is already
    // represented by the rules that read its profile. Review R1 falsified that: the offset
    // is PARTIAL, not complete. With one opponent reading FOLD_TO_CBET 75% / CHECK_RAISE
    // 30% (both n=100), `CHECK_RAISE_HIGH` contributes -672 against +1132 gross from
    // `FOLD_TO_CBET_HIGH` and `WTSD_LOW_BLUFF_UP`, so the net was a bluff INCREASE against
    // a known check-raiser. Heads-up there is no third party, so the guard was
    // structurally unreachable in the single most common spot at this table.
    //
    // ADR-0065(e) is authoritative and its wording was always the broader one: "a live
    // opponent still to act". When hero IS facing a bet the primary is the player who
    // already bet, so `actsAfterHero` is false and they are correctly excluded.
    if (!role.isLive || !role.actsAfterHero) continue;
    const profile = profiles.get(role.playerId);
    if (profile === undefined) continue;
    for (const stat of stats) {
      const estimate = profile.stats[stat];
      if (estimate.deviationBps <= 0) continue;
      if (estimate.confidenceBps < BEHIND_AGGRESSION_GATE_BPS) continue;
      return {
        tripped: true,
        playerId: role.playerId,
        stat,
        confidenceBps: estimate.confidenceBps,
        deviationBps: estimate.deviationBps,
      };
    }
  }
  return NO_FINDING;
}
