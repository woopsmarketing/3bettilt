/**
 * @vitest-environment node
 *
 * Node, not the project's happy-dom default, for the same reason as `content.test.ts`: this
 * file reads MDX off disk and `fileURLToPath` rejects happy-dom's `http:` `import.meta.url`.
 *
 * ## What this file is for
 *
 * `content.test.ts` proves the content GRAPH is sound — every id resolves, every page clears
 * its length floor, no page tells the reader what to do at the table. It cannot catch the
 * defect class WP-P1 found: a sentence REASONING about a correct computed number and getting
 * the reasoning wrong. `blog/is-ak-good.mdx` printed `<Fact HAND_RANK AKo/>` — which renders
 * 12 — and then said in the same paragraph that both AK hands are inside the top 10. Every
 * number on the page was right; the sentence about them was not.
 *
 * So each test below RE-DERIVES the relationship from the shipped dataset (`HAND_STRENGTH`,
 * `exactHeadsUpEquity`, `evaluateHand`) and then checks the prose against it. Nothing here
 * pins a copied literal: if the dataset were regenerated and `AKo` moved into the top ten,
 * the derived precondition would stop holding and the assertion would stop applying, rather
 * than failing for a number that legitimately changed.
 *
 * Every assertion was confirmed to FAIL against the defective sentence it replaces
 * (`docs/reports/WP_Q1_CONTENT_FIXES.md` §"tests added").
 */
import { localiseHref } from '../lib/locale.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HAND_STRENGTH, exactHeadsUpEquity } from '@gto-self/learn-core';
import { evaluateHand, handClassByKey, HAND_CLASSES } from '@gto-self/strategy-core';
import { parseCards } from '@gto-self/shared';
import { ALL_CONTENT } from './registry/index.js';
import { CONTENT_PREFIX, contentPath } from './graph.js';
import type { AnyContentRecord } from './types.js';

const CONTENT_DIR = fileURLToPath(new URL('../../content', import.meta.url));

function mdx(kind: string, slug: string): string {
  return readFileSync(join(CONTENT_DIR, kind, `${slug}.mdx`), 'utf8');
}

const ENTRIES = HAND_STRENGTH.entries;
const entryOf = (key: string) => {
  const entry = ENTRIES.find((candidate) => candidate.key === key);
  if (entry === undefined) throw new Error(`no strength entry for ${key}`);
  return entry;
};
/** 6 combos is a pocket pair — read off the dataset, not off the key's spelling. */
const isPair = (key: string) => entryOf(key).comboCount === 6;

describe('claims about cards are re-derived from the dataset (WP-P1 F1)', () => {
  const aks = entryOf('AKs');
  const ako = entryOf('AKo');

  it('AKs is the strongest non-pair and AKo is not adjacent to it', () => {
    const firstNonPair = ENTRIES.find((entry) => entry.comboCount !== 6);
    expect(firstNonPair?.key).toBe('AKs');
    expect(ako.rank).toBeGreaterThan(aks.rank + 1);
  });

  it('is-ak-good never claims a top-N cut the ranking does not support', () => {
    const source = mdx('blog', 'is-ak-good');
    // Any "위쪽 N위 안쪽" / "상위 N위" style claim in this article is about AKs and AKo, so
    // both ranks must actually clear the cut the sentence names.
    for (const [, digits] of source.matchAll(/(\d+)\s*위\s*(?:안|이내|안쪽)/gu)) {
      const cut = Number(digits);
      expect(aks.rank, `AKs vs the "${cut}위" claim`).toBeLessThanOrEqual(cut);
      expect(ako.rank, `AKo vs the "${cut}위" claim`).toBeLessThanOrEqual(cut);
    }
  });

  it('is-ak-good names every class the ranking puts between AKs and AKo', () => {
    const source = mdx('blog', 'is-ak-good');
    const between = ENTRIES.filter((entry) => entry.rank > aks.rank && entry.rank < ako.rank);
    expect(between.length).toBeGreaterThan(0);
    for (const entry of between) {
      expect(source, `rank ${entry.rank} (${entry.key}) sits between AKs and AKo`).toContain(
        `<Fact name="HAND_AT_RANK" arg="${entry.rank}" />`,
      );
    }
    // And it says which of the two is the strongest non-pair, which is the surviving true
    // half of the original sentence.
    expect(isPair('AKs')).toBe(false);
    expect(source).toMatch(/포켓페어가 아닌 패 중에서 가장 앞에 있는 것은 AKs/u);
  });
});

