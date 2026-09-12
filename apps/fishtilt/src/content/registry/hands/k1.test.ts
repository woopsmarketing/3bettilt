/**
 * @vitest-environment node
 *
 * Hands batch K1 gate (`aa`, `kk`, `qq`, `jj`, `tt`) — the generic checks from
 * `batchGate.ts` plus this batch's ruling-28 pins: several comparative sentences in the
 * hands prose were wrong on a first draft and were only caught by running the real
 * evaluator, not by re-reading the prose. Pinning the corrected claims as executable
 * assertions means a future edit that quietly changes `learn-core`'s strength dataset — or
 * a future author's edit to this batch's prose reasoning — cannot silently reintroduce the
 * same class of error.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { makeCard, type Card } from '@gto-self/shared';
import { evaluateHandRank } from '../../../features/tools/handRank.js';
import { factValue } from '../../facts.js';
import { CONTENT_DIR, describeHandBatch, equity, rank } from './batchGate.js';
import { HAND_K1_RECORDS } from './k1.js';

const OWNED_SLUGS = ['aa', 'kk', 'qq', 'jj', 'tt'] as const;

describeHandBatch({
  batch: 'K1',
  records: HAND_K1_RECORDS,
  ownedSlugs: OWNED_SLUGS,
  mdxMapSource: readFileSync(fileURLToPath(new URL('../../hands/k1.ts', import.meta.url)), 'utf8'),
  mdxMapExport: 'HAND_K1_MDX',
});

describe('hands batch K1 — comparative claims are evaluator-verified, not reasoned (ruling 28)', () => {
  it('AA outranks KK, and AA’s equity vs random exceeds KK’s (aa.mdx / kk.mdx)', () => {
    expect(rank('AA')).toBeLessThan(rank('KK'));
    expect(equity('AA')).toBeGreaterThan(equity('KK'));
  });

  it('the KK→QQ equity gap is smaller than the AA→KK gap (kk.mdx’s corrected claim)', () => {
    const aaToKk = equity('AA') - equity('KK');
    const kkToQq = equity('KK') - equity('QQ');
    expect(kkToQq).toBeLessThan(aaToKk);
  });

  it('AKs outranks 77, and JJ outranks AKs (jj.mdx / 77.mdx)', () => {
    expect(rank('AKs')).toBeLessThan(rank('77'));
    expect(rank('JJ')).toBeLessThan(rank('AKs'));
  });

  it('QQ is favored in both frozen CLASS_VS_CLASS_EQUITY matchups against AK (qq.mdx)', () => {
    const vsAKs = Number(factValue('CLASS_VS_CLASS_EQUITY', 'QQ|AKs').replace('%', ''));
    const vsAKo = Number(factValue('CLASS_VS_CLASS_EQUITY', 'QQ|AKo').replace('%', ''));
    expect(vsAKs).toBeGreaterThan(50);
    expect(vsAKo).toBeGreaterThan(50);
  });

  /**
   * Why AA outruns KK against a random hand — the mechanism, pinned.
   *
   * Two wrong explanations have already shipped on these two pages and been retracted. The first
   * blamed the whole 2.80-point gap on the rare AA-vs-KK confrontation, which explains about 11%
   * of it. The replacement was worse: it said that holding AA means "남은 A 두 장은 이미 내 손
   * 안에" so no ace can reach the board or an opponent. **Holding AA leaves two aces in the deck.**
   * An opponent can hold one and one can flop.
   *
   * The real mechanism is the one pinned here: an ace is an *overcard* to KK and beats it, while
   * AA has no overcard at all — an ace arriving makes AA stronger, never weaker. So the gap comes
   * from a situation that recurs every hand, not from a rare confrontation and not from aces
   * being unavailable.
   */
  const OVERCARD_BOARD = 'Ad 8c 3h';

  function cardsOf(text: string): Card[] {
    return text.split(' ').map((token) => {
      const cardRank = token[0] as Parameters<typeof makeCard>[0];
      const suit = token[1] as Parameters<typeof makeCard>[1];
      return makeCard(cardRank, suit);
    });
  }

  function categoryOn(hole: string, board: string): string {
    const result = evaluateHandRank(cardsOf(hole), cardsOf(board));
    expect(result.status).toBe('EVALUATED');
    return result.status === 'EVALUATED' ? result.category : '';
  }

  it('an ace on the board lifts AA to trips and leaves KK behind a pair of aces', () => {
    // The same board, the two hands: this is the recurring situation the pages describe.
    expect(categoryOn('As Ah', OVERCARD_BOARD)).toBe('TRIPS');
    expect(categoryOn('Ks Kh', OVERCARD_BOARD)).toBe('PAIR');
    // ...and the opponent holding one of the two aces still in the deck now beats KK.
    expect(categoryOn('Ac Qd', OVERCARD_BOARD)).toBe('PAIR');
  });

  it('neither page claims an ace cannot appear while a player holds AA', () => {
    // Two aces remain in the deck when a player holds AA. Both retracted phrasings said otherwise.
    for (const slug of ['aa', 'kk']) {
      const source = readFileSync(`${CONTENT_DIR}${slug}.mdx`, 'utf8');
      expect(source, `${slug}.mdx`).not.toContain('남은 A 두 장은 이미 내 손 안에');
      expect(source, `${slug}.mdx`).not.toContain('남은 A 두 장을 이미 쥐고 있어서');
    }
  });
});
