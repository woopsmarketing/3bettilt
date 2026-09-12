import { describe, expect, it } from 'vitest';
import { groupResults } from './group.js';
import type { SearchResult } from './types.js';

function result(id: string, kind: SearchResult['record']['kind'], score: number): SearchResult {
  return {
    score,
    record: { id, kind, title: `제목-${id}`, description: '설명', href: `/${id}`, concepts: [] },
  };
}

describe('groupResults', () => {
  it('returns no groups for no results', () => {
    expect(groupResults([])).toEqual([]);
  });

  it('groups by kind and labels each group in Korean', () => {
    const groups = groupResults([
      result('a', 'learn', 300),
      result('b', 'glossary', 300),
      result('c', 'learn', 100),
    ]);
    expect(groups.map((group) => group.kind)).toEqual(['learn', 'glossary']);
    expect(groups[0]?.results.map((entry) => entry.record.id)).toEqual(['a', 'c']);
    expect(groups.map((group) => group.label)).toEqual(['배우기', '용어']);
  });

  it('puts the group holding the overall best match first, whatever its kind', () => {
    // A fixed kind order would put LEARN above the exact glossary hit; the reader's best
    // answer must still be the first thing on the page.
    const groups = groupResults([
      result('term', 'glossary', 300),
      result('lesson', 'learn', 100),
      result('tool', 'tool', 200),
    ]);
    expect(groups.map((group) => group.kind)).toEqual(['glossary', 'tool', 'learn']);
    expect(groups[0]?.bestScore).toBe(300);
  });

  it('breaks a tie between groups on the declared kind order', () => {
    const groups = groupResults([
      result('t', 'tool', 100),
      result('h', 'hands', 100),
      result('l', 'learn', 100),
    ]);
    expect(groups.map((group) => group.kind)).toEqual(['learn', 'hands', 'tool']);
  });

  it('keeps the matcher’s order inside a group — never re-sorts', () => {
    const groups = groupResults([result('x', 'blog', 100), result('y', 'blog', 100)]);
    expect(groups[0]?.results.map((entry) => entry.record.id)).toEqual(['x', 'y']);
  });
});
