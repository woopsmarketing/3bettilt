import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { resolveContentRoot } from '../lib/seo/faqSource.js';
import { duplicateHeadings, headingId } from './blog/articleHeadings.js';
import { EditorialH2, EditorialH3 } from './EditorialHeadings.js';

describe('editorial headings', () => {
  it('h2 is a chapter: deterministic id from its own text and the .ed-h2 treatment', () => {
    const { container } = render(<EditorialH2>조합 수: 4가지와 12가지</EditorialH2>);
    const h2 = container.querySelector('h2');
    expect(h2?.id).toBe(headingId('조합 수: 4가지와 12가지'));
    expect(h2?.className).toContain('ed-h2');
  });

  it('h3 is a step: a different, lighter treatment and no chapter rule', () => {
    const { container } = render(<EditorialH3>AA를 받으면 항상 이기나요?</EditorialH3>);
    expect(container.querySelector('h3')?.className).toContain('ed-h3');
    expect(container.querySelector('h3')?.className).not.toContain('ed-h2');
  });

  it('no MDX page of any kind repeats an h2, so every TOC anchor is unique', () => {
    const root = resolveContentRoot();
    if (root === null) throw new Error('content root not found');
    for (const kind of ['learn', 'blog', 'glossary', 'hands']) {
      for (const file of readdirSync(join(root, kind)).filter((f) => f.endsWith('.mdx'))) {
        const source = readFileSync(join(root, kind, file), 'utf8');
        expect(duplicateHeadings(source), `${kind}/${file}`).toEqual([]);
      }
    }
  });
});
