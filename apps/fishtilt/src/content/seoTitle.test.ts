/**
 * `seoTitleOf`'s per-kind defaults and `glossarySeoTerm`'s headword derivation. The
 * site-wide properties (unique, branded, Korean, not stuffed) are checked over every sitemap
 * page in `lib/seo/seoTitleCoverage.test.tsx`; this file pins the templates themselves.
 */
import { describe, expect, it } from 'vitest';
import { glossarySeoTerm, seoTitleOf } from './graph.js';
import { ALL_CONTENT } from './registry/index.js';
import type { GlossaryRecord, HandRecord } from './types.js';

const glossary = (slug: string): GlossaryRecord => {
  const record = ALL_CONTENT.find((r) => r.kind === 'glossary' && r.slug === slug);
  if (record?.kind !== 'glossary') throw new Error(`no glossary record ${slug}`);
  return record;
};

describe('glossarySeoTerm', () => {
  it('takes the Korean headword and drops a long English gloss', () => {
    expect(glossarySeoTerm(glossary('pot-odds'))).toBe('팟오즈');
    expect(glossarySeoTerm(glossary('preflop'))).toBe('프리플랍');
  });

  it('keeps a short position abbreviation that is part of the search', () => {
    expect(glossarySeoTerm(glossary('big-blind'))).toBe('빅 블라인드(BB)');
    expect(glossarySeoTerm(glossary('button'))).toBe('버튼(BTN)');
  });

  it('uses the record`s seoTerm where Korean readers type something else', () => {
    expect(glossarySeoTerm(glossary('three-bet'))).toBe('3벳');
    expect(glossarySeoTerm(glossary('vpip'))).toBe('VPIP');
    expect(glossarySeoTerm(glossary('pfr'))).toBe('PFR');
    expect(glossarySeoTerm(glossary('utg'))).toBe('UTG(언더 더 건)');
  });
});

describe('seoTitleOf', () => {
  it('titles a glossary entry as "X 뜻" unless the record overrides the whole title', () => {
    expect(seoTitleOf(glossary('three-bet'))).toBe('3벳 뜻 | 홀덤·포커 용어 설명');
    expect(seoTitleOf(glossary('set-vs-trips'))).toBe('셋과 트립스 차이 | 홀덤·포커 용어 설명');
  });

  it('titles a hand page by its key, with the site`s 승률 label and never 이길 확률', () => {
    const hands = ALL_CONTENT.filter((r): r is HandRecord => r.kind === 'hands');
    expect(hands.length).toBeGreaterThan(0);
    for (const hand of hands) {
      expect(seoTitleOf(hand)).toBe(`${hand.handKey} 승률·순위 | 텍사스 홀덤 프리플랍 핸드 가이드`);
    }
  });

  it('gives every published lesson an explicit search title', () => {
    for (const record of ALL_CONTENT) {
      if (record.kind !== 'learn' || record.status !== 'PUBLISHED') continue;
      expect(record.seoTitle, record.id).toBeDefined();
      expect(seoTitleOf(record)).toBe(record.seoTitle);
    }
  });
});
