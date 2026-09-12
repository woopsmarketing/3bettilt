/**
 * The parse boundary for 3BetTilt's calculators — where a person's typing becomes a
 * number the domain can answer about.
 *
 * ## Money stops being a float here
 *
 * CLAUDE.md rule 1 permits floating point only at the UI/parse boundary. This module IS
 * that boundary: text goes in, integer `MilliBB` comes out, and everything downstream
 * (`potOdds`, every pot and bet on screen) is integer milliBB from that point on. The
 * conversion itself is delegated to `Money.parseBB` rather than reimplemented — one place
 * decides what "2.37 BB" means.
 *
 * ## Why a typed error instead of `Money.parseBB`'s message
 *
 * `Money.parseBB` returns an English sentence written for a developer. A beginner facing a
 * calculator needs a Korean sentence written for them, and the two must not drift apart or
 * be produced by string-matching another package's prose. So the shape of the input is
 * checked here, in the same three tests `Money.parseBB` documents, and the result is a
 * typed union `features/tools/copy.ts` turns into Korean. Only the range guard is left to
 * `Money.parseBB` — it is the one rejection that survives the checks above, and it depends
 * on `MAX_MILLI_BB`, which belongs to `shared`, not here.
 *
 * ## What is NOT validated here
 *
 * A negative amount parses fine. So does a zero call. Those are POKER questions — "a pot
 * cannot be negative", "there is no call to price when nothing was bet" — and `potOdds`
 * already answers them with typed errors of its own. Re-deciding them here would give the
 * app two rulebooks that could disagree; the domain stays the only rulebook.
 */
import { Money, err, ok, type MilliBB, type Result } from '@gto-self/shared';

/** Every way typed text can fail to be an amount at all. Poker rules are not in this list. */
export const AMOUNT_ERRORS = [
  'EMPTY',
  'NOT_A_NUMBER',
  'TOO_MANY_DECIMALS',
  'OUT_OF_RANGE',
] as const;

export type AmountError = (typeof AMOUNT_ERRORS)[number];

/** The same shape `Money.parseBB` accepts: an optional sign, digits, an optional fraction. */
const AMOUNT_INPUT = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/u;

/** 1 milliBB is the smallest amount that exists, so a fourth decimal has no meaning. */
export const MAX_INPUT_DECIMALS = 3;

/** Text in BB (`"2.37"`, `"10"`, `".5"`) to integer milliBB, or a typed reason it is not. */
export function parseAmountBB(input: string): Result<MilliBB, AmountError> {
  const text = input.trim().replace(/,/gu, '');
  if (text === '') return err('EMPTY');
  if (!AMOUNT_INPUT.test(text)) return err('NOT_A_NUMBER');

  const [, fraction = ''] = text.split('.');
  if (fraction.length > MAX_INPUT_DECIMALS) return err('TOO_MANY_DECIMALS');

  const parsed = Money.parseBB(text);
  // Shape and precision are already settled above, so the only rejection `Money.parseBB`
  // has left is its magnitude guard.
  return parsed.ok ? parsed : err('OUT_OF_RANGE');
}

/** Every way typed text can fail to be an out COUNT at all. */
export const OUTS_INPUT_ERRORS = ['EMPTY', 'NOT_A_NUMBER'] as const;

export type OutsInputError = (typeof OUTS_INPUT_ERRORS)[number];

const OUTS_INPUT = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/u;

/**
 * Text to a plain number of outs, or a typed reason it is not a number.
 *
 * Deliberately permissive about the VALUE: `"9.5"` and `"-3"` both parse, and `outsOdds`
 * rejects them as `NON_INTEGER_OUTS` / `NEGATIVE_OUTS`. Half a card and a negative draw are
 * poker facts, and the domain owns poker facts — see the module doc.
 */
export function parseOutsInput(input: string): Result<number, OutsInputError> {
  const text = input.trim();
  if (text === '') return err('EMPTY');
  if (!OUTS_INPUT.test(text)) return err('NOT_A_NUMBER');
  return ok(Number(text));
}
