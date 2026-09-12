/**
 * The Starting Hand Explorer's shareable-URL contract —
 * `/tools/starting-hand?view=TOP_SHARE&pct=15` — matching `features/range/url.ts`'s
 * approach exactly (same shell, same interaction idiom, per this WP's brief) rather than
 * inventing a second one: pure string <-> query parsing, no React and no browser global read
 * here, and a value this module does not recognise falls back to the caller's own default
 * for that axis instead of throwing. A stale bookmark or a hand-edited URL must never crash
 * the page (CLAUDE.md rule 5 — an honest "I don't know this one, use the default", not a
 * fabricated state).
 */
import { STARTING_HAND_VIEWS, type StartingHandView } from './types.js';
import { MAX_TOP_PERCENT, MIN_TOP_PERCENT } from './viewModel.js';
import { routeById } from '../../lib/routes.js';

/** The explorer's own (localised) path, from the registry (D-S3-02). */
export const STARTING_HAND_PATH = routeById('toolStartingHand').path;

const VIEW_PARAM = 'view';
const PERCENT_PARAM = 'pct';

export interface PartialStartingHandUrlQuery {
  readonly view?: StartingHandView;
  readonly percent?: number;
}

function parseView(raw: string | null): StartingHandView | undefined {
  if (raw === null) return undefined;
  return STARTING_HAND_VIEWS.find((view) => view === raw);
}

/** Only a genuinely legal slider position round-trips; anything else (out of range,
 *  fractional, non-numeric) is reported as absent so the caller keeps its own default
 *  rather than rendering a slider at a position it never actually landed on. */
function parsePercent(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return undefined;
  if (parsed < MIN_TOP_PERCENT || parsed > MAX_TOP_PERCENT) return undefined;
  return parsed;
}

/** Total. Reads only the two axes this page's URL owns. */
export function parseStartingHandUrlQuery(search: string): PartialStartingHandUrlQuery {
  const params = new URLSearchParams(search);
  const view = parseView(params.get(VIEW_PARAM));
  const percent = parsePercent(params.get(PERCENT_PARAM));
  return {
    ...(view !== undefined ? { view } : {}),
    ...(percent !== undefined ? { percent } : {}),
  };
}

export interface StartingHandUrlQuery {
  readonly view: StartingHandView;
  readonly percent: number;
}

/** `{ view: 'TOP_SHARE', percent: 15 }` -> `"/tools/starting-hand?view=TOP_SHARE&pct=15"`.
 *  Always writes both axes together, so the URL is a complete, shareable snapshot rather
 *  than a partial diff of whatever the visitor arrived with. */
export function buildStartingHandUrl(query: StartingHandUrlQuery): string {
  const params = new URLSearchParams();
  params.set(VIEW_PARAM, query.view);
  params.set(PERCENT_PARAM, String(query.percent));
  return `${STARTING_HAND_PATH}?${params.toString()}`;
}