describe('the AsKs / AhKh worked example is explained by symmetry, not equal strength (WP-P1 F3)', () => {
  const hero = parseCards('As Ks');
  const villain = parseCards('Ah Kh');
  if (!hero.ok || !villain.ok) throw new Error('unparseable fixture');
  const resolved = exactHeadsUpEquity(hero.value, villain.value, []);
  if (!resolved.ok) throw new Error(`not a legal deal: ${resolved.error}`);
  const exact = resolved.value;

  it('the two hands are not permanently equal — each side wins outright, equally often', () => {
    expect(exact.equity).toBe(0.5);
    expect(exact.winProb).toBe(exact.loseProb);
    expect(exact.winProb).toBeGreaterThan(0);
    expect(exact.tieProb).toBeLessThan(1);
  });

  it('one of them can make a flush the other cannot — the mechanism the page now names', () => {
    // A board that gives the spade hand five spades and the heart hand nothing.
    const board = parseCards('2s 7s 9s 4d 8c');
    if (!board.ok) throw new Error('unparseable board');
    const heroFive = evaluateHand([...board.value, ...hero.value]);
    const villainFive = evaluateHand([...board.value, ...villain.value]);
    expect(heroFive.category).toBe('FLUSH');
    expect(heroFive.strength).toBeGreaterThan(villainFive.strength);
  });

  it('glossary/equity explains the 50% by suit symmetry and never by equal strength', () => {
    const source = mdx('glossary', 'equity');
    // The derived numbers above falsify "the two hands are exactly equally strong".
    expect(source).not.toMatch(/강도가 정확히 같아/u);
    expect(source).toMatch(/플러시/u);
    expect(source).toMatch(/대칭/u);
  });

  it('glossary/equity defines equity as the expected share with ties split, not P(win)', () => {
    const source = mdx('glossary', 'equity');
    expect(source).not.toMatch(/이길 확률/u);
    expect(source).toMatch(/기대되는 몫/u);
    expect(source).toMatch(/절반만 이긴 것으로/u);
  });
});

describe('the pocket-pair rank gap is described at the size the ranking gives it (WP-P1 F13)', () => {
  const low = entryOf('22');
  const high = entryOf('55');

  it('22 → 55 moves a large fraction of the whole ranking', () => {
    const gap = low.rank - high.rank;
    expect(gap).toBeGreaterThan(ENTRIES.length / 4);
  });

  it('small-pocket-pairs does not call that move small, and shows the steps', () => {
    const source = mdx('blog', 'small-pocket-pairs');
    expect(source).not.toMatch(/폭이 아주 크지는 않/u);
    // The two classes the ranking puts between 22 and 55 are shown rather than asserted.
    for (const entry of ENTRIES.filter((e) => e.rank > high.rank && e.rank < low.rank)) {
      if (entry.comboCount !== 6) continue;
      expect(source, `${entry.key} sits between 55 and 22`).toContain(
        `<Fact name="HAND_RANK" arg="${entry.key}" />`,
      );
    }
  });
});

describe('the "N-high 스트레이트" labels match the boards they sit under (WP-P2 m4)', () => {
  const topRankOfStraight = (cards: string): number => {
    const parsed = parseCards(cards);
    if (!parsed.ok) throw new Error(`unparseable board: ${cards}`);
    const value = evaluateHand(parsed.value);
    expect(value.category).toBe('STRAIGHT');
    return value.ranks[0] ?? -1;
  };
  // `ranks` holds 4-bit rank indices, 0 = deuce.
  const NINE = 7;
  const KING = 11;

  it('playing-the-board: the split board is a 9-high straight', () => {
    expect(topRankOfStraight('5h 6d 7c 8s 9h')).toBe(NINE);
    expect(mdx('blog', 'playing-the-board')).toMatch(/가장 높은 카드가 9인 스트레이트/u);
  });

  it('what-is-kicker: the no-kicker board is a King-high straight', () => {
    expect(topRankOfStraight('Kh Qd Jc Ts 9h')).toBe(KING);
    expect(mdx('blog', 'what-is-kicker')).toMatch(/가장 높은 카드가 King인 스트레이트/u);
  });
});

