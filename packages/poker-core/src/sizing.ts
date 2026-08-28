/**
 * Bet-sizing input helpers: the 33/50/75 pot-fraction shortcuts and the live raise
 * preview from `docs/UX.md`. This is the ONE place in the package where a fraction is
 * applied to money; the sizing *convention* for strategy lookup belongs to gto-core.
 */
import { Money, ok, type MilliBB, type RoundingMode } from '@gto-self/shared';
import { maxWagerToAmount, minWagerToAmount, validateWagerTo } from './betting.js';
import { engineErr, type EngineError, type EngineResult } from './errors.js';
import { potAfterCall, potBeforeAction } from './pots.js';
import type { SeatIndex } from './seat.js';
import type { HandState } from './state.js';

export interface SizingSuggestion {
  readonly toAmount: MilliBB;
  readonly additional: MilliBB;
  readonly requestedFraction: number;
  readonly clampedTo: 'MIN' | 'MAX' | null;
}

/**
 * Backs the `docs/UX.md` raise-input preview block verbatim. `legal: false` with a
 * populated `error` rather than an Err, because the input stays live while the user types.
 */
export interface RaisePreview {
  readonly toAmount: MilliBB;
  readonly additional: MilliBB;
  readonly minToAmount: MilliBB;
  readonly maxToAmount: MilliBB;
  readonly potBefore: MilliBB;
  readonly potAfter: MilliBB;
  readonly fractionOfPotBefore: number | null;
  readonly isAllIn: boolean;
  readonly legal: boolean;
  readonly error: EngineError | null;
}

/**
 * Result. ONE documented formula for both bets and raises:
 * `toAmount = currentBet + mulFraction(potAfterCall(state, seat), fraction, mode)`.
 * Facing no bet this degenerates to `fraction x pot`. The result is clamped into
 * `[minWagerToAmount, maxWagerToAmount]` and `clampedTo` says whether it was, so the UI
 * can grey a shortcut rather than silently sending an illegal size.
 * Rounding is explicit (ADR-0009: sizing rounds -> pass `'round'`).
 *
 * `fraction` and `mode` are user input, so every value that would make `Money` throw is
 * pre-validated into `AMOUNT_OUT_OF_RANGE` BEFORE any arithmetic (spec 5): a negative or
 * non-finite fraction, a product or a resulting raise-to outside `Money.MAX_MILLI_BB`,
 * and — under `'exact'` — a product that is not a whole number of milliBB.
 */
export function wagerToForPotFraction(
  state: HandState,
  seat: SeatIndex,
  fraction: number,
  mode: RoundingMode,
): EngineResult<SizingSuggestion> {
  if (state.phase !== 'BETTING') {
    return engineErr('NOT_BETTING_PHASE', `No seat is on the clock (phase ${state.phase})`);
  }
  if (state.actorSeat !== seat) {
    return engineErr('NOT_ACTORS_TURN', `Seat ${seat} is not on the clock`, { seat });
  }
  if (!Number.isFinite(fraction) || fraction < 0) {
    return engineErr('AMOUNT_OUT_OF_RANGE', `Pot fraction must be a non-negative number`, {
      seat,
    });
  }

  // Plain-number pre-checks, exactly as `previewWager` and `validateWagerTo` do: the point
  // is that `Money` never sees a value that would throw on user input.
  const pot = potAfterCall(state, seat);
  const scaled = (pot as number) * fraction;
  if (!Number.isFinite(scaled) || Math.abs(scaled) > Money.MAX_MILLI_BB) {
    return engineErr(
      'AMOUNT_OUT_OF_RANGE',
      `A ${fraction} x pot sizing on a pot of ${pot} is outside +/-${Money.MAX_MILLI_BB} milliBB`,
      { seat },
    );
  }
  // Same tolerance `Money.mulFraction` applies, so this rejects exactly what would throw.
  if (mode === 'exact' && Math.abs(scaled - Math.round(scaled)) > 1e-9) {
    return engineErr(
      'AMOUNT_OUT_OF_RANGE',
      `A ${fraction} x pot sizing on a pot of ${pot} is ${scaled} milliBB, which 'exact' rounding cannot represent`,
      { seat },
    );
  }

  const base = Money.mulFraction(pot, fraction, mode);
  if (Math.abs((state.round.currentBet as number) + (base as number)) > Money.MAX_MILLI_BB) {
    return engineErr(
      'AMOUNT_OUT_OF_RANGE',
      `A ${fraction} x pot sizing over a current bet of ${state.round.currentBet} is outside +/-${Money.MAX_MILLI_BB} milliBB`,
      { seat },
    );
  }
  const raw = Money.add(state.round.currentBet, base);
  const maxTo = maxWagerToAmount(state, seat);
  const minTo = minWagerToAmount(state, seat);

  let toAmount = raw;
  let clampedTo: 'MIN' | 'MAX' | null = null;
  if (raw > maxTo) {
    toAmount = maxTo;
    clampedTo = 'MAX';
  } else if (raw < minTo) {
    toAmount = Money.min(minTo, maxTo);
    clampedTo = minTo > maxTo ? 'MAX' : 'MIN';
  }

  return ok({
    toAmount,
    additional: Money.sub(toAmount, state.seats[seat].streetContribution),
    requestedFraction: fraction,
    clampedTo,
  });
}

/**
 * Total. Never refuses: illegality is reported inside `legal` / `error` so the raise
 * input stays live while the user types. `fractionOfPotBefore` is
 * `Money.ratio(additional, potBefore)`.
 */
export function previewWager(state: HandState, seat: SeatIndex, toAmount: MilliBB): RaisePreview {
  const betting = state.phase === 'BETTING' && state.actorSeat === seat;
  const potBefore = potBeforeAction(state);
  const inRange = Number.isSafeInteger(toAmount) && Math.abs(toAmount) <= Money.MAX_MILLI_BB;

  const minToAmount = betting ? minWagerToAmount(state, seat) : Money.ZERO;
  const maxToAmount = betting ? maxWagerToAmount(state, seat) : Money.ZERO;
  const streetContribution = state.seats[seat].streetContribution;
  const additional = inRange ? Money.sub(toAmount, streetContribution) : Money.ZERO;

  const validated = betting
    ? validateWagerTo(state, seat, toAmount)
    : engineErr<never>(
        state.phase === 'BETTING' ? 'NOT_ACTORS_TURN' : 'NOT_BETTING_PHASE',
        state.phase === 'BETTING'
          ? `Seat ${seat} is not on the clock`
          : `No seat is on the clock (phase ${state.phase})`,
        { seat },
      );

  return {
    toAmount: inRange ? toAmount : Money.ZERO,
    additional,
    minToAmount,
    maxToAmount,
    potBefore,
    potAfter: Money.add(potBefore, Money.max(Money.ZERO, additional)),
    fractionOfPotBefore: Money.ratio(additional, potBefore),
    isAllIn: inRange && additional === state.seats[seat].stack,
    legal: validated.ok,
    error: validated.ok ? null : validated.error,
  };
}

/** The pot-fraction shortcuts the UX exposes on the raise input. */
export const POT_FRACTION_SHORTCUTS: readonly number[] = [0.33, 0.5, 0.75];
