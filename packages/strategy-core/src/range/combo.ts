/**
 * The 1326 concrete two-card combinations, and their canonical index.
 *
 * INDEXING SCHEME (colexicographic over the unordered pair, `low < high`):
 *
 *     index = high * (high - 1) / 2 + low
 *
 * where `low`/`high` are the two `Card` indices from `@gto-self/shared` (0..51,
 * `rankIndex * 4 + suitIndex`). It is a bijection onto 0..1325: combos are grouped by
 * their higher card, and within a group ordered by the lower card. The scheme was chosen
 * over "rank-major" alternatives because it needs no lookup table to be defined, is stable
 * under any future change to how cards are printed, and round-trips in closed form.
 *
 * Both directions are still table-backed here for O(1) access, but the tables are DERIVED
 * from the formula at module load — the formula is the definition.
 */
import {
  ALL_CARDS,
  CARD_COUNT,
  cardToString,
  err,
  invariant,
  ok,
  parseCards,
  type Card,
  type Result,
} from '@gto-self/shared';

declare const COMBO: unique symbol;
/** An integer in 0..1325 identifying one concrete two-card combination. */
export type ComboIndex = number & { readonly [COMBO]: true };

/** C(52, 2). */
export const COMBO_COUNT = 1326;

/** Total. `high * (high - 1) / 2 + low`, the definition of the index. */
function indexOfOrderedPair(low: number, high: number): number {
  return (high * (high - 1)) / 2 + low;
}

/** `comboIndex * 2` -> low card, `+ 1` -> high card. Derived from the formula. */
const COMBO_CARDS = new Uint8Array(COMBO_COUNT * 2);
/** `low * 52 + high` -> combo index, for either ordering. `-1` where `low === high`. */
const COMBO_INDEX = new Int16Array(CARD_COUNT * CARD_COUNT).fill(-1);

for (let high = 1; high < CARD_COUNT; high += 1) {
  for (let low = 0; low < high; low += 1) {
    const index = indexOfOrderedPair(low, high);
    COMBO_CARDS[index * 2] = low;
    COMBO_CARDS[index * 2 + 1] = high;
    COMBO_INDEX[low * CARD_COUNT + high] = index;
    COMBO_INDEX[high * CARD_COUNT + low] = index;
  }
}

/** Total. True iff `value` is an integer in 0..1325. */
export function isComboIndex(value: unknown): value is ComboIndex {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < COMBO_COUNT;
}

/** Throws. Programmer / corrupt-data guard. */
export function asComboIndex(value: number): ComboIndex {
  invariant(isComboIndex(value), `combo index out of range: ${value}`);
  return value;
}

/**
 * Throws on two identical cards — a duplicate card is a programmer error here; user input
 * is validated at the parse boundary (`parseCombo`) or by the adapter.
 */
export function comboIndexOf(a: Card, b: Card): ComboIndex {
  invariant(a !== b, `a combo needs two distinct cards, got ${cardToString(a)} twice`);
  const found = COMBO_INDEX[a * CARD_COUNT + b] ?? -1;
  invariant(found >= 0, `card index out of range: ${a}, ${b}`);
  return found as ComboIndex;
}

/** Total. The two cards of a combo, ASCENDING by card index (`low`, then `high`). */
export function comboCards(index: ComboIndex): readonly [Card, Card] {
  const low = COMBO_CARDS[index * 2] ?? 0;
  const high = COMBO_CARDS[index * 2 + 1] ?? 0;
  return [low as Card, high as Card];
}

/** Every combo index, ascending. Length 1326. */
export const ALL_COMBOS: readonly ComboIndex[] = Array.from(
  { length: COMBO_COUNT },
  (_, i) => i as ComboIndex,
);

/** Total. `"AsKd"`-style text, higher card index first (matching poker convention). */
export function comboToString(index: ComboIndex): string {
  const [low, high] = comboCards(index);
  return `${cardToString(high)}${cardToString(low)}`;
}

/** Result. Parses `"AsKd"` / `"As Kd"` into a combo index. Rejects anything but two cards. */
export function parseCombo(text: string): Result<ComboIndex, string> {
  const parsed = parseCards(text);
  if (!parsed.ok) return parsed;
  const [a, b] = parsed.value;
  if (parsed.value.length !== 2 || a === undefined || b === undefined) {
    return err(`"${text}" is not exactly two cards`);
  }
  return ok(comboIndexOf(a, b));
}

/** Total. True iff `card` is one of the combo's two cards. */
export function comboContainsCard(index: ComboIndex, card: Card): boolean {
  const [low, high] = comboCards(index);
  return low === card || high === card;
}

/** Total. Every combo containing `card` (51 of them), ascending by index. */
export function combosContainingCard(card: Card): readonly ComboIndex[] {
  const out: ComboIndex[] = [];
  for (const other of ALL_CARDS) {
    if (other === card) continue;
    out.push(comboIndexOf(card, other));
  }
  return out.sort((a, b) => a - b);
}
