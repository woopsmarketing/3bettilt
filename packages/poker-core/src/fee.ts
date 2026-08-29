/**
 * The splash fee — a deduction from the pot payout that is SEPARATE from the rake and is
 * never folded into it (ADR-0018, confirmed by ADR-0032).
 *
 * `poker-core` deliberately knows no fee TRIGGER. CoinPoker's is unknown (ADR-0032/0033)
 * and `CLAUDE.md` rule 7 forbids inventing one, so under `'MANUAL'` the amount is an
 * OBSERVED input supplied at award time. This module validates that input's range and
 * allocates it across pots; it never re-quantizes or otherwise rewrites it, because
 * rewriting an entered value would destroy user input (`CLAUDE.md` rule 3).
 *
 * Fee logic lives here and not in `computeRake` on purpose: `RakeResult` has no fee
 * field, and the two amounts are recorded separately end to end.
 */
import { Money, ok, type MilliBB } from '@gto-self/shared';
import type { FeeConfig } from './config.js';
import { engineErr, type EngineResult } from './errors.js';
import type { Pot } from './pots.js';
import { allocateAcrossPots } from './rake.js';

/** What a supplied fee has to fit inside. Both amounts are for the whole hand. */
export interface FeeContext {
  /** Summed gross of every pot being awarded. */
  readonly gross: MilliBB;
  /** The rake already being taken from that same gross. */
  readonly rake: MilliBB;
}

/**
 * Result. The total fee for one hand, given what the user supplied (`null` = nothing
 * supplied). Never throws; a bad fee is user data, not a programmer error.
 *
 * Rejects, each with its own code:
 *  - `FEE_NEGATIVE`      a negative fee;
 *  - `FEE_NOT_ALLOWED`   a NON-ZERO fee supplied while `triggerPolicy` is `'NEVER'`;
 *  - `FEE_ABOVE_CAP`     a fee above `config.cap`;
 *  - `FEE_EXCEEDS_POT`   a fee that, with the rake, would exceed the pot total.
 *
 * A supplied fee that passes is returned UNCHANGED — not quantized, not capped, not
 * clamped. Nothing supplied gives ZERO under every policy: there is no automatic fee in
 * this version. An explicit ZERO is likewise accepted everywhere, because a zero fee is
 * the absence of a fee; only charging one under `'NEVER'` is the error.
 */
export function resolveFee(
  supplied: MilliBB | null,
  config: FeeConfig,
  ctx: FeeContext,
): EngineResult<MilliBB> {
  if (supplied === null) return ok(Money.ZERO);
  if (supplied < 0) {
    return engineErr('FEE_NEGATIVE', `A fee must not be negative, got ${supplied}`, {
      actual: supplied,
    });
  }
  if (Money.isZero(supplied)) return ok(Money.ZERO);
  if (config.triggerPolicy === 'NEVER') {
    return engineErr(
      'FEE_NOT_ALLOWED',
      `A fee of ${supplied} was supplied but fee.triggerPolicy is 'NEVER'; no fee can be charged`,
      { actual: supplied },
    );
  }
  if (supplied > config.cap) {
    return engineErr('FEE_ABOVE_CAP', `A fee of ${supplied} exceeds fee.cap ${config.cap}`, {
      actual: supplied,
      max: config.cap,
    });
  }
  const available = Money.sub(ctx.gross, ctx.rake);
  if (supplied > available) {
    return engineErr(
      'FEE_EXCEEDS_POT',
      `A fee of ${supplied} plus rake ${ctx.rake} exceeds the pot total ${ctx.gross}`,
      { actual: supplied, max: available },
    );
  }
  return ok(supplied);
}

/**
 * Total. One fee amount per pot, same length and order as `pots`, summing EXACTLY to
 * `totalFee`. Uses the SAME allocator as the rake, with each pot's ceiling reduced by
 * the rake already taken from it, so no pot is ever over-charged and `netAmount` is
 * never negative (asserted).
 *
 * `rakePerPot` must already be the allocated rake for the same pots, in the same order.
 */
export function allocateFee(
  pots: readonly Pot[],
  rakePerPot: readonly MilliBB[],
  totalFee: MilliBB,
  allocation: FeeConfig['allocation'],
): readonly MilliBB[] {
  const ceilings = pots.map((pot, index) => Money.sub(pot.amount, rakePerPot[index] ?? Money.ZERO));
  return allocateAcrossPots(pots, ceilings, totalFee, allocation, 'fee');
}
