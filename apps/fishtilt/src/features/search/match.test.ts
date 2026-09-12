import { describe, expect, it } from 'vitest';
import { matchQuery } from './match.js';
import type { SearchRecord } from './types.js';

/*
 * Every fixture below is constructed in this file, never read out of the real registry
 * (`docs/FISHTILT_STATE.md` ruling 26) — content batches ship concurrently with this WP, so
 * an assertion like "searching X returns N results against the real index" would be
 * accidental today and false tomorrow. `buildIndex.test.ts` and the real-`SEARCH_INDEX`
 * invariant tests cover the live data; this file only proves the matcher's own rules.
 */

const POT_ODDS_TOOL: SearchRecord = {
  id: 'tool:toolPotOdds',
  kind: 'tool',
  title: '팟 오즈 계산기',
  description: '콜하려면 몇 퍼센트를 이겨야 본전인지 계산합니다.',
  href: '/tools/pot-odds',
  concepts: [],
};

const OUTS_TOOL: SearchRecord = {
  id: 'tool:toolOuts',
  kind: 'tool',
  title: '아웃 계산기',
  description: '드로우가 완성될 확률을 계산합니다.',
  href: '/tools/outs',
  concepts: [],
};

const RANGE_TERM: SearchRecord = {
  id: 'term-range',
  kind: 'glossary',
  title: '패의 묶음 (Range)',
  description: '레인지는 상대가 들고 있을 수 있는 패 전체를 뜻합니다.',
  href: '/glossary/range',
  concepts: ['range'],
  term: 'Range',
  aliases: ['레인지', '핸드레인지', '패의 범위'],
  shortDefinition: '한 사람이 들고 있을 수 있는 시작 패 전부를 묶어 부르는 말입니다.',
};

const AKS_HAND: SearchRecord = {
  id: 'hand-aks',
  kind: 'hands',
  title: '같은 무늬의 A와 K · AKs',
  description: 'A와 K를 같은 무늬로 받은 경우를 확인합니다.',
  href: '/hands/aks',
  concepts: ['suited', 'starting-hand'],
  handKey: 'AKs',
};

const BLINDS_LESSON: SearchRecord = {
  id: 'lesson-blinds',
  kind: 'learn',
  title: '블라인드란 무엇인가요',
  description: '포지션과 강제 배팅에 대해 알아봅니다.',
  href: '/learn/blinds',
  concepts: ['blinds', 'position'],
};

const ALL_FIXTURES = [POT_ODDS_TOOL, OUTS_TOOL, RANGE_TERM, AKS_HAND, BLINDS_LESSON];

describe('matchQuery — Korean spacing', () => {
  it('finds the pot-odds tool with a space in the query', () => {
    const results = matchQuery(ALL_FIXTURES, '팟 오즈');
    expect(results[0]?.record.id).toBe('tool:toolPotOdds');
  });

  it('finds the same tool with no space in the query', () => {
    const results = matchQuery(ALL_FIXTURES, '팟오즈');
    expect(results[0]?.record.id).toBe('tool:toolPotOdds');
  });

  it('finds it when the query has different spacing than the title', () => {
    // Title is "팟 오즈 계산기"; query below is unspaced except a mid-word split.
    const results = matchQuery(ALL_FIXTURES, '팟오즈 계산기');
    expect(results[0]?.record.id).toBe('tool:toolPotOdds');
  });
});

describe('matchQuery — glossary aliases', () => {
  it('finds the Range term by its Korean alias, not just its Latin term', () => {
    const results = matchQuery(ALL_FIXTURES, '레인지');
    expect(results[0]?.record.id).toBe('term-range');
  });

  it('finds it by a multi-word alias regardless of spacing', () => {
    const results = matchQuery(ALL_FIXTURES, '핸드레인지');
    expect(results[0]?.record.id).toBe('term-range');
  });
});

