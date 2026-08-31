/**
 * Flat integer views of `../range/combo.ts`, built once at module load.
 *
 * The hot loops in this directory look up a combo's two cards tens of millions of times.
 * `comboCards()` allocates a tuple on every call, which is free in ordinary code and very
 * much not free inside a 2M-iteration enumeration. These arrays are DERIVED from
 * `comboCards` — the combo module stays the definition, this is only an index.
 */
import { comboCards, COMBO_COUNT, type ComboIndex } from '../range/combo.js';

/** `COMBO_LOW[c]` — the lower card index of combo `c`. */
export const COMBO_LOW = new Int32Array(COMBO_COUNT);
/** `COMBO_HIGH[c]` — the higher card index of combo `c`. */
export const COMBO_HIGH = new Int32Array(COMBO_COUNT);

for (let combo = 0; combo < COMBO_COUNT; combo += 1) {
  const [low, high] = comboCards(combo as ComboIndex);
  COMBO_LOW[combo] = low;
  COMBO_HIGH[combo] = high;
}
