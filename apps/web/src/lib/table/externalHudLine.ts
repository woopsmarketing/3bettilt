/**
 * A one-line shorthand for the ten external-HUD stats (`ExternalHudEntryFields.tsx`), so a
 * player who has all ten numbers open in another window can paste them in one shot instead
 * of tabbing through ten fields.
 *
 * This is a client-side CONVENIENCE, not a second validating authority: it only ever writes
 * into the same `ExternalHudFormText` the detailed form already owns
 * (`SeatPlayerSwapPanel.tsx` merges the result via the same `setHudText`), and
 * `createExternalHudSnapshot` in `@gto-self/player-core` is still the real gate on the
 * server. A token that parses here but would be refused there (e.g. malformed decimal
 * shapes this parser happens to accept) is still caught downstream — this module's job is
 * only to catch the common typo before the user submits.
 *
 * Positional, not keyed: the ten tokens map onto `EXTERNAL_HUD_STAT_KEYS`' own canonical
 * order, the same order the detailed form renders in, so what the user pastes lines up with
 * what they see below it.
 */
import { EXTERNAL_HUD_STAT_KEYS, type ExternalHudStatKey } from '@gto-self/player-core';
import { EXTERNAL_HUD_STAT_LABEL, quickHudLineCountError, quickHudLineValueError } from './copy.js';
import type { ExternalHudFormText } from '../../components/table/ExternalHudEntryFields.js';

export type ExternalHudLineResult =
  | { readonly ok: true; readonly values: ExternalHudFormText }
  | { readonly ok: false; readonly message: string };

/** Plain non-negative integer or decimal, `.` only, inclusive `[0, 100]`. */
const VALUE_PATTERN = /^\d+(\.\d+)?$/;

function isValidToken(token: string): boolean {
  if (!VALUE_PATTERN.test(token)) return false;
  const value = Number(token);
  return value >= 0 && value <= 100;
}

/**
 * Total, pure. `text` split on runs of whitespace/commas, positionally mapped onto
 * `EXTERNAL_HUD_STAT_KEYS`. `-` means "unknown" and is OMITTED from `values` — never written
 * as `""`/`"0"` — matching `externalHudEntryStats`'s "blank is absent" contract.
 */
export function parseExternalHudLine(text: string): ExternalHudLineResult {
  const tokens = text.split(/[\s,]+/).filter((token) => token !== '');

  const expected = EXTERNAL_HUD_STAT_KEYS.length;
  if (tokens.length !== expected) {
    return { ok: false, message: quickHudLineCountError(expected, tokens.length) };
  }

  const values: Partial<Record<ExternalHudStatKey, string>> = {};
  for (const [index, token] of tokens.entries()) {
    const key = EXTERNAL_HUD_STAT_KEYS[index];
    if (key === undefined) continue; // unreachable: tokens.length === EXTERNAL_HUD_STAT_KEYS.length
    if (token === '-') continue;
    if (!isValidToken(token)) {
      return {
        ok: false,
        message: quickHudLineValueError(index + 1, EXTERNAL_HUD_STAT_LABEL[key], token),
      };
    }
    values[key] = token;
  }

  return { ok: true, values };
}
