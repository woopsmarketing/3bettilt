/**
 * The Range Explorer's shareable-URL contract — `/tools/range?hero=BTN&spot=RFI&stack=100`
 * (build spec, WP-D deliverable 2). Pure string <-> query parsing, no React and no browser
 * global read here (the component decides WHEN to call these against `window.location` /
 * `window.history`), so the shape of the URL is unit-testable without a DOM.
 *
 * Parsing is defensive rather than strict: a stale bookmark, a hand-edited URL, or a future
 * link this app no longer recognises must never throw or crash the page. An unrecognised or
 * missing value for one axis simply falls back to the caller's own default for that axis
 * (`RangeExplorer`'s state initializer) — CLAUDE.md rule 5, no silent-wrong-answer stub, just
 * an honest "I don't know this one, use the default" per field.
 */
import { STRATEGY_POSITIONS, type StrategyPosition } from '@gto-self/strategy-core';
import { RANGE_SPOTS, RANGE_STACK_DEPTHS, type RangeSpot, type RangeStackDepth } from './types.js';
import { routeById } from '../../lib/routes.js';

/** The explorer's own (localised) path, from the registry — the URL this module writes back
 *  with `history.replaceState` must be the URL the page is served at (D-S3-02). */
export const RANGE_EXPLORER_PATH = routeById('range').path;

/** Every axis the URL carries, each optional because a real-world query string may omit or
 *  corrupt any of them independently. */
export interface PartialRangeUrlQuery {
  readonly heroPosition?: StrategyPosition;
  readonly spot?: RangeSpot;
  readonly stackDepth?: RangeStackDepth;
}

const HERO_PARAM = 'hero';
const SPOT_PARAM = 'spot';
const STACK_PARAM = 'stack';

function parseHeroPosition(raw: string | null): StrategyPosition | undefined {
  if (raw === null) return undefined;
  return STRATEGY_POSITIONS.find((position) => position === raw);
}

function parseSpot(raw: string | null): RangeSpot | undefined {
  if (raw === null) return undefined;
  return RANGE_SPOTS.find((spot) => spot === raw);
}

function parseStackDepth(raw: string | null): RangeStackDepth | undefined {
  if (raw === null) return undefined;
  const parsed = Number(raw);
  return RANGE_STACK_DEPTHS.find((depth) => depth === parsed);
}

/**
 * Total. Reads only the three axes the Range Explorer's URL owns; any other query
 * parameter on the page (there are none today) is untouched and not reported here.
 */
export function parseRangeUrlQuery(search: string): PartialRangeUrlQuery {
  const params = new URLSearchParams(search);
  const heroPosition = parseHeroPosition(params.get(HERO_PARAM));
  const spot = parseSpot(params.get(SPOT_PARAM));
  const stackDepth = parseStackDepth(params.get(STACK_PARAM));
  return {
    ...(heroPosition !== undefined ? { heroPosition } : {}),
    ...(spot !== undefined ? { spot } : {}),
    ...(stackDepth !== undefined ? { stackDepth } : {}),
  };
}

/** Total. The full three-axis query, always written together so the URL is always a
 *  complete, shareable snapshot rather than a partial diff of whatever the visitor arrived
 *  with (build spec deliverable 2: "reading the query on load and writing it on filter
 *  change"). */
export interface RangeUrlQuery {
  readonly heroPosition: StrategyPosition;
  readonly spot: RangeSpot;
  readonly stackDepth: RangeStackDepth;
}

/** `{ heroPosition: 'BTN', spot: 'RFI', stackDepth: 100 }` -> `"/tools/range?hero=BTN&spot=RFI&stack=100"`. */
export function buildRangeUrl(query: RangeUrlQuery): string {
  const params = new URLSearchParams();
  params.set(HERO_PARAM, query.heroPosition);
  params.set(SPOT_PARAM, query.spot);
  params.set(STACK_PARAM, String(query.stackDepth));
  return `${RANGE_EXPLORER_PATH}?${params.toString()}`;
}
