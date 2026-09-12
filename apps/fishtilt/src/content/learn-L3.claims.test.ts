/**
 * @vitest-environment node
 *
 * WP-S3-10 batch L3 — claims the five lessons `flop-turn-river`, `three-bet`, `equity`,
 * `pot-odds`, `outs` make ABOUT their computed numbers, re-derived from the engine the way
 * `claims.test.ts` does for the blog. Every `<Fact>` on these pages already computes (the
 * batch gate `registry/learn/h3.test.ts` runs each through `factValue`); what this file pins
 * is the sentence or table cell NEXT to the Fact — author arithmetic ("10BB + 5BB + 5BB =
 * 20BB"), a rule constant typed into prose ("플랍에서는 47장"), a comparison ("규칙 쪽이 실제보다
 * 살짝 높게") — so that the prose can never drift from the number it explains
 * (`3BETTILT_CONTENT_AUDIT.md` §6.1 items 16, 17, 19, 21 and the §3 "필수 시각" tables).
 *
 * Nothing here pins a copied percentage: each assertion is a relation the dataset either
 * holds or does not, and the prose is checked against that relation.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  exactHeadsUpEquity,
  outsOdds,
  potOdds,
  UNSEEN_AFTER_FLOP,
  UNSEEN_AFTER_TURN,
} from '@gto-self/learn-core';
import { CARD_COUNT, Money, parseCards, suitOf, type Card } from '@gto-self/shared';
import { factValue } from './facts.js';
import { lessonsOfCategory } from './registry/learn/categories.js';

const CONTENT_DIR = fileURLToPath(new URL('../../content/learn/', import.meta.url));
const lesson = (slug: string): string => readFileSync(`${CONTENT_DIR}${slug}.mdx`, 'utf8');

const HOLE_CARDS = 2;

function cards(text: string): readonly Card[] {
  const parsed = parseCards(text);
  if (!parsed.ok) throw new Error(`${text}: ${parsed.error}`);
  return parsed.value;
}

function equityOf(hero: string, villain: string, board = ''): number {
  const h = cards(hero);
  const v = cards(villain);
  if (h.length !== 2 || v.length !== 2) throw new Error('two hole cards each');
  const resolution = exactHeadsUpEquity([h[0]!, h[1]!], [v[0]!, v[1]!], cards(board));
  if (!resolution.ok) throw new Error(resolution.error);
  return resolution.value.equity;
}

function oddsOf(outs: number, street: 'FLOP' | 'TURN') {
  const resolution = outsOdds({ outs, street });
  if (!resolution.ok) throw new Error(resolution.error);
  return resolution.value;
}

function potOddsOf(potBB: number, betBB: number) {
  const resolution = potOdds({
    potBeforeCallMbb: Money.fromBB(potBB),
    villainBetMbb: Money.fromBB(betBB),
    callAmountMbb: Money.fromBB(betBB),
  });
  if (!resolution.ok) throw new Error(resolution.error);
  return resolution.value;
}

/** The `unseen` cell of the flop-turn-river DataTable, by street row header. */
function unseenCellsOf(source: string): ReadonlyMap<string, { opened: number; unseen: number }> {
  const rows = new Map<string, { opened: number; unseen: number }>();
  for (const [, street, opened, unseen] of source.matchAll(
    /street: '([^']+)', opened: '(\d+)장', remaining: '\d+장', unseen: '(\d+)장'/gu,
  )) {
    rows.set(street!, { opened: Number(opened), unseen: Number(unseen) });
  }
  return rows;
}

describe('lesson 11 flop-turn-river — the 47-card convention (audit §3 "47장 관례")', () => {
  const source = lesson('flop-turn-river');
  const table = unseenCellsOf(source);

  it('the DataTable lists all four streets', () => {
    expect([...table.keys()]).toEqual(['프리플랍', '플랍', '턴', '리버']);
  });

  it('every "내가 못 본 카드" cell is the deck minus my two hole cards minus the opened board', () => {
    for (const [street, { opened, unseen }] of table) {
      expect(unseen, street).toBe(CARD_COUNT - HOLE_CARDS - opened);
    }
  });

  it('the flop and turn cells are exactly the constants learn-core divides by', () => {
    expect(table.get('플랍')?.unseen).toBe(UNSEEN_AFTER_FLOP);
    expect(table.get('턴')?.unseen).toBe(UNSEEN_AFTER_TURN);
    expect(source).toContain(`플랍에서는 ${UNSEEN_AFTER_FLOP}장, 턴에서는 ${UNSEEN_AFTER_TURN}장`);
  });

  it('the BoardCards figure regroups exactly the five cards the step-by-step PokerCards showed', () => {
    const board = /<BoardCards\s+flop="([^"]+)"\s+turn="([^"]+)"\s+river="([^"]+)"/u.exec(source);
    expect(board).not.toBeNull();
    const full = /<PokerCards cards="([^"]+)" \/>\s*\n\s*\n마지막 한 장까지/u.exec(source);
    expect(full).not.toBeNull();
    const grouped = cards(`${board![1]} ${board![2]} ${board![3]}`);
    expect(grouped).toEqual(cards(full![1]!));
    expect(grouped).toHaveLength(5);
  });
});

