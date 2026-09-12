/**
 * @vitest-environment node
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import {
  duplicateHeadings,
  extractHeadings,
  headingId,
  headingTextOfSource,
  textOf,
} from './articleHeadings.js';
import { readArticleHeadings } from './articleSource.js';

const BLOG_DIR = fileURLToPath(new URL('../../../content/blog/', import.meta.url));

describe('headingId', () => {
  it('keeps Korean, drops punctuation, joins on hyphens', () => {
    expect(headingId('이 숫자, 콜에 쓸 수 있나요?')).toBe('h-이-숫자-콜에-쓸-수-있나요');
    expect(headingId('  AKs vs AKo  ')).toBe('h-aks-vs-ako');
    expect(headingId('???')).toBe('h-section');
  });
});

describe('textOf / headingTextOfSource agree', () => {
  it('reads nested element children the way the source strip does', () => {
    const rendered = textOf(['같은 ', createElement('span', {}, '무늬'), ' 이야기']);
    expect(rendered).toBe('같은 무늬 이야기');
    expect(headingTextOfSource('같은 <Term id="term-suited">무늬</Term> 이야기')).toBe(
      '같은 무늬 이야기',
    );
    expect(headingTextOfSource('**굵게** 와 [링크](/learn/x) 와 <Fact name="X" />')).toBe(
      '굵게 와 링크 와',
    );
  });
});

describe('extractHeadings over the real blog', () => {
  const files = readdirSync(BLOG_DIR).filter((name) => name.endsWith('.mdx'));

  it('finds the ## sections and skips fenced code', () => {
    const source = '## 하나\n```\n## 코드 안\n```\n### 셋\n## 둘';
    expect(extractHeadings(source).map((h) => h.text)).toEqual(['하나', '둘']);
  });

  it('no published article repeats an h2 — the one case a TOC id could collide', () => {
    const offenders = files.flatMap((name) => {
      const dupes = duplicateHeadings(readFileSync(`${BLOG_DIR}${name}`, 'utf8'));
      return dupes.length > 0 ? [`${name}: ${dupes.join(', ')}`] : [];
    });
    expect(offenders).toEqual([]);
  });

  it('reads an article from disk by slug and returns nothing for an unsafe slug', () => {
    expect(readArticleHeadings('blog', 'outs-nine').length).toBeGreaterThan(0);
    expect(readArticleHeadings('blog', '../etc')).toEqual([]);
    expect(readArticleHeadings('blog', 'no-such-article')).toEqual([]);
  });
});
