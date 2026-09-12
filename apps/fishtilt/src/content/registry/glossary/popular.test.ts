import { describe, expect, it } from 'vitest';
import { ALL_CONTENT } from '../index.js';
import { GLOSSARY_RECORDS } from './index.js';
import { inboundReferenceCounts, mostReferencedTerms } from './popular.js';

describe('most-referenced glossary terms (the hub’s "popular" strip)', () => {
  it('counts exactly the relatedConcepts references other records make', () => {
    const counts = inboundReferenceCounts();
    // Recomputed here independently, the long way.
    for (const term of GLOSSARY_RECORDS) {
      const expected = ALL_CONTENT.filter(
        (record) => record.id !== term.id && record.relatedConcepts.includes(term.id),
      ).length;
      expect(counts.get(term.id), term.slug).toBe(expected);
    }
    // Every glossary id is present, nothing else is.
    expect([...counts.keys()].toSorted()).toEqual(GLOSSARY_RECORDS.map((t) => t.id).toSorted());
  });

  it('returns the requested number, most-referenced first, published only', () => {
    const top = mostReferencedTerms(8);
    expect(top).toHaveLength(8);
    for (let i = 1; i < top.length; i += 1) {
      expect(top[i]!.inbound).toBeLessThanOrEqual(top[i - 1]!.inbound);
    }
    for (const { term } of top) expect(term.status).toBe('PUBLISHED');
  });

  it('the top of the list is genuinely referenced — never a term nothing points at', () => {
    const [first] = mostReferencedTerms(1);
    expect(first?.inbound ?? 0).toBeGreaterThan(0);
  });
});
