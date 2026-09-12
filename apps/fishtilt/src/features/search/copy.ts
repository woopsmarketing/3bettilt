/**
 * Korean copy + the kind-grouping order for search results. Same discipline
 * `features/range/copy.ts` documents: every label derived from a closed union is an
 * exhaustive map, so a future kind is a compile error here rather than a silently blank
 * group heading.
 */
import { KIND_LABEL } from '../../content/graph.js';
import type { SearchKind } from './types.js';

/** `KIND_LABEL` (`content/graph.ts`) has no entry for `'tool'` — a tool is not a
 *  `ContentKind`, it is a route. This is the one label this feature adds on top of it. */
const TOOL_KIND_LABEL = '도구';

/** The Korean group heading for a result kind. Delegates to `KIND_LABEL` for every real
 *  content kind so this file is never a second place those four strings could drift from
 *  `content/graph.ts`'s. */
export function searchKindLabel(kind: SearchKind): string {
  return kind === 'tool' ? TOOL_KIND_LABEL : KIND_LABEL[kind];
}

/** Display order for grouped results — content kinds in the same order `CONTENT_KINDS`
 *  declares them, tools last (they are the least "read this" and most "go do this" of the
 *  five groups). */
export const SEARCH_KIND_ORDER: readonly SearchKind[] = [
  'learn',
  'blog',
  'glossary',
  'hands',
  'tool',
];

/** The route ids of the section hubs the empty state points at, in the same order. Every id
 *  here must resolve through `routeById` — `SearchClient.tsx` throws rather than rendering a
 *  broken suggestion if one ever does not (CLAUDE.md rule 5). */
export const SEARCH_HUB_ROUTE_IDS: readonly string[] = [
  'learn',
  'tools',
  'glossary',
  'blog',
  'hands',
];

/**
 * Example queries the empty state offers as one-tap starts (Stage 3 contract BG "good empty
 * state with suggestions"). These are QUERIES a beginner plausibly types, not claims about
 * what is popular — the site has no analytics to rank searches by, so they are chosen to
 * show the three shapes the box accepts: a Korean term, a hand key, a tool name.
 */
export const SEARCH_SUGGESTED_QUERIES: readonly string[] = [
  '팟 오즈',
  '3벳',
  'AKs',
  '포지션',
  '아웃',
  '족보',
];

/** Tips shown beside the empty state — facts about how `normalize.ts`/`aliases.ts` match. */
export const SEARCH_TIPS: readonly string[] = [
  '띄어쓰기는 달라도 됩니다. 팟오즈와 팟 오즈는 같은 결과를 냅니다.',
  '한글·영문 표기를 함께 찾습니다. 3벳, 쓰리벳, 3bet, three bet은 같은 용어입니다.',
  '시작 패는 AKs, QQ처럼 적으면 핸드 페이지가 바로 나옵니다.',
];
