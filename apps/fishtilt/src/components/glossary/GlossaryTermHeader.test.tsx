import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import { GlossaryTermHeader } from './GlossaryTermHeader.js';

const PROPS = {
  title: '다시 거는 세 번째 레이즈 (3-Bet)',
  headword: '쓰리벳',
  term: '3-Bet',
  aliases: ['3벳', '쓰리 벳', '3-bet', '3bet', '삼벳'],
  shortDefinition: '오픈 레이즈에 다시 레이즈하는 것을 말합니다.',
  level: 'BASIC' as const,
  category: { label: '베팅·액션', href: '/x/glossary#cat-betting' },
};

describe('GlossaryTermHeader', () => {
  it('has the title as the only h1, the category as a link back to the hub, and the level', () => {
    renderBothThemes(<GlossaryTermHeader {...PROPS} />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(PROPS.title);
    expect(screen.getByRole('link', { name: '베팅·액션' })).toHaveAttribute(
      'href',
      '/x/glossary#cat-betting',
    );
    expect(screen.getByText('초급')).toBeInTheDocument();
  });

  it('prints the headword first, then the Latin term and every alias, each in a marked node', () => {
    renderBothThemes(<GlossaryTermHeader {...PROPS} />);
    const names = Array.from(
      document.querySelectorAll(
        '[data-glossary="names"] [data-glossary-headword], [data-glossary="names"] [data-glossary-term], [data-glossary="names"] [data-glossary-alias]',
      ),
    ).map((node) => node.textContent);
    expect(names).toEqual(['쓰리벳', '3-Bet', ...PROPS.aliases]);
    expect(document.querySelector('[data-glossary-headword="쓰리벳"]')).not.toBeNull();
    expect(document.querySelector('[data-glossary-term="3-Bet"]')).not.toBeNull();
    for (const alias of PROPS.aliases) {
      expect(document.querySelector(`[data-glossary-alias="${alias}"]`), alias).not.toBeNull();
    }
    // Each name exactly once — the term is not repeated as an alias.
    expect(document.querySelectorAll('[data-glossary-alias="3-Bet"]')).toHaveLength(0);
  });

  it('shows the one-line definition as the lead, marked for the JSON-LD', () => {
    renderBothThemes(<GlossaryTermHeader {...PROPS} />);
    expect(document.querySelector('[data-glossary-definition]')?.textContent).toBe(
      PROPS.shortDefinition,
    );
  });

  it('does not repeat the headword among the other names, and renders a visual when given one', () => {
    renderBothThemes(
      <GlossaryTermHeader {...PROPS} visual={<span data-testid="visual">cards</span>} />,
    );
    expect(document.querySelectorAll('[data-glossary-alias="쓰리벳"]')).toHaveLength(0);
    expect(screen.getByTestId('visual')).toBeInTheDocument();
  });
});
