/**
 * Query expansion — the search-layer answer to "3벳 · 쓰리벳 · 3bet · three bet are one
 * concept" (Stage 3 contract BG).
 *
 * ## Two sources of equivalence, both read at query time, neither edits a record
 *
 * 1. **The glossary's own `aliases`.** A glossary `SearchRecord` carries `term` + `aliases`
 *    (e.g. `3-Bet` + `3벳 · 쓰리벳 · 쓰리 벳 · 3-bet · 3bet · 삼벳`). If the reader's query
 *    is any one of those spellings, every other spelling — and the record's `concepts` ids —
 *    becomes a variant, so a LESSON whose title says `(3-Bet)` and a BLOG post whose title
 *    says `3벳` are both found by a reader who typed `쓰리벳`. The glossary already knows the
 *    spellings; this module only makes the other kinds benefit from that knowledge.
 * 2. **`SEARCH_ALIAS_GROUPS`** — spellings the glossary records do NOT list but people really
 *    type (`three bet`, `threebet`). These live HERE, in the search layer, never by editing
 *    a glossary record (the brief's rule: the registry belongs to the content WPs; the handoff
 *    reports which record lacks which alias). Each group is a set of equivalent spellings;
 *    at least one member of a group should also be a glossary alias, so the two sources
 *    chain: `three bet` → group → `3bet` → glossary → `3벳 · 쓰리벳 · …`.
 *
 * ## What this deliberately is not
 *
 * Not fuzzy matching, not spelling correction, not romanisation (`normalize.ts` documents
 * those as out of scope). A variant is only ever added through an EXACT (whitespace- and
 * case-insensitive) hit on a known spelling, so a query can never be widened by guesswork —
 * `완전히무관한검색어` still expands to nothing but itself and still finds nothing.
 *
 * Pure: takes the record list as an argument, like `match.ts`, so it is testable against
 * fixtures and never reads a module-scope registry.
 */
import { compact } from './normalize.js';
import type { SearchRecord } from './types.js';

/**
 * Spellings the search layer treats as one query. Ordinary UI-side knowledge about how
 * Korean poker players type — no poker fact lives here, and no group may introduce a
 * spelling the site itself refuses to print (`copy-guards.test.ts` exempts `aliases:` lines
 * in the registry, not this file, so only the site's canonical spellings may appear here;
 * a misspelling a reader might type belongs on a glossary record's `aliases` line).
 */
export const SEARCH_ALIAS_GROUPS: readonly (readonly string[])[] = [
  // 3-bet: the glossary lists 3벳 · 쓰리벳 · 쓰리 벳 · 3-bet · 3bet · 삼벳; the English words are
  // what a reader who learned the term from an English stream types.
  ['3bet', 'three bet', 'threebet', 'three-bet', '3 bet', '3-벳', '쓰리-벳'],
  // 4-bet, same shape.
  ['4bet', 'four bet', 'fourbet', 'four-bet', '4 bet', '4-벳'],
  // Pot odds: Korean readers split or join the loanword either way.
  ['팟 오즈', '팟오즈', 'pot odds', 'potodds'],
  // Outs.
  ['아웃', '아웃츠', 'outs', 'out'],
  // Range.
  ['레인지', 'range', '핸드레인지', '핸드 레인지', 'hand range'],
  // Position.
  ['포지션', 'position', '자리'],
  // Equity.
  ['승률', 'equity', '에퀴티', '이퀴티'],
];

/**
 * Every spelling the matcher should try for `rawQuery`, the query itself first. Each entry
 * is an ORIGINAL spelling (trimmed, not compacted), so a highlighter can show the reader
 * the words that actually matched; `match.ts` compacts them itself. An empty or
 * whitespace-only query expands to `[]`.
 */
export function expandQuery(records: readonly SearchRecord[], rawQuery: string): readonly string[] {
  const seed = compact(rawQuery);
  if (seed === '') return [];

  // Keyed by compact form so `쓰리 벳` and `쓰리벳` are one variant, in insertion order so the
  // reader's own query stays first.
  const variants = new Map<string, string>([[seed, rawQuery.trim()]]);
  const add = (spelling: string): void => {
    const key = compact(spelling);
    if (key === '' || variants.has(key)) return;
    variants.set(key, spelling.trim());
  };
  const known = (spelling: string): boolean => variants.has(compact(spelling));

  const applyGroups = (): void => {
    for (const group of SEARCH_ALIAS_GROUPS) {
      if (group.some(known)) group.forEach(add);
    }
  };

  applyGroups();

  // One glossary hop: any record whose term or alias the reader (or a group) spelled.
  for (const record of records) {
    if (record.term === undefined && record.aliases === undefined) continue;
    const names = [record.term ?? '', ...(record.aliases ?? [])].filter((name) => name !== '');
    if (!names.some(known)) continue;
    names.forEach(add);
    record.concepts.forEach(add);
  }

  // A glossary alias may itself be the head of a group (`3bet` → `three bet`), so the groups
  // get one more pass. Two passes are the closure: a group can only be entered through a
  // spelling, and every spelling is now present.
  applyGroups();

  return [...variants.values()];
}