describe('lesson 12 three-bet — the example sizes are a labelled sequence (audit §6.1 #21)', () => {
  const source = lesson('three-bet');

  it('the BettingTimeline runs 1BB → 3BB → 9BB → 27BB, in that order, and is labelled 예시 크기', () => {
    const timeline = /<BettingTimeline[\s\S]*?\/>/u.exec(source);
    expect(timeline).not.toBeNull();
    const amounts = [...timeline![0].matchAll(/amount: '([^']+)'/gu)].map(([, a]) => a);
    expect(amounts).toEqual(['1BB', '3BB', '9BB', '27BB']);
    expect(timeline![0]).toContain('예시 크기');
    // The prose lists the same four numbers in the same order.
    expect(source).toContain('1BB, 3BB, 9BB, 27BB');
  });

  it('the timeline names the third step 3-Bet and the fourth 4-Bet — the counting rule, nothing else', () => {
    const notes = [...source.matchAll(/note: '([^']+)'/gu)].map(([, n]) => n);
    expect(notes).toEqual(['첫 번째 벳', '두 번째 벳', '세 번째 벳 = 3-Bet', '네 번째 벳 = 4-Bet']);
  });

  it('states the range limitation (First In only), never renders a 3-bet range', () => {
    expect(source).toContain('First In');
    expect(source).toContain('지원하지 않습니다');
    expect(source).not.toMatch(/<RangeMatrixMini\b/u);
  });
});

describe('lesson 13 equity — "pot share" (audit §3 "무승부 분할 = pot share")', () => {
  const source = lesson('equity');
  const hero = equityOf('8h 8c', 'Ad Kd');
  const villain = equityOf('Ad Kd', '8h 8c');

  it("the two StatsRow shares are each other's complement — they sum to exactly 100%", () => {
    expect(hero + villain).toBeCloseTo(1, 12);
    const rendered =
      Number.parseFloat(factValue('EXACT_EQUITY', '8h8c|AdKd')) +
      Number.parseFloat(factValue('EXACT_EQUITY', 'AdKd|8h8c'));
    expect(rendered).toBeCloseTo(100, 6);
    expect(source).toContain('두 에퀴티를 더하면 언제나 100%');
  });

  it('a tie counts as half a win, exactly as the prose says', () => {
    const h = cards('8h 8c');
    const v = cards('Ad Kd');
    const resolution = exactHeadsUpEquity([h[0]!, h[1]!], [v[0]!, v[1]!], []);
    if (!resolution.ok) throw new Error(resolution.error);
    const { winProb, tieProb, equity } = resolution.value;
    expect(equity).toBeCloseTo(winProb + tieProb / 2, 12);
    expect(source).toContain('절반만 이긴 것으로');
  });

  it('is not exactly 50% ("정확히 50%가 아닙니다")', () => {
    expect(hero).not.toBe(0.5);
    expect(factValue('EXACT_EQUITY', '8h8c|AdKd')).not.toBe('50.00%');
  });

  it('the street StatsRow really falls preflop → flop → turn ("한 번 더 낮아졌습니다")', () => {
    const flop = equityOf('8h 8c', 'Ad Kd', 'As 2h 7c');
    const turn = equityOf('8h 8c', 'Ad Kd', 'As 2h 7c 3d');
    expect(flop).toBeLessThan(hero);
    expect(turn).toBeLessThan(flop);
    expect(source).toContain('낮았던 숫자가 한 번 더 낮아졌습니다');
  });
});

