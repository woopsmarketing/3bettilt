import { describe, expect, it } from 'vitest';
import { parseCards } from '@gto-self/shared';
import { handClassByKey } from '@gto-self/strategy-core';
import { evaluateHandRank } from '../../features/tools/handRank.js';
import { GLOSSARY_RECORDS } from '../../content/registry/glossary/index.js';
import { TERM_CATEGORY } from '../../content/registry/glossary/categories.js';
import { GLOSSARY_VISUALS, visualOf } from './visuals.js';

/**
 * Every picture the term template draws is checked here with the product's own evaluator,
 * so a "플러시" header cannot show a straight, and a hand class cannot be a typo.
 */
describe('glossary visuals', () => {
  const slugs = new Set(GLOSSARY_RECORDS.map((term) => term.slug));

  it('names only real terms, and only card terms (카드·족보, 시작 핸드, 게임 구조 boards)', () => {
    for (const slug of Object.keys(GLOSSARY_VISUALS)) {
      expect(slugs.has(slug), slug).toBe(true);
      expect(['hand-rankings', 'starting-hands', 'game'], slug).toContain(TERM_CATEGORY[slug]);
    }
  });

  it('covers the nine hand categories, weakest to strongest', () => {
    const made = Object.entries(GLOSSARY_VISUALS).flatMap(([slug, visual]) =>
      visual.kind === 'made-hand' ? [[slug, visual.category] as const] : [],
    );
    expect(made.map(([slug]) => slug)).toEqual([
      'high-card',
      'one-pair',
      'two-pair',
      'three-of-a-kind',
      'straight',
      'flush',
      'full-house',
      'four-of-a-kind',
      'straight-flush',
    ]);
  });

  it('every made-hand example evaluates to exactly the category its term names', () => {
    for (const [slug, visual] of Object.entries(GLOSSARY_VISUALS)) {
      if (visual.kind !== 'made-hand') continue;
      const parsed = parseCards(visual.cards);
      expect(parsed.ok, `${slug}: ${visual.cards}`).toBe(true);
      if (!parsed.ok) continue;
      expect(parsed.value, slug).toHaveLength(5);
      const result = evaluateHandRank(parsed.value.slice(0, 2), parsed.value.slice(2));
      expect(result.status, slug).toBe('EVALUATED');
      if (result.status === 'EVALUATED') expect(result.category, slug).toBe(visual.category);
    }
  });

  it('every hand-class example is one of the 169 real classes', () => {
    for (const [slug, visual] of Object.entries(GLOSSARY_VISUALS)) {
      if (visual.kind !== 'hand-class') continue;
      expect(handClassByKey(visual.hand), `${slug}: ${visual.hand}`).toBeDefined();
    }
  });

  it('every board example parses street by street with no duplicate card', () => {
    for (const [slug, visual] of Object.entries(GLOSSARY_VISUALS)) {
      if (visual.kind !== 'board') continue;
      const text = [visual.flop, visual.turn, visual.river].filter(Boolean).join(' ');
      const parsed = parseCards(text);
      expect(parsed.ok, `${slug}: ${text}`).toBe(true);
      if (!parsed.ok) continue;
      expect(new Set(parsed.value).size, slug).toBe(parsed.value.length);
      const flop = parseCards(visual.flop);
      expect(flop.ok ? flop.value.length : 0, `${slug}: flop`).toBe(3);
    }
    // The streets show the same board progressing.
    expect(visualOf('turn')).toMatchObject({ flop: (visualOf('flop') as { flop: string }).flop });
    expect(visualOf('river')).toMatchObject({ turn: (visualOf('turn') as { turn: string }).turn });
  });

  it('is undefined for a term that is not about cards', () => {
    expect(visualOf('three-bet')).toBeUndefined();
    expect(visualOf('position')).toBeUndefined();
  });
});
