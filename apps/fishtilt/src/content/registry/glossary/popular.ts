/**
 * "Popular" terms for the glossary hub — WITHOUT traffic data.
 *
 * 3BetTilt has no analytics and invents no numbers, so the hub cannot say which terms are
 * searched most. What it CAN say truthfully is which terms the rest of the site leans on
 * most: every lesson, article and hand page declares the glossary ids it uses in
 * `relatedConcepts`, and counting those inbound references is a fact about the content
 * graph, computed at build from the same records the pages render. The hub labels the
 * list accordingly ("가장 많이 연결된 용어"), never "인기 용어".
 *
 * Ties are broken by headword collation so the order is stable across builds.
 */
import type { GlossaryRecord } from '../../types.js';
import { ALL_CONTENT } from '../index.js';
import { GLOSSARY_RECORDS } from './index.js';
import { headwordOf } from './categories.js';
import { compareHeadwords } from './initials.js';

/** How many glossary references each term receives from OTHER records (a term's own
 *  `relatedConcepts` count towards the terms it names, not towards itself). */
export function inboundReferenceCounts(): ReadonlyMap<string, number> {
  const counts = new Map<string, number>(GLOSSARY_RECORDS.map((term) => [term.id, 0]));
  for (const record of ALL_CONTENT) {
    for (const id of record.relatedConcepts) {
      if (id === record.id) continue;
      const current = counts.get(id);
      if (current !== undefined) counts.set(id, current + 1);
    }
  }
  return counts;
}

export interface PopularTerm {
  readonly term: GlossaryRecord;
  /** Inbound `relatedConcepts` references from other records. */
  readonly inbound: number;
}

/** The `limit` most-referenced PUBLISHED terms, most-referenced first. */
export function mostReferencedTerms(limit: number): readonly PopularTerm[] {
  const counts = inboundReferenceCounts();
  return GLOSSARY_RECORDS.filter((term) => term.status === 'PUBLISHED')
    .map((term) => ({ term, inbound: counts.get(term.id) ?? 0 }))
    .sort(
      (a, b) => b.inbound - a.inbound || compareHeadwords(headwordOf(a.term), headwordOf(b.term)),
    )
    .slice(0, limit);
}
