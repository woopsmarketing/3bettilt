/**
 * Rake is CONFIGURATION, not code (ADR-0009, ADR-0027, ADR-0033, `docs/GTO_BASELINE.md`).
 * This module is the only place a rake amount is computed, and `Money.mulRatioQuantized`
 * on an exact rational is the only expression used — no float ever touches rake.
 *
 * It also owns the shared per-pot allocator that `fee.ts` reuses. Fee amounts themselves
 * are NOT computed here: rake and fee stay separate all the way down (ADR-0018/0032).
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
  /** true when `triggerPolicy: 'NO_FLOP_NO_DROP'` suppressed the rake entirely. */
  readonly waived: boolean;
}

/**
 * Total. Rake for one hand's summed gross, in three stated steps:
 *
 *   waived = triggerPolicy === 'NO_FLOP_NO_DROP' && !ctx.sawFlop   -> rake ZERO
 *   raw    = mulRatioQuantized(gross, numerator, denominator, quantum, rounding)
 *   rake   = min(raw, cap)
 *
 * The rate is applied and quantized in ONE rounding step (ADR-0027): computing the
 * milliBB rake first and quantizing it afterwards rounds twice and can land a whole
 * quantum away from the exact value. `net` is `gross - rake`; it does NOT account for a
 * fee, which is a separate deduction with its own record (ADR-0032).
 *
 * `capped` is `raw > cap`, so a raw rake that lands exactly on the cap is not "capped".
 * `validateTableConfig` guarantees `cap` is a multiple of `quantum`, so the capped
 * result is quantized too.
 */
export function computeRake(gross: MilliBB, config: RakeConfig, ctx: RakeContext): RakeResult {
  void ctx.contenderCount;
  const waived = config.triggerPolicy === 'NO_FLOP_NO_DROP' && !ctx.sawFlop;
  if (waived || Money.isZero(gross)) {
    return { gross, rake: Money.ZERO, net: gross, capped: false, waived };
  }
  const raw = Money.mulRatioQuantized(
    gross,
    config.numerator,
    config.denominator,
    config.quantum,
    config.rounding,
  );
  const rake = Money.min(raw, config.cap);
  return { gross, rake, net: Money.sub(gross, rake), capped: raw > config.cap, waived: false };
}

/**
 * Internal. The one allocation algorithm, shared by rake and fee.
 *
 * `ceilings[i]` is the most pot `i` can be charged — `pot.amount` for rake, and
 * `pot.amount - rakeAlreadyTaken[i]` for a fee charged on top of a rake. Proportional
 * weights are always the GROSS pot amounts, so the split does not shift because an
 * earlier deduction already took some of a pot.
 *
 * `label` only shapes the invariant messages, so a broken rake and a broken fee do not
 * report the same failure.
 */
export function allocateAcrossPots(
  pots: readonly Pot[],
  ceilings: readonly MilliBB[],
  total: MilliBB,
  allocation: RakeAllocation,
  label: string,
): readonly MilliBB[] {
  if (pots.length === 0) {
    invariant(Money.isZero(total), `cannot allocate ${label} with no pots`);
    return [];
  }
  invariant(ceilings.length === pots.length, `${label} allocation needs one ceiling per pot`);
  if (Money.isZero(total)) return pots.map(() => Money.ZERO);

  const room = Money.sum(ceilings);
  invariant(total <= room, `${label} ${total} exceeds the pot total ${room}`);

  const shares =
    allocation === 'MAIN_POT_FIRST'
      ? drainFromMainPot(ceilings, total)
      : spreadProportionally(pots, ceilings, total);

  shares.forEach((share, index) => {
    const pot = pots[index];
    const ceiling = ceilings[index];
    invariant(
      pot !== undefined && ceiling !== undefined,
      `${label} allocation produced a share for a missing pot ${index}`,
    );
    invariant(
      share <= ceiling,
      `pot ${pot.index} would be charged ${share} ${label} against an available ${ceiling}`,
    );
  });
  invariant(
    Money.sum(shares) === total,
    `allocated ${label} ${Money.sum(shares)} does not sum to ${total}`,
  );
  return shares;
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
  return allocateAcrossPots(
    pots,
    pots.map((pot) => pot.amount),
    totalRake,
    allocation,
    'rake',
  );
}

function drainFromMainPot(ceilings: readonly MilliBB[], total: MilliBB): MilliBB[] {
  let remaining = total;
  return ceilings.map((ceiling) => {
    const take = Money.min(remaining, ceiling);
    remaining = Money.sub(remaining, take);
    return take;
  });
}

function spreadProportionally(
  pots: readonly Pot[],
  ceilings: readonly MilliBB[],
  total: MilliBB,
): MilliBB[] {
  const gross = potTotal(pots);
  const shares = pots.map((pot, index) => {
    const ceiling = ceilings[index] ?? Money.ZERO;
    return Money.min(Money.mulRatio(total, pot.amount, gross, 'floor'), ceiling);
  });
  let remainder = Money.sub(total, Money.sum(shares));
  // Assumption 4 puts the floor remainder on the main pot. At the shipped 5% rate with at
  // most six contributors the main pot always has room for it, but nothing in the types
  // says so, and a pot charged more than it holds would produce a NEGATIVE award.
  // Spilling upward makes that impossible instead of leaving it an unstated precondition;
  // it changes nothing whenever pot 0 has room, which is every shipped configuration.
  for (let index = 0; index < shares.length && !Money.isZero(remainder); index += 1) {
    const share = shares[index];
    const ceiling = ceilings[index];
    invariant(share !== undefined && ceiling !== undefined, `allocation: missing pot ${index}`);
    const take = Money.min(remainder, Money.sub(ceiling, share));
    shares[index] = Money.add(share, take);
    remainder = Money.sub(remainder, take);
  }
  invariant(Money.isZero(remainder), `allocation could not place ${remainder} milliBB`);
  return shares;
}
