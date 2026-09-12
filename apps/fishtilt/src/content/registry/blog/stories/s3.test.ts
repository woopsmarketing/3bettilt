/**
 * @vitest-environment node
 *
 * Pins the PREMISE of each S3 story against the evaluator, on top of the generic gate in
 * `stories.test.ts` (which only checks that the declared winner agrees with the evaluator).
 * These checks say WHY the story is the story — the hand category each side shows down
 * with, and the equity shape the prose leans on ("aces were ahead until the turn, then
 * dead"; "AK never paired and still won") — so a later card edit that keeps the winner but
 * loses the point fails here with a sentence naming the story.
 *
 * Also: every `<Fact>` the two MDX files cite must compute (printed so the handoff quotes
 * computed values, never typed ones), and every `POT_ODDS_REQUIRED_EQUITY` pot arg must be
 * a street pot `resolve.ts` sums for that story — the one place a typed number enters.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { exactHeadsUpEquity } from '@gto-self/learn-core';
import { Money, parseCards, type Card } from '@gto-self/shared';
import { factValue, FACT_NAMES, type FactName } from '../../../facts.js';
import { resolveStory } from '../../../stories/resolve.js';
import { estimateReadMinutes, measureContent, unmetIndexRequirements } from '../../../threshold.js';
import { HAND_STORY_S3_RECORDS } from './s3.js';

const CONTENT_DIR = fileURLToPath(new URL('../../../../../content/blog/', import.meta.url));

function record(slug: string) {
  const found = HAND_STORY_S3_RECORDS.find((entry) => entry.slug === slug);
  if (found === undefined) throw new Error(`no S3 story with slug ${slug}`);
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

function dealOf(slug: string) {
  const { hand } = record(slug);
  return {
    hero: cards(hand.heroHand),
    villain: cards(hand.showdown?.villainHand ?? ''),
    flop: cards(hand.flop ?? ''),
    turn: cards(`${hand.flop} ${hand.turn}`),
    river: cards(`${hand.flop} ${hand.turn} ${hand.river}`),
  };
}

describe('S3 story: aa-loses', () => {
  it('hero aces (one pair) lose to a straight the villain turns with 87s', () => {
    const { ending } = showdownOf('aa-loses');
    expect(ending.hero.category).toBe('PAIR');
    expect(ending.villain.category).toBe('STRAIGHT');
    expect(ending.winner).toBe('villain');
  });

  it('the villain hand is suited, as the title says', () => {
    const [a, b] = (record('aa-loses').hand.showdown?.villainHand ?? '').split(' ');
    expect(a?.at(-1)).toBe(b?.at(-1));
  });

  it('aces are the favourite preflop and on the flop, and drawing dead from the turn', () => {
    const deal = dealOf('aa-loses');
    expect(heroShare(deal.hero, deal.villain, [])).toBeGreaterThan(0.5);
    expect(heroShare(deal.hero, deal.villain, deal.flop)).toBeGreaterThan(0.5);
    expect(heroShare(deal.hero, deal.villain, deal.turn)).toBe(0);
    expect(heroShare(deal.hero, deal.villain, deal.river)).toBe(0);
  });
});

describe('S3 story: ak-flop-miss', () => {
  it('neither side ever makes a pair; ace-high beats queen-high', () => {
    const { ending } = showdownOf('ak-flop-miss');
    expect(ending.hero.category).toBe('HIGH_CARD');
    expect(ending.villain.category).toBe('HIGH_CARD');
    expect(ending.winner).toBe('hero');
  });

  it('hero is ahead on every street without pairing, and has the whole pot on the river', () => {
    const deal = dealOf('ak-flop-miss');
    expect(heroShare(deal.hero, deal.villain, [])).toBeGreaterThan(0.5);
    expect(heroShare(deal.hero, deal.villain, deal.flop)).toBeGreaterThan(0.5);
    expect(heroShare(deal.hero, deal.villain, deal.turn)).toBeGreaterThan(0.5);
    expect(heroShare(deal.hero, deal.villain, deal.river)).toBe(1);
  });

  it('the counterfactual the prose cites — the same flop against a pocket pair — is a real underdog', () => {
    // The MDX cites EXACT_EQUITY of hero's cards vs 7♠7♣ on the flop as "what missing means
    // against a pair"; keep the arg in the MDX and this check in step.
    const deal = dealOf('ak-flop-miss');
    expect(heroShare(deal.hero, cards('7s 7c'), deal.flop)).toBeLessThan(0.5);
  });
});

describe('S3 stories: measured prose (content.test.ts equivalents, scoped to this batch)', () => {
  // `content.test.ts` asserts these for every record but stops at the first failing one,
  // so a failure in another batch would hide a wrong S3 value; pin them here as well.
  it.each(HAND_STORY_S3_RECORDS.map((entry) => [entry.id, entry] as const))(
    '%s states the reading time its text implies and clears the indexable floor',
    (_id, story) => {
      const measurement = measureContent(readFileSync(`${CONTENT_DIR}${story.slug}.mdx`, 'utf8'));
      expect(story.readMinutes, `${story.id}: ${measurement.proseCharacters} prose chars`).toBe(
        estimateReadMinutes(measurement.proseCharacters),
      );
      expect(story.indexable).toBe(true);
      expect(unmetIndexRequirements(story, measurement)).toEqual([]);
    },
  );
});

describe('S3 facts cited in the MDX', () => {
  const FACT_TAG = /<Fact\s+name="([A-Z_]+)"(?:\s+arg="([^"]*)")?\s*\/>/gu;

  for (const story of HAND_STORY_S3_RECORDS) {
    it(`${story.id}: every <Fact> computes`, () => {
      const source = readFileSync(`${CONTENT_DIR}${story.slug}.mdx`, 'utf8');
      const tags = [...source.matchAll(FACT_TAG)];
      expect(tags.length).toBeGreaterThan(0);
      const lines: string[] = [];
      for (const [, name, arg] of tags) {
        expect(FACT_NAMES.includes(name as FactName), name).toBe(true);
        const value = factValue(name as FactName, arg);
        expect(value.length).toBeGreaterThan(0);
        lines.push(`${name}(${arg ?? ''}) = ${value}`);
      }
      // Printed so the handoff can quote computed values instead of typed ones.
      console.info(`[S3 facts] ${story.id}\n  ${lines.join('\n  ')}`);
    });

    it(`${story.id}: every EXACT_EQUITY arg deals the story's own cards`, () => {
      const source = readFileSync(`${CONTENT_DIR}${story.slug}.mdx`, 'utf8');
      const { hand } = story;
      const board = [hand.flop, hand.turn, hand.river].filter(Boolean).join('');
      const compact = (text: string) => text.replaceAll(' ', '');
      for (const [, arg] of source.matchAll(/name="EXACT_EQUITY"\s+arg="([^"]+)"/gu)) {
        const [hero, , boardArg = ''] = (arg ?? '').split('|');
        expect(hero).toBe(compact(hand.heroHand));
        expect(compact(board).startsWith(boardArg), `${story.id}: board arg ${boardArg}`).toBe(
          true,
        );
      }
    });
  }

  it.each(HAND_STORY_S3_RECORDS.map((entry) => [entry.slug] as const))(
    '%s: the pot-odds facts cite the pots the record sums',
    (slug) => {
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
    },
  );
});
