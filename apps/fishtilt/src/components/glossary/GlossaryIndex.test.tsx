import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GlossaryRecord } from '../../content/types.js';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import { GlossaryCategoryMap } from './GlossaryCategoryMap.js';
import { GlossaryIndex } from './GlossaryIndex.js';
import { GlossaryNav } from './GlossaryNav.js';
import { categoryGroups, hubEntries, initialGroups } from './hubModel.js';

function term(
  slug: string,
  termName: string,
  aliases: readonly string[],
  status: 'PUBLISHED' | 'PLANNED',
): GlossaryRecord {
  return {
    kind: 'glossary',
    id: `term-${slug}`,
    slug,
    term: termName,
    aliases,
    title: `${aliases[0]} (${termName})`,
    shortDefinition: `${aliases[0]}의 한 줄 정의.`,
    description: '설명',
    level: 'INTRO',
    topic: 'rules',
    concepts: [],
    prerequisites: [],
    relatedConcepts: [],
    relatedTools: [],
    relatedHands: [],
    nextLessons: [],
    relatedArticles: [],
    status,
    indexable: status === 'PUBLISHED',
    readMinutes: status === 'PUBLISHED' ? 2 : null,
  };
}

// Real slugs so the category mapping applies; the fixture's names are its own.
const RECORDS = [
  term('kicker', 'Kicker', ['키커', '킥커'], 'PUBLISHED'),
  term('stack', 'Stack', ['스택', 'chips'], 'PUBLISHED'),
  term('vpip', 'VPIP', ['브이핍'], 'PLANNED'),
];

const entries = hubEntries(RECORDS);
const initials = initialGroups(entries);
const categories = categoryGroups(entries);

describe('GlossaryIndex', () => {
  it('renders one row per term under its tab, links only the published ones', () => {
    renderBothThemes(<GlossaryIndex groups={initials} />);
    const rows = document.querySelectorAll('[data-glossary-row]');
    expect(rows).toHaveLength(3);
    expect(screen.getByRole('link', { name: '키커' })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/glossary\/kicker$/u),
    );
    expect(screen.getByRole('link', { name: '스택' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'VPIP' })).toBeNull();
    expect(screen.getAllByText('준비 중')).toHaveLength(1);
  });

  it('prints the Latin names and the one-line definition on the row, and only non-empty tabs', () => {
    renderBothThemes(<GlossaryIndex groups={initials} />);
    expect(screen.getByText('Stack · chips')).toBeInTheDocument();
    expect(screen.getByText('스택의 한 줄 정의.')).toBeInTheDocument();
    const tabs = Array.from(document.querySelectorAll('[data-glossary-group]'));
    expect(tabs.map((tab) => tab.querySelector('h3')?.textContent)).toEqual(['ㅅ', 'ㅋ', 'A–Z']);
  });
});

describe('GlossaryNav', () => {
  it('links every category and only the tabs that have a term', () => {
    renderBothThemes(<GlossaryNav categories={categories} initials={initials} />);
    const byCategory = screen.getByRole('navigation', { name: '분류로 찾기' });
    expect(within(byCategory).getAllByRole('link')).toHaveLength(6);
    expect(within(byCategory).getByRole('link', { name: /카드·족보/u })).toHaveAttribute(
      'href',
      '#cat-hand-rankings',
    );
    const byInitial = screen.getByRole('navigation', { name: '첫 글자로 찾기' });
    expect(
      within(byInitial)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['ㅅ', 'ㅋ', 'A–Z']);
    expect(within(byInitial).getByText('ㄱ')).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('GlossaryCategoryMap', () => {
  it('lists each term once under its category as a headword link (or 준비 중 text)', () => {
    renderBothThemes(<GlossaryCategoryMap groups={categories} />);
    const cards = screen.getByRole('region', { name: /카드·족보/u });
    expect(within(cards).getByRole('link', { name: '키커' })).toBeInTheDocument();
    const betting = screen.getByRole('region', { name: /베팅·액션/u });
    expect(within(betting).queryByRole('link', { name: 'VPIP' })).toBeNull();
    expect(within(betting).getByText('VPIP')).toBeInTheDocument();
    expect(document.querySelectorAll('section')).toHaveLength(6);
  });
});
