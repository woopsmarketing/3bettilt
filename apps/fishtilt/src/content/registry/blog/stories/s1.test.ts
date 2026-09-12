/**
 * @vitest-environment node
 *
 * Batch S1's own pin (WP-S3-08). `stories.test.ts` already proves every record validates and
 * that the declared winner matches the evaluator; this file pins what the PROSE of the two
 * S1 stories relies on beyond the winner — the hand categories each side shows down with —
 * and that every `<Fact>` the MDX cites actually computes (an unknown or illegal fact throws
 * at build time; catching it here is cheaper than a failed `next build`).
 *
 * No poker number is typed here. The facts are evaluated through `factValue` and only
 * checked for shape; the S1 handoff quotes the values this test printed.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { factValue, FACT_NAMES, type FactName } from '../../../facts.js';
import { resolveStory } from '../../../stories/resolve.js';
import { HAND_STORY_S1_RECORDS } from './s1.js';

const CONTENT_DIR = fileURLToPath(new URL('../../../../../content/blog/', import.meta.url));

function record(id: string) {
  const found = HAND_STORY_S1_RECORDS.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`no S1 record ${id}`);
  return found;
}

function showdownOf(id: string) {
  const ending = resolveStory(record(id).hand).ending;
  if (ending.kind !== 'showdown') throw new Error(`${id} does not reach a showdown`);
  return ending;
}

describe('S1 story: qq-vs-72o-flop-227', () => {
  it('hero shows two pair, villain shows a full house, villain wins', () => {
    const ending = showdownOf('blog-qq-vs-72o-flop-227');
    expect(ending.hero.category).toBe('TWO_PAIR');
    expect(ending.villain.category).toBe('FULL_HOUSE');
    expect(ending.winner).toBe('villain');
  });

  it('the villain hand is offsuit, as the title says', () => {
    const { villainHand } = record('blog-qq-vs-72o-flop-227').hand.showdown ?? {};
    const [a, b] = (villainHand ?? '').split(' ');
    expect(a?.at(-1)).not.toBe(b?.at(-1));
  });
});

describe('S1 story: full-house-loses', () => {
  it('both show a full house, villain wins', () => {
    const ending = showdownOf('blog-full-house-loses');
    expect(ending.hero.category).toBe('FULL_HOUSE');
    expect(ending.villain.category).toBe('FULL_HOUSE');
    expect(ending.winner).toBe('villain');
  });
});

describe('S1 facts cited in the MDX', () => {
  const FACT_TAG = /<Fact\s+name="([A-Z_]+)"(?:\s+arg="([^"]*)")?\s*\/>/gu;

  for (const story of HAND_STORY_S1_RECORDS) {
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
      console.info(`[S1 facts] ${story.id}\n  ${lines.join('\n  ')}`);
    });
  }
});
