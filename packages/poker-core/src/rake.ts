/**
 * Rake is CONFIGURATION, not code (ADR-0009, `docs/GTO_BASELINE.md`). This module is the
 * only place a rake amount is computed, and `Money.mulRatio` on an exact rational is the
 * only expression used — no float ever touches rake.
 */
import { invariant, Money, type MilliBB } from '@gto-self/shared';
import type { RakeAllocation, RakeConfig } from './config.js';
import { potTotal, type Pot } from './pots.js';

export interface RakeContext {
  /** `state.board.length >= 3` */
  readonly sawFlop: boolean;
  readonly contenderCount: number;
}

export interface RakeResult {
  readonly gross: MilliBB;
  readonly rake: MilliBB;
  readonly net: MilliBB;
  readonly capped: boolean;
  /** true when `noFlopNoDrop` suppressed the rake entirely. */
  readonly waived: boolean;
}

/**
 * Total. `waived` when `!ctx.sawFlop && config.noFlopNoDrop`, giving ZERO rake.
 * Otherwise `min(mulRatio(gross, numerator, denominator, rounding), cap)`.
 */
export function computeRake(gross: MilliBB, config: RakeConfig, ctx: RakeContext): RakeResult {
  void ctx.contenderCount;
  const waived = config.noFlopNoDrop && !ctx.sawFlop;
  if (waived || Money.isZero(gross)) {
    return { gross, rake: Money.ZERO, net: gross, capped: false, waived };
  }
  const raw = Money.mulRatio(gross, config.numerator, config.denominator, config.rounding);
  const rake = Money.min(raw, config.cap);
  return { gross, rake, net: Money.sub(gross, rake), capped: raw > config.cap, waived: false };
}

/**
 * Total. One rake amount per pot, same length and order as `pots`, summing EXACTLY to
 * `totalRake`. No pot is ever charged more rake than it holds, so `netAmount` is never
 * negative (asserted).
 *
 * `'PROPORTIONAL'` (the shipped default, assumption 4) floors each pot's share of the
 * capped total and gives the floor remainder to the main pot, spilling into later pots
 * only in the degenerate case where the main pot cannot absorb it.
 *
 * `'MAIN_POT_FIRST'` drains the whole per-hand rake from index 0 upward. **Stated
 * consequence:** when the main pot is smaller than the capped rake — e.g. a seat all-in
 * from a partial ante makes a 0.6 BB main pot beside a 300 BB side pot — this takes the
 * ENTIRE main pot, and its winner is awarded `netAmount` ZERO. That is what "main pot
 * first" means arithmetically; it is a policy, not an accident, and it is why
 * `'PROPORTIONAL'` is the default. Correct it by configuration (`rake.allocation`), not
 * by code, per `CLAUDE.md` rule 7.
 */
export function allocateRake(
  pots: readonly Pot[],
  totalRake: MilliBB,
  allocation: RakeAllocation,
): readonly MilliBB[] {
  if (pots.length === 0) {
    invariant(Money.isZero(totalRake), 'cannot allocate rake with no pots');
    return [];
  }
  if (Money.isZero(totalRake)) return pots.map(() => Money.ZERO);

  const gross = potTotal(pots);
  invariant(totalRake <= gross, `rake ${totalRake} exceeds the pot total ${gross}`);

  const shares =
    allocation === 'MAIN_POT_FIRST'
      ? drainFromMainPot(pots, totalRake)
      : spreadProportionally(pots, totalRake, gross);

  shares.forEach((share, index) => {
    const pot = pots[index];
    invariant(pot !== undefined, `allocateRake produced a share for a missing pot ${index}`);
    invariant(
      share <= pot.amount,
      `pot ${pot.index} would be charged ${share} rake against an amount of ${pot.amount}`,
    );
  });
  invariant(
    Money.sum(shares) === totalRake,
    `allocated rake ${Money.sum(shares)} does not sum to ${totalRake}`,
  );
  return shares;
}

function drainFromMainPot(pots: readonly Pot[], totalRake: MilliBB): MilliBB[] {
  let remaining = totalRake;
  return pots.map((pot) => {
    const take = Money.min(remaining, pot.amount);
    remaining = Money.sub(remaining, take);
    return take;
  });
}

function spreadProportionally(pots: readonly Pot[], totalRake: MilliBB, gross: MilliBB): MilliBB[] {
  const shares = pots.map((pot) => Money.mulRatio(totalRake, pot.amount, gross, 'floor'));
  let remainder = Money.sub(totalRake, Money.sum(shares));
  // Assumption 4 puts the floor remainder on the main pot. At the shipped 5% rate with at
  // most six contributors the main pot always has room for it, but nothing in the types
  // says so, and a pot charged more rake than it holds would produce a NEGATIVE award.
  // Spilling upward makes that impossible instead of leaving it an unstated precondition;
  // it changes nothing whenever pot 0 has room, which is every shipped configuration.
  for (let index = 0; index < shares.length && !Money.isZero(remainder); index += 1) {
    const pot = pots[index];
    const share = shares[index];
    invariant(pot !== undefined && share !== undefined, `allocateRake: missing pot ${index}`);
    const take = Money.min(remainder, Money.sub(pot.amount, share));
    shares[index] = Money.add(share, take);
    remainder = Money.sub(remainder, take);
  }
  invariant(Money.isZero(remainder), `allocateRake could not place ${remainder} milliBB of rake`);
  return shares;
}