describe('glossary rule sentences re-derived from the evaluator and the matrix (WP-S3-19)', () => {
  it('hand-ranking: the ranking number is compared before any kicker — a better kicker never beats a higher pair', () => {
    // 2♠2♥ with an A kicker vs 3♦3♣ with a 4 kicker: the 3s win although every side card loses.
    const board = parseCards('9c 8d 7h 4s Ad');
    const twos = parseCards('2s 2h');
    const threes = parseCards('3d 3c');
    if (!board.ok || !twos.ok || !threes.ok) throw new Error('unparseable fixture');
    const low = evaluateHand([...board.value, ...twos.value]);
    const high = evaluateHand([...board.value, ...threes.value]);
    expect(low.category).toBe('PAIR');
    expect(high.category).toBe('PAIR');
    expect(high.strength).toBeGreaterThan(low.strength);
    const source = mdx('glossary', 'hand-ranking');
    expect(source).toMatch(/먼저 그 족보를 이루는 숫자로 가릅니다/u);
    expect(source).toMatch(/스트레이트·플러시·풀하우스는 다섯 장 전체가 족보에 쓰여 키커가 없고/u);
  });

  it('broadway: AA is matrix (0,0), so the T-through-A block is the TOP-LEFT 5×5 corner', () => {
    const aces = handClassByKey('AA');
    expect(aces?.row).toBe(0);
    expect(aces?.col).toBe(0);
    const broadway = HAND_CLASSES.filter((handClass) => /^[AKQJT][AKQJT]/u.test(handClass.key));
    expect(broadway).toHaveLength(25);
    for (const handClass of broadway) {
      expect(handClass.row, handClass.key).toBeLessThan(5);
      expect(handClass.col, handClass.key).toBeLessThan(5);
    }
    const source = mdx('glossary', 'broadway');
    expect(source).toMatch(/AA가 있는 왼쪽 위 한 귀퉁이/u);
    expect(source).not.toMatch(/오른쪽 위/u);
  });
});

describe('equity is never described as the proportion of the time you win (WP-Q disposition D1)', () => {
  const PUBLISHED = ALL_CONTENT.filter((record) => record.status === 'PUBLISHED');
  const EQUITY_FACTS = /HAND_EQUITY_VS_RANDOM|CLASS_VS_CLASS_EQUITY|EXACT_EQUITY/u;
  const P_WIN_WORDING = /이기는 비율|이길 확률|를 이깁니다|을 이깁니다/u;

  const sourceOf = (record: AnyContentRecord) => mdx(record.kind, record.slug);

  it('there is prose to check', () => {
    expect(PUBLISHED.length).toBeGreaterThan(0);
  });

  /**
   * `HAND_STRENGTH.entries[].equity` and `ExactEquity.equity` are hero's expected share of
   * the pot with ties split (`packages/learn-core/src/strength/model.ts`), which is a
   * different quantity from P(win) whenever ties are possible — and they always are.
   */
  it('the two quantities really do differ, so the wording really is wrong', () => {
    const hero = parseCards('8h 8c');
    const villain = parseCards('Ad Kd');
    if (!hero.ok || !villain.ok) throw new Error('unparseable fixture');
    const resolved = exactHeadsUpEquity(hero.value, villain.value, []);
    if (!resolved.ok) throw new Error(resolved.error);
    expect(resolved.value.tieProb).toBeGreaterThan(0);
    expect(resolved.value.equity).not.toBe(resolved.value.winProb);
  });

  it('no paragraph that renders an equity Fact also calls it the proportion of wins', () => {
    const offenders: string[] = [];
    for (const record of PUBLISHED) {
      for (const paragraph of sourceOf(record).split(/\n\s*\n/u)) {
        if (!EQUITY_FACTS.test(paragraph)) continue;
        const hit = P_WIN_WORDING.exec(paragraph);
        if (hit !== null) offenders.push(`${record.id}: «${hit[0]}»`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('every in-prose link points at a page that exists (WP-P2 M6)', () => {
  const PUBLISHED_PATHS = new Set(
    ALL_CONTENT.filter((record) => record.status === 'PUBLISHED').map((record) =>
      contentPath(record),
    ),
  );
  const CONTENT_ROOTS = new Set(Object.values(CONTENT_PREFIX));

  it('resolves, and there is at least one link to resolve', () => {
    let seen = 0;
    const dangling: string[] = [];
    for (const record of ALL_CONTENT) {
      if (record.status !== 'PUBLISHED') continue;
      for (const [, href] of mdx(record.kind, record.slug).matchAll(/\]\((\/[^)\s]*)\)/gu)) {
        if (href === undefined) continue;
        seen += 1;
        const root = `/${href.split('/')[1] ?? ''}`;
        // Content links must name a PUBLISHED piece; anything else is not this test's job.
        // Prose writes the link locale-less; `mdx-components.tsx` localises it on render
        // through `localiseHref`, so that is the href a reader actually follows.
        if (CONTENT_ROOTS.has(root) && !PUBLISHED_PATHS.has(localiseHref(href))) {
          dangling.push(`${record.id} -> ${href}`);
        }
      }
    }
    expect(dangling).toEqual([]);
    expect(seen).toBeGreaterThan(0);
  });
});
