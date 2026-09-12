/**
 * @vitest-environment node
 *
 * Pins the PREMISE of each S2 story against the evaluator, on top of the generic gate in
 * `stories.test.ts`. That gate only checks that the declared winner agrees with the
 * evaluator; these checks say WHY the story is the story — which hand category each side
 * ends with, and that the river actually flips the second hand — so a later edit to a card
 * that keeps the winner but loses the point ("A4s turns two pair", "the 5♥ makes a flush")
 * fails here with a sentence naming the story.
 *
 * Also checks that every `POT_ODDS_REQUIRED_EQUITY` arg the MDX cites is the pot
 * `resolve.ts` sums for that street — the one place a typed number enters a story.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { exactHeadsUpEquity } from '@gto-self/learn-core';
import { Money, parseCards, RANKS, rankOf, type Card } from '@gto-self/shared';
import { resolveStory } from '../../../stories/resolve.js';
import { HAND_STORY_S2_RECORDS } from './s2.js';

const CONTENT_DIR = fileURLToPath(new URL('../../../../../content/blog/', import.meta.url));

function record(slug: string) {
  const found = HAND_STORY_S2_RECORDS.find((entry) => entry.slug === slug);
  if (found === undefined) throw new Error(`no S2 story with slug ${slug}`);
  return found;
}

function showdownOf(slug: string) {
  const resolved = resolveStory(record(slug).hand);
  if (resolved.ending.kind !== 'showdown') throw new Error(`${slug}: expected a showdown`);
  return { resolved, ending: resolved.ending };
}

function cards(text: string) {
  const parsed = parseCards(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

/** Hero's share of the pot over every runout — wins plus half the ties. A ratio, not money. */
function heroShare(hero: readonly Card[], villain: readonly Card[], board: readonly Card[]) {
  const result = exactHeadsUpEquity(hero, villain, board);
  if (!result.ok) throw new Error(`equity: ${result.error}`);
  const { wins, ties, runouts } = result.value;
  return (wins + ties / 2) / runouts;
}

describe('S2 story: qq-three-bet-frustration', () => {
  it('hero QQ (one pair) loses to A4s two pair made on the turn', () => {
    const { ending } = showdownOf('qq-three-bet-frustration');
    expect(ending.hero.category).toBe('PAIR');
    expect(ending.villain.category).toBe('TWO_PAIR');
    expect(ending.winner).toBe('villain');
  });

  it('the villain gets there on the turn: hero is the favourite on the flop, not after the A', () => {
    const { hand } = record('qq-three-bet-frustration');
    const hero = cards(hand.heroHand);
    const villain = cards(hand.showdown?.villainHand ?? '');
    expect(heroShare(hero, villain, cards(hand.flop ?? ''))).toBeGreaterThan(0.5);
    expect(heroShare(hero, villain, cards(`${hand.flop} ${hand.turn}`))).toBeLessThan(0.5);
  });

  it('the flop pair the villain makes is MIDDLE pair — the paired rank is the middle of three flop ranks (WP-S3-19)', () => {
    const { hand } = record('qq-three-bet-frustration');
    const flopRanks = cards(hand.flop ?? '')
      .map((card) => RANKS.indexOf(rankOf(card)))
      .sort((a, b) => a - b);
    expect(flopRanks).toHaveLength(3);
    expect(new Set(flopRanks).size).toBe(3);
    const villainRanks = cards(hand.showdown?.villainHand ?? '').map((card) =>
      RANKS.indexOf(rankOf(card)),
    );
    const paired = flopRanks.filter((r) => villainRanks.includes(r));
    expect(paired).toEqual([flopRanks[1]]);
    const source = readFileSync(`${CONTENT_DIR}qq-three-bet-frustration.mdx`, 'utf8');
    expect(source).not.toMatch(/바텀\s*페어/u);
    expect(source).toMatch(/미들\s*페어/u);
  });
});

describe('S2 story: river-changes-everything', () => {
  it('hero flush beats the villain two pair that was ahead until the river', () => {
    const { ending } = showdownOf('river-changes-everything');
    expect(ending.hero.category).toBe('FLUSH');
    expect(ending.villain.category).toBe('TWO_PAIR');
    expect(ending.winner).toBe('hero');
  });

  it('the river flips it: hero is behind on the flop and on the turn', () => {
    const { hand } = record('river-changes-everything');
    const hero = cards(hand.heroHand);
    const villain = cards(hand.showdown?.villainHand ?? '');
    expect(heroShare(hero, villain, cards(hand.flop ?? ''))).toBeLessThan(0.5);
    expect(heroShare(hero, villain, cards(`${hand.flop} ${hand.turn}`))).toBeLessThan(0.5);
  });
});

describe('S2 stories: the pot-odds facts cite the pots the record sums', () => {
  it.each(HAND_STORY_S2_RECORDS.map((entry) => [entry.slug] as const))('%s', (slug) => {
    const { resolved } = showdownOf(slug);
    const source = readFileSync(`${CONTENT_DIR}${slug}.mdx`, 'utf8');
    const potsAfter = new Set(
      resolved.streets.map((street) => Money.formatBB(street.potAfter, { maxDecimals: 3 })),
    );
    const args = [...source.matchAll(/name="POT_ODDS_REQUIRED_EQUITY"\s+arg="([^"|]+)\|/gu)].map(
      (match) => match[1],
    );
    expect(args.length).toBeGreaterThan(0);
    for (const pot of args) expect(potsAfter, `${slug}: pot ${pot}BB`).toContain(pot);
  });
});
