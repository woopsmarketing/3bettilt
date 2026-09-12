/**
 * The glossary hub's view model (WP-S3-11). Pure: turns the registry into the rows the
 * hub renders, with every destination already resolved, so the index, the category map,
 * the search attributes and the `DefinedTermSet` all read ONE list — the structured data
 * cannot enumerate a term the page does not show, or link one the page renders as 준비 중.
 */
import { hrefOfContent } from '../../content/graph.js';
import {
  categoryOfTermOrNull,
  GLOSSARY_CATEGORIES,
  GLOSSARY_HUB_ANCHORS,
  headwordOf,
  otherNamesOf,
  sortByHeadword,
  type GlossaryCategory,
} from '../../content/registry/glossary/categories.js';
import {
  GLOSSARY_INITIALS,
  INITIAL_ANCHOR,
  initialOf,
  type GlossaryInitial,
} from '../../content/registry/glossary/initials.js';
import type { GlossaryRecord } from '../../content/types.js';

export interface GlossaryHubEntry {
  readonly record: GlossaryRecord;
  /** `null` = 준비 중 (visible text, no anchor). */
  readonly href: string | null;
  readonly headword: string;
  /** The Latin `term` first, then every other alias — "3-Bet · 3벳 · 쓰리 벳 · 3bet". */
  readonly otherNames: readonly string[];
  /** The subset of `otherNames` written in Latin letters — what the dense row prints. */
  readonly latinNames: readonly string[];
  readonly initial: GlossaryInitial;
  readonly category: GlossaryCategory | null;
  /** Lower-cased, space-stripped names for the client-side filter (`data-search`). */
  readonly searchKey: string;
}

export interface InitialGroup {
  readonly initial: GlossaryInitial;
  readonly anchor: string;
  readonly entries: readonly GlossaryHubEntry[];
}

export interface CategoryGroup {
  readonly category: GlossaryCategory;
  readonly anchor: string;
  readonly entries: readonly GlossaryHubEntry[];
}

const LATIN = /^[\x20-\x7e–]+$/u;

/** `"쓰리 벳"` → `"쓰리벳"`, `"3-Bet"` → `"3-bet"`: what a reader types, minus the things they
 *  will not type consistently (case, spaces). Same idea as `features/search/normalize.ts`,
 *  kept local because this filter matches names only, never prose. */
export function searchNormalize(text: string): string {
  return text.toLowerCase().replace(/\s+/gu, '');
}

export function hubEntryOf(record: GlossaryRecord): GlossaryHubEntry {
  const headword = headwordOf(record);
  const otherNames = otherNamesOf(record);
  const names = [headword, ...otherNames, record.title];
  return {
    record,
    href: hrefOfContent(record),
    headword,
    otherNames,
    latinNames: otherNames.filter((name) => LATIN.test(name)),
    initial: initialOf(headword),
    category: categoryOfTermOrNull(record),
    searchKey: [...new Set(names.map(searchNormalize))].join('|'),
  };
}

/** Every term, in dictionary order (ㄱ … ㅎ, then A–Z; Korean collation inside a tab). */
export function hubEntries(records: readonly GlossaryRecord[]): readonly GlossaryHubEntry[] {
  return sortByHeadword(records).map(hubEntryOf);
}

/** The dictionary tabs, EVERY tab present (an empty one renders as an inert label so the
 *  ㄱㄴㄷ strip is the same shape whatever the inventory). */
export function initialGroups(entries: readonly GlossaryHubEntry[]): readonly InitialGroup[] {
  return GLOSSARY_INITIALS.map((initial) => ({
    initial,
    anchor: GLOSSARY_HUB_ANCHORS.initial(INITIAL_ANCHOR[initial]),
    entries: entries.filter((entry) => entry.initial === initial),
  }));
}

/** The six categories in their declared order; an entry with no category joins none. */
export function categoryGroups(entries: readonly GlossaryHubEntry[]): readonly CategoryGroup[] {
  return GLOSSARY_CATEGORIES.map((category) => ({
    category,
    anchor: GLOSSARY_HUB_ANCHORS.category(category.id),
    entries: entries.filter((entry) => entry.category?.id === category.id),
  }));
}
