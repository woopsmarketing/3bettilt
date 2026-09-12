import { describe, expect, it } from 'vitest';
import { expandQuery, SEARCH_ALIAS_GROUPS } from './aliases.js';
import { matchQuery } from './match.js';
import { compact } from './normalize.js';
import type { SearchRecord } from './types.js';

/*
 * Fixtures constructed here, never read out of the real registry (ruling 26). The 3-bet
 * glossary entry's alias list is copied as a FIXTURE so this file proves the mechanism; the
 * real record may grow more aliases without touching this test.
 */
const THREE_BET_TERM: SearchRecord = {
  id: 'term-three-bet',
  kind: 'glossary',
  title: '다시 거는 세 번째 레이즈 (3-Bet)',
  description: '3-Bet이라는 이름이 어떻게 붙었는지, 세는 방법을 설명합니다.',
  href: '/glossary/three-bet',
  concepts: ['three-bet', 'bet-counting'],
  term: '3-Bet',
  aliases: ['3벳', '쓰리벳', '쓰리 벳', '3-bet', '3bet', '삼벳'],
  shortDefinition: '오픈 레이즈에 다시 레이즈하는 것을 말합니다.',
};

const THREE_BET_LESSON: SearchRecord = {
  id: 'three-bet',
  kind: 'learn',
  title: '상대의 레이즈에 다시 레이즈 (3-Bet)',
  description: '왜 다시 레이즈하는지, 어떤 패로 하는지 배웁니다.',
  href: '/learn/three-bet',
  concepts: ['three-bet', 'range', 'preflop'],
};

const THREE_BET_BLOG: SearchRecord = {
  id: 'blog-why-called-3bet',
  kind: 'blog',
  title: "3벳(3-Bet)은 왜 '3'일까? 벳을 세는 규칙과 4벳·5벳",
  description: '벳을 세는 규칙을 설명합니다.',
  href: '/blog/why-called-3bet',
  concepts: ['bet-counting'],
};

const UNRELATED: SearchRecord = {
  id: 'lesson-outs',
  kind: 'learn',
  title: '아웃 세기',
  description: '남은 카드 중 나를 이기게 해주는 카드를 셉니다.',
  href: '/learn/outs',
  concepts: ['outs'],
};

const RECORDS = [THREE_BET_TERM, THREE_BET_LESSON, THREE_BET_BLOG, UNRELATED];

describe('expandQuery', () => {
  it('returns nothing for an empty query', () => {
    expect(expandQuery(RECORDS, '')).toEqual([]);
    expect(expandQuery(RECORDS, '   ')).toEqual([]);
  });

  it('keeps the reader’s own query first', () => {
    expect(expandQuery(RECORDS, '쓰리벳')[0]).toBe('쓰리벳');
  });

  it('expands a glossary alias into every other alias, the term and the concept ids', () => {
    const variants = expandQuery(RECORDS, '쓰리벳').map(compact);
    for (const spelling of ['3벳', '3-bet', '3bet', '삼벳', 'three-bet', 'bet-counting']) {
      expect(variants, spelling).toContain(compact(spelling));
    }
  });

  it('chains a search-layer group into the glossary: "three bet" reaches 3벳', () => {
    const variants = expandQuery(RECORDS, 'three bet').map(compact);
    expect(variants).toContain(compact('3bet'));
    expect(variants).toContain(compact('3벳'));
    expect(variants).toContain(compact('쓰리벳'));
  });

  it('never widens a query that hits nothing known', () => {
    expect(expandQuery(RECORDS, '완전히무관한검색어xyz')).toEqual(['완전히무관한검색어xyz']);
  });

  it('is whitespace-insensitive when recognising a spelling', () => {
    const spaced = expandQuery(RECORDS, '쓰리 벳').map(compact);
    const joined = expandQuery(RECORDS, '쓰리벳').map(compact);
    expect(new Set(spaced)).toEqual(new Set(joined));
  });
});

describe('SEARCH_ALIAS_GROUPS', () => {
  it('has at least two spellings per group, none blank', () => {
    for (const group of SEARCH_ALIAS_GROUPS) {
      expect(group.length).toBeGreaterThanOrEqual(2);
      for (const spelling of group) expect(compact(spelling)).not.toBe('');
    }
  });

  it('never carries a spelling the site itself refuses to print', () => {
    // `copy-guards.test.ts` exempts only `aliases:` lines in the registry; this file is the
    // site's own vocabulary and must use the canonical spellings.
    for (const group of SEARCH_ALIAS_GROUPS) {
      for (const spelling of group) {
        expect(spelling).not.toMatch(/플롭|배팅|오프슈트|수트드|것샷/u);
      }
    }
  });
});

describe('matchQuery with aliases', () => {
  it.each(['3벳', '쓰리벳', '3bet', 'three bet', '3-bet'])(
    'finds the glossary term, the lesson and the article for %s',
    (query) => {
      const ids = matchQuery(RECORDS, query).map((result) => result.record.id);
      expect(ids).toContain('term-three-bet');
      expect(ids).toContain('three-bet');
      expect(ids).toContain('blog-why-called-3bet');
      expect(ids).not.toContain('lesson-outs');
    },
  );

  it('still puts the exact glossary hit first', () => {
    expect(matchQuery(RECORDS, '쓰리벳')[0]?.record.id).toBe('term-three-bet');
  });
});