describe('lesson 14 pot-odds — author arithmetic beside the Fact (audit §6.1 #19)', () => {
  const source = lesson('pot-odds');

  it.each([
    ['10|5', 10, 5, 20],
    ['9|3', 9, 3, 15],
    ['10|10', 10, 10, 30],
  ])(
    'DataTable row %s: pot + bet + call = the final pot the engine computes',
    (arg, pot, bet, finalBB) => {
      expect(source).toContain(`arg="${arg}"`);
      expect(potOddsOf(pot, bet).finalPotMbb).toBe(Money.fromBB(finalBB));
      expect(source).toMatch(
        new RegExp(`pot: '${pot}BB',\\s*bet: '${bet}BB',\\s*final: '${finalBB}BB'`, 'u'),
      );
    },
  );

  it('the two prose sums (10+5+5=20, 9+3+3=15) match the engine', () => {
    expect(source).toContain('10BB, 상대가 낸 5BB, 그리고 내가 콜한 5BB를 더해 20BB');
    expect(source).toContain('9BB, 3BB, 3BB를 더한 15BB');
    expect(potOddsOf(10, 5).finalPotMbb).toBe(Money.fromBB(20));
    expect(potOddsOf(9, 3).finalPotMbb).toBe(Money.fromBB(15));
  });

  it('required equity rises with bet size relative to pot, as the table caption claims', () => {
    const small = potOddsOf(9, 3).requiredEquity;
    const half = potOddsOf(10, 5).requiredEquity;
    const full = potOddsOf(10, 10).requiredEquity;
    expect(small).toBeLessThan(half);
    expect(half).toBeLessThan(full);
    expect(source).toContain('팟에 비해 베팅이 클수록 필요한 승률이 올라가는');
  });

  it('8h8c vs AdKd preflop equity really exceeds the 10|5 breakeven ("필요 승률보다 높으므로")', () => {
    expect(equityOf('8h 8c', 'Ad Kd')).toBeGreaterThan(potOddsOf(10, 5).requiredEquity);
    expect(source).toContain('이 승률이 필요 승률보다 높으므로');
  });

  it('implied odds are a concept only — no number is attached to the term', () => {
    const paragraph = /### 지금 걸린 돈만 셉니다\n\n([^\n]+)/u.exec(source);
    expect(paragraph).not.toBeNull();
    expect(paragraph![1]).toContain('임플라이드 오즈');
    expect(paragraph![1]).not.toMatch(/\d/u);
  });
});

describe('lesson 15 outs — counted outs match the OUTS_PROB arguments (audit §6.1 #16, #17)', () => {
  const source = lesson('outs');
  const SUIT_SIZE = 13;
  const RANK_SIZE = 4;

  it('flush draw: 13 − (spades seen in As Ks + 2s 7s 9c) = 9, and every flush Fact uses 9', () => {
    const seen = [...cards('As Ks'), ...cards('2s 7s 9c')].filter((card) => suitOf(card) === 's');
    expect(seen).toHaveLength(4);
    expect(SUIT_SIZE - seen.length).toBe(9);
    expect(source).toContain('13장인데 이 중 4장을 이미 봤으니');
    expect(source).toContain('9장 남았습니다');
    expect(source).toMatch(/<OutsFigure outs=\{9\} street="FLOP" \/>/u);
  });

  it('gutshot: 1 rank × 4 suits = 4, and the gutshot Facts use 4', () => {
    expect(1 * RANK_SIZE).toBe(4);
    expect(source).toContain('완성하는 숫자가 1개, 그 숫자의 무늬가 4개이니 아웃은 4장입니다');
    expect(source).toMatch(/<Fact name="OUTS_PROB" arg="4\|FLOP\|RIVER" \/>/u);
  });

  it('the DataTable covers both outs counts on all three street targets, exact beside shortcut', () => {
    const table = /<DataTable[\s\S]*?\n\/>/u.exec(source);
    expect(table).not.toBeNull();
    for (const outs of [9, 4]) {
      for (const [street, exact, shortcut] of [
        ['FLOP', 'NEXT', 'SHORTCUT_NEXT'],
        ['FLOP', 'RIVER', 'SHORTCUT_RIVER'],
        ['TURN', 'RIVER', 'SHORTCUT_NEXT'],
      ]) {
        expect(table![0]).toContain(`arg="${outs}|${street}|${exact}"`);
        expect(table![0]).toContain(`arg="${outs}|${street}|${shortcut}"`);
      }
    }
  });

  it('rule of 4 overshoots for 9 outs and undershoots for 4 outs, as the prose says', () => {
    const nine = oddsOf(9, 'FLOP');
    const four = oddsOf(4, 'FLOP');
    expect(nine.ruleOfTwoAndFour.byRiverProb).toBeGreaterThan(nine.byRiverProb);
    expect(four.ruleOfTwoAndFour.byRiverProb).toBeLessThan(four.byRiverProb);
    expect(source).toContain('이 예에서는 규칙 쪽이 실제보다 살짝 높게 나옵니다');
    expect(source).toContain('이번에는 규칙 쪽이 실제보다 살짝 낮게 나옵니다');
  });

  it('on the turn "next card" and "by the river" are one event, so the two Facts agree', () => {
    const turn = oddsOf(9, 'TURN');
    expect(turn.nextCardProb).toBe(turn.byRiverProb);
    expect(factValue('OUTS_PROB', '9|TURN|RIVER')).toBe(factValue('OUTS_PROB', '9|TURN|NEXT'));
    expect(source).toContain('확률도 하나뿐입니다');
  });

  it('the unseen-card convention the lesson cites is the one learn-core uses', () => {
    expect(oddsOf(9, 'FLOP').unseenCards).toBe(UNSEEN_AFTER_FLOP);
    expect(oddsOf(9, 'TURN').unseenCards).toBe(UNSEEN_AFTER_TURN);
    expect(source).toContain(
      `플랍에서 아직 못 본 카드는 ${UNSEEN_AFTER_FLOP}장, 턴에서는 ${UNSEEN_AFTER_TURN}장`,
    );
  });

  it('dirty outs are a concept only — no number is attached to the term', () => {
    const paragraph = /### 모든 아웃이 똑같이 깨끗하지는 않습니다\n\n([^\n]+)/u.exec(source);
    expect(paragraph).not.toBeNull();
    expect(paragraph![1]).toContain('더티 아웃');
    expect(paragraph![1]).not.toMatch(/\d/u);
  });

  it('the roadmap-end sentence counts the maths category the way the registry does', () => {
    // The lesson closes by saying the maths lessons are "세 편"; that number is the size of
    // the `math` category in `registry/learn/categories.ts`, not a typed constant.
    expect(lessonsOfCategory('math')).toHaveLength(3);
    expect(source).toContain('확률과 수학 레슨 세 편');
    expect(source).toContain('로드맵의 마지막 레슨');
  });
});

