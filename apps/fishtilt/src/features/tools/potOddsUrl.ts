/**
 * The pot-odds calculator's shareable-URL contract — `/tools/pot-odds?pot=9&bet=6`.
 *
 * ## Why this module exists
 *
 * The site already publishes these links. `content/blog/pot-odds-quick.mdx` walks a 9BB pot
 * facing a 6BB bet and closes with a `ToolCTA` carrying `params={{ pot: '9', bet: '6' }}`;
 * the calculator ignored the query entirely and opened on its own 10/5 default, so the
 * article promised a worked example and the tool showed a different one. The Range Explorer's
 * `?hero=&spot=&stack=` links do work (`features/range/url.ts`), so four of the six `params`
 * CTAs on the site landed correctly and two silently did not, with nothing to tell a reader
 * which kind they had followed.
 *
 * ## Same shape as `features/range/url.ts`, deliberately
 *
 * Pure string parsing, no React and no browser global read — the component decides WHEN to
 * call this against `window.location`, so the URL contract is unit-testable without a DOM,
 * and the read happens after mount rather than in a `useState` initializer (reading
 * `window.location` during the first render would diverge from the server's markup).
 *
 * Parsing is defensive per field, again like the range URL: a stale bookmark, a hand-edited
 * link or a truncated share must never throw. An absent, malformed, or out-of-range value
 * for one axis simply falls back to the caller's own default for that axis.
 *
 * ## Money still stops being a float at exactly one place
 *
 * A query parameter is text a person typed, so it goes through `parseAmountBB` — the app's
 * single parse boundary, which delegates the magnitude guard to `Money.parseBB` (CLAUDE.md
 * rule 1). What comes back out is the amount re-rendered by `formatAmountValue`, i.e. the
 * exact milliBB the calculator will use, written the way the input field writes it: `?pot=9`
 * seeds `"9"`, `?pot=9.0` seeds `"9"`, and `?pot=1.6667` (a fourth decimal, which is smaller
 * than a milliBB) is rejected and leaves the default in place. The reader is never shown a
 * number the calculator silently rounded behind them.
 *
 * ## What is NOT rejected here
 *
 * A negative pot, or a bet of zero. Those are POKER questions, and `potOdds` already answers
 * them with typed errors that the calculator renders in Korean — exactly as it does when the
 * same value is typed into the field by hand. Re-deciding them here would give the app two
 * rulebooks (`features/tools/amount.ts`'s module doc makes the same argument at length).
 */
import { parseAmountBB } from './amount.js';
import { formatAmountValue } from './format.js';
import { routeById } from '../../lib/routes.js';

/** The calculator's own (localised) path, from the registry (D-S3-02). */
export const POT_ODDS_PATH = routeById('toolPotOdds').path;

const POT_PARAM = 'pot';
const BET_PARAM = 'bet';

/** Each axis optional: a real-world query string may omit or corrupt either independently. */
export interface PartialPotOddsUrlQuery {
  /** The pot before the bet, in BB, already normalised to the field's own text form. */
  readonly potBB?: string;
  /** The bet being faced, in BB, likewise normalised. */
  readonly betBB?: string;
}

/** `"9"` -> `"9"`, `"9.0"` -> `"9"`, `"abc"` / `"1.6667"` / an over-large value -> `undefined`. */
function parseAmountParam(raw: string | null): string | undefined {
  if (raw === null) return undefined;
  const parsed = parseAmountBB(raw);
  return parsed.ok ? formatAmountValue(parsed.value) : undefined;
}

/**
 * Total. Reads only the two axes this calculator's URL owns; any other query parameter on
 * the page is untouched and not reported here.
 */
export function parsePotOddsUrlQuery(search: string): PartialPotOddsUrlQuery {
  const params = new URLSearchParams(search);
  const potBB = parseAmountParam(params.get(POT_PARAM));
  const betBB = parseAmountParam(params.get(BET_PARAM));
  return {
    ...(potBB !== undefined ? { potBB } : {}),
    ...(betBB !== undefined ? { betBB } : {}),
  };
}
