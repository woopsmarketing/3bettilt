/**
 * The homepage's data reads, in one place and without JSX.
 *
 * Nothing here is typed by hand: every title, count, destination and number is read from
 * the content graph (`src/content/graph.ts`), the route registry (`src/lib/routes.ts`), the
 * learn categories module, the tools hub model, or computed by `learn-core` /
 * `strategy-core` at render time. The homepage is the page most exposed to going stale,
 * and the only version of it that stays true is the one that derives what it says from the
 * same data every other page reads.
 *
 * Every destination is resolved HERE to `string | null`: `hrefOfContent` returns `null` for
 * a `PLANNED` record and `routeHref` returns `null` for a route the registry says is not
 * built. No home component constructs a path, so no home component can produce a dead link.
 */
import { exactHeadsUpEquity, type ExactEquity } from '@gto-self/learn-core';
import { parseCards, type Card } from '@gto-self/shared';
import { bestFiveOf, type HandValue } from '@gto-self/strategy-core';
import {
  blogOfType,
  glossaryById,
  hrefOfContent,
  PUBLISHED_LESSONS,
  publishedStories,
} from '../../content/graph.js';
import type { BlogRecord, GlossaryRecord, HandStoryRecord } from '../../content/types.js';
import { handReading } from '../../features/tools/handRank.js';
import { toolHubEntries, type ToolHubEntry } from '../../features/tools/index.js';
import { routeById } from '../../lib/routes.js';

/** The product line. One `<h1>` on the page, and this is it. */
export const HOME_HEADLINE = '홀덤, 외우지 말고 이해하면서 배우세요.';

/** A route's path, or `null` when the registry says the page is not built yet. */
export function routeHref(id: string): string | null {
  const route = routeById(id);
  return route.available ? route.path : null;
}

/** The first readable lesson's own page, else the learn hub — the primary CTA's target. */
export function startHref(): string | null {
  const first = PUBLISHED_LESSONS[0];
  return first !== undefined ? hrefOfContent(first) : routeHref('learn');
}

/* ---------------------------------------------------------------------------- hero visual */

/**
 * The five cards the hero draws: the exact faces `A♠ K♠ Q♠ J♠ 10♠` (contract Z — card
 * faces are code, never a raster). What those five cards MAKE is not typed here: the
 * evaluator says so, and the visual's accessible name is that reading.
 */
export const HERO_CARDS_TEXT = 'As Ks Qs Js Ts';

export interface HeroHand {
  readonly cards: readonly Card[];
  readonly value: HandValue;
  /** `handReading(value)` — e.g. the evaluator's own name for the hand. */
  readonly reading: string;
}

let heroHandMemo: HeroHand | null = null;

export function heroHand(): HeroHand {
  if (heroHandMemo !== null) return heroHandMemo;
  const parsed = parseCards(HERO_CARDS_TEXT);
  if (!parsed.ok) throw new Error(`hero cards "${HERO_CARDS_TEXT}": ${parsed.error}`);
  const best = bestFiveOf(parsed.value);
  heroHandMemo = { cards: parsed.value, value: best.value, reading: handReading(best.value) };
  return heroHandMemo;
}

/* ---------------------------------------------------------------------------- featured tool */

/**
 * The tool the homepage features. The tools hub features the Range Explorer
 * (`FEATURED_TOOL_ID`), and the home already DEMONSTRATES that tool live one band above
 * (`HomeRangePreview`), so featuring it again would introduce the same page twice in a row
 * — the exact duplication WP-3 removed. The equity calculator is the next thing a beginner
 * asks for ("이 두 패가 맞붙으면?"), and its example can be computed on the spot.
 */
export const HOME_FEATURED_TOOL_ID = 'toolEquity';

/** The worked example under the featured tool: two named hands, preflop, exact equity. */
export const HOME_EQUITY_EXAMPLE = { hero: 'As Ks', villain: 'Qh Qd' } as const;

export interface EquityExample {
  readonly heroCards: readonly Card[];
  readonly villainCards: readonly Card[];
  readonly result: ExactEquity;
}

let equityMemo: EquityExample | null = null;

/** Computed once per process (~0.3 s of enumeration), never typed. */
export function homeEquityExample(): EquityExample {
  if (equityMemo !== null) return equityMemo;
  const hero = parseCards(HOME_EQUITY_EXAMPLE.hero);
  const villain = parseCards(HOME_EQUITY_EXAMPLE.villain);
  if (!hero.ok || !villain.ok) throw new Error('home equity example: cards do not parse');
  const outcome = exactHeadsUpEquity(hero.value, villain.value, []);
  if (!outcome.ok) throw new Error(`home equity example: ${outcome.error}`);
  equityMemo = { heroCards: hero.value, villainCards: villain.value, result: outcome.value };
  return equityMemo;
}

export interface FeaturedTools {
  readonly featured: ToolHubEntry;
  readonly secondary: readonly ToolHubEntry[];
}

export function homeFeaturedTools(): FeaturedTools {
  const entries = toolHubEntries();
  const featured = entries.find((entry) => entry.route.id === HOME_FEATURED_TOOL_ID);
  if (featured === undefined) {
    throw new Error(`home featured tool "${HOME_FEATURED_TOOL_ID}" is not a tools route`);
  }
  return { featured, secondary: entries.filter((entry) => entry !== featured) };
}

/* ----------------------------------------------------------------------------- stories */

export interface HomeStoriesModel {
  readonly featured: HandStoryRecord | null;
  readonly secondary: readonly HandStoryRecord[];
}

/** The first published story leads; the rest follow. Zero stories → `featured: null`. */
export function homeStories(
  stories: readonly HandStoryRecord[] = publishedStories(),
): HomeStoriesModel {
  const [featured = null, ...secondary] = stories;
  return { featured, secondary };
}

/* ------------------------------------------------------------------------ search guides */

export function homeSearchGuides(): readonly BlogRecord[] {
  return blogOfType('search-guide').filter((record) => record.status === 'PUBLISHED');
}

/* ----------------------------------------------------------------------------- glossary */

/**
 * The glossary terms the front page shows, chosen rather than sliced.
 *
 * `glossaryPublished.slice(0, n)` is not an editorial decision — it is the order the batch
 * files happen to be in, and it moves whenever a term is inserted. The criterion here is
 * "a word you need to follow ONE hand being played", independent of registry order. A pick
 * that is not published is skipped rather than rendered dead; `page.test.tsx` fails if a
 * pick stops resolving.
 */
export const HOME_GLOSSARY_PICKS: readonly string[] = [
  'term-pot',
  'term-blind',
  'term-flop',
  'term-check',
  'term-call',
  'term-raise',
  'term-fold',
  'term-all-in',
  'term-position',
  'term-button',
  'term-range',
  'term-showdown',
];

export function homeGlossaryPicks(): readonly GlossaryRecord[] {
  return HOME_GLOSSARY_PICKS.flatMap((id) => {
    const entry = glossaryById(id);
    return entry !== undefined && entry.status === 'PUBLISHED' ? [entry] : [];
  });
}