describe('L3 — lesson template contract (WP-S3-09 pilot shape)', () => {
  const L3_SLUGS = ['flop-turn-river', 'three-bet', 'equity', 'pot-odds', 'outs'] as const;

  it.each(L3_SLUGS)(
    '%s: LessonGoals sits above the first section, LessonSummary right before the FAQ',
    (slug) => {
      const source = lesson(slug);
      const goals = source.indexOf('<LessonGoals');
      const firstSection = source.indexOf('\n## ');
      const summary = source.indexOf('<LessonSummary');
      const faq = source.indexOf('## 사람들이 자주 헷갈리는 부분');
      expect(goals, 'has LessonGoals').toBeGreaterThan(-1);
      expect(firstSection, 'has a ## section').toBeGreaterThan(-1);
      expect(goals, 'goals before the first section').toBeLessThan(firstSection);
      expect(summary, 'has LessonSummary').toBeGreaterThan(-1);
      expect(faq, 'has the FAQ section').toBeGreaterThan(-1);
      expect(summary, 'summary before the FAQ').toBeLessThan(faq);
      // Nothing else between the summary block and the FAQ heading.
      const summaryEnd = source.indexOf('/>', summary) + 2;
      expect(source.slice(summaryEnd, faq).trim()).toBe('');
    },
  );

  it.each(L3_SLUGS)(
    '%s: goals and summary carry no typed percentage, BB amount or <Fact> (numbers live in the body)',
    (slug) => {
      const source = lesson(slug);
      for (const name of ['LessonGoals', 'LessonSummary']) {
        const block = new RegExp(`<${name}[\\s\\S]*?/>`, 'u').exec(source);
        expect(block, name).not.toBeNull();
        const items = [...block![0].matchAll(/'([^']+)'/gu)].map(([, item]) => item!);
        expect(items.length, `${name} item count`).toBeGreaterThanOrEqual(2);
        expect(items.length, `${name} item count`).toBeLessThanOrEqual(5);
        for (const item of items) {
          expect(item, `${name}: ${item}`).not.toMatch(/\d+(?:\.\d+)?\s*%/u);
          expect(item, `${name}: ${item}`).not.toMatch(/\d+\s*BB/u);
          expect(item, `${name}: ${item}`).not.toContain('<Fact');
        }
      }
    },
  );
});