describe('matchQuery — hand notation', () => {
  it('finds a hand page by its handKey', () => {
    const results = matchQuery(ALL_FIXTURES, 'AKs');
    expect(results[0]?.record.id).toBe('hand-aks');
  });

  it('is case-insensitive on handKey', () => {
    expect(matchQuery(ALL_FIXTURES, 'aks')[0]?.record.id).toBe('hand-aks');
    expect(matchQuery(ALL_FIXTURES, 'AKS')[0]?.record.id).toBe('hand-aks');
  });
});

describe('matchQuery — ranking tiers', () => {
  it('ranks an exact title match above a description-only match for the same query', () => {
    const titleHit: SearchRecord = {
      id: 'fixture-title-hit',
      kind: 'blog',
      title: '아웃 계산기',
      description: '이 글은 다른 이야기를 합니다.',
      href: '/blog/title-hit',
      concepts: [],
    };
    const descriptionOnlyHit: SearchRecord = {
      id: 'fixture-description-only-hit',
      kind: 'blog',
      title: '완전히 다른 제목',
      description: '드로우가 완성되기까지 아웃 계산기를 직접 써 봅니다.',
      href: '/blog/description-only-hit',
      concepts: [],
    };
    const results = matchQuery([descriptionOnlyHit, titleHit], '아웃 계산기');
    expect(results[0]?.record.id).toBe('fixture-title-hit');
    expect(results[1]?.record.id).toBe('fixture-description-only-hit');
  });

  it('ranks a title/term/alias hit above a hit that only appears in the description', () => {
    // "포지션" appears in BLINDS_LESSON's description and its concepts, never its title.
    // Add a record whose TITLE contains it, and confirm that one sorts first.
    const positionTitled: SearchRecord = {
      id: 'term-position',
      kind: 'glossary',
      title: '자리 (Position)',
      description: '앉은 자리에 따라 전략이 달라집니다.',
      href: '/glossary/position',
      concepts: ['position'],
      term: 'Position',
      aliases: ['포지션'],
      shortDefinition: '테이블에서 앉은 자리를 뜻합니다.',
    };
    const results = matchQuery([BLINDS_LESSON, positionTitled], '포지션');
    expect(results[0]?.record.id).toBe('term-position');
    expect(results[1]?.record.id).toBe('lesson-blinds');
  });

  it('ranks a description hit above a concept-only hit', () => {
    // "starting-hand" only ever appears in AKS_HAND's concepts. RANGE_TERM's description
    // mentions "레인지" directly, so give both fixtures a shared token to compare tiers on
    // by searching for something present in one record's description and another's
    // concepts only.
    const conceptOnly: SearchRecord = {
      id: 'fixture-concept-only',
      kind: 'blog',
      title: '완전히 다른 제목',
      description: '이 설명에는 그 단어가 없습니다.',
      href: '/blog/unrelated',
      concepts: ['tag-word'],
    };
    const descriptionHit: SearchRecord = {
      id: 'fixture-description-hit',
      kind: 'blog',
      title: '역시 다른 제목',
      description: '설명 안에 tag-word 라는 표현이 등장합니다.',
      href: '/blog/other',
      concepts: [],
    };
    const results = matchQuery([conceptOnly, descriptionHit], 'tag-word');
    expect(results[0]?.record.id).toBe('fixture-description-hit');
    expect(results[1]?.record.id).toBe('fixture-concept-only');
  });
});

describe('matchQuery — honest empty results', () => {
  it('returns nothing for an empty query', () => {
    expect(matchQuery(ALL_FIXTURES, '')).toEqual([]);
  });

  it('returns nothing for a whitespace-only query', () => {
    expect(matchQuery(ALL_FIXTURES, '   ')).toEqual([]);
  });

  it('returns nothing when no field matches — never a broadened fallback', () => {
    expect(matchQuery(ALL_FIXTURES, '완전히 무관한 검색어 xyz')).toEqual([]);
  });
});

describe('matchQuery — an unfinished record can never be a fixture that gets returned', () => {
  it('only ever returns records the caller supplied — proves no hidden module-scope data', () => {
    const results = matchQuery([POT_ODDS_TOOL], '팟오즈');
    expect(results).toHaveLength(1);
    expect(results[0]?.record).toBe(POT_ODDS_TOOL);
  });
});
