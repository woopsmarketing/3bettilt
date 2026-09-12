/**
 * `threshold.ts` is what stands between `indexable: true` and a thin page, so its
 * measurement has to be right about the things a thin page would exploit: markup is not
 * prose, a component's CHILDREN are prose, and a wall of JSX props is neither.
 */
import { describe, expect, it } from 'vitest';
import {
  estimateReadMinutes,
  measureContent,
  MINIMUM_CONTENT,
  READING_CHARACTERS_PER_MINUTE,
  unmetIndexRequirements,
} from './threshold.js';
import type { ContentRecord } from './types.js';

const RECORD: ContentRecord = {
  kind: 'learn',
  id: 'x',
  slug: 'x',
  title: '제목',
  description: '설명입니다 설명입니다',
  level: 'BASIC',
  topic: 'range',
  concepts: [],
  prerequisites: [],
  relatedConcepts: ['a', 'b'],
  relatedTools: ['range'],
  relatedHands: [],
  nextLessons: ['y'],
  relatedArticles: [],
  status: 'PUBLISHED',
  indexable: true,
  readMinutes: 3,
};

describe('measureContent', () => {
  it('counts non-whitespace prose characters and ignores markdown syntax', () => {
    expect(measureContent('## 제목\n\n한 줄 입니다.').proseCharacters).toBe(
      '제목한줄입니다.'.length,
    );
  });

  it('does not count JSX tags or their attributes as prose', () => {
    const withTag = measureContent('<Fact name="COMBO_COUNT" arg="BTN" />가지입니다.');
    expect(withTag.proseCharacters).toBe('가지입니다.'.length);
  });

  it('counts the text INSIDE a component as prose — that is what the reader reads', () => {
    const source = '<Callout title="제목">\n\n본문입니다.\n\n</Callout>';
    expect(measureContent(source).proseCharacters).toBe('본문입니다.'.length);
  });

  it('survives a > inside a JSX expression prop without cutting the tag short', () => {
    const source = '<MiniQuiz questions={[{ q: "a", ok: 1 > 0 }]} />남은 글자.';
    expect(measureContent(source).proseCharacters).toBe('남은글자.'.length);
  });

  it('ignores fenced code blocks', () => {
    const source = '문장.\n\n```ts\nconst a = 1;\n```\n';
    expect(measureContent(source).proseCharacters).toBe('문장.'.length);
  });

  it('counts only level-2 headings as sections', () => {
    const source = '# 하나\n\n## 둘\n\n### 셋\n\n## 넷\n';
    const measured = measureContent(source);
    expect(measured.sectionCount).toBe(2);
    expect(measured.hasTopLevelHeading).toBe(true);
  });

  it('collects capitalised component names, and only those', () => {
    const source = '<Fact name="A" /> <Term id="t">말</Term> <span>x</span>';
    expect(measureContent(source).componentUses).toEqual(['Fact', 'Term', 'Term']);
  });

  it('detects an ESM statement anywhere in the file', () => {
    expect(measureContent("import X from 'x';\n\n글.").hasEsmStatement).toBe(true);
    expect(measureContent('export const a = 1;').hasEsmStatement).toBe(true);
    expect(measureContent('글만 있습니다.').hasEsmStatement).toBe(false);
  });
});

describe('unmetIndexRequirements', () => {
  const clearing = {
    proseCharacters: MINIMUM_CONTENT.learn.minProseCharacters,
    sectionCount: MINIMUM_CONTENT.learn.minSections,
    componentUses: ['Fact', 'ToolCTA'],
    hasEsmStatement: false,
    hasTopLevelHeading: false,
  } as const;

  it('passes a record that clears every floor', () => {
    expect(unmetIndexRequirements(RECORD, clearing)).toEqual([]);
  });

  it('refuses a page that is one character short of the prose floor', () => {
    const unmet = unmetIndexRequirements(RECORD, {
      ...clearing,
      proseCharacters: MINIMUM_CONTENT.learn.minProseCharacters - 1,
    });
    expect(unmet).toHaveLength(1);
    expect(unmet[0]).toContain('본문');
  });

  it('refuses the 100-200 character page §40 names, and says why', () => {
    const unmet = unmetIndexRequirements(RECORD, {
      ...clearing,
      proseCharacters: 150,
      sectionCount: 0,
      componentUses: [],
    });
    expect(unmet.length).toBeGreaterThanOrEqual(3);
  });

  it('refuses a PLANNED record however long its text is', () => {
    const planned = { ...RECORD, status: 'PLANNED' } as const;
    expect(unmetIndexRequirements(planned, clearing)).toContain(
      '아직 발행되지 않은 글입니다 (status: PLANNED)',
    );
  });

  it('counts distinct components, not repeats', () => {
    const unmet = unmetIndexRequirements(RECORD, {
      ...clearing,
      componentUses: ['Fact', 'Fact', 'Fact'],
    });
    expect(unmet.some((reason) => reason.includes('구성요소'))).toBe(true);
  });

  it('refuses a dead end — no tool, or nowhere to go next', () => {
    expect(
      unmetIndexRequirements({ ...RECORD, relatedTools: [] }, clearing).some((r) =>
        r.includes('도구'),
      ),
    ).toBe(true);
    expect(
      unmetIndexRequirements({ ...RECORD, nextLessons: [], relatedArticles: [] }, clearing).some(
        (r) => r.includes('다음 단계'),
      ),
    ).toBe(true);
  });

  it('holds every kind to its own floor', () => {
    expect(MINIMUM_CONTENT.learn.minProseCharacters).toBeGreaterThan(
      MINIMUM_CONTENT.glossary.minProseCharacters,
    );
    // Every floor is far above the "generated 100-200자" page §40 bans.
    for (const threshold of Object.values(MINIMUM_CONTENT)) {
      expect(threshold.minProseCharacters).toBeGreaterThan(200);
    }
  });
});

describe('estimateReadMinutes', () => {
  it('rounds up from the measured length at the stated rate', () => {
    expect(estimateReadMinutes(READING_CHARACTERS_PER_MINUTE * 3)).toBe(3);
    expect(estimateReadMinutes(READING_CHARACTERS_PER_MINUTE * 3 + 1)).toBe(4);
  });

  it('never claims a one-minute read', () => {
    expect(estimateReadMinutes(0)).toBe(2);
    expect(estimateReadMinutes(10)).toBe(2);
  });
});
