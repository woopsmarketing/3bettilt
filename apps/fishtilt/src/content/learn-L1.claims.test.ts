/**
 * @vitest-environment node
 *
 * WP-S3-10 batch L1 — claims the five foundation lessons (`holdem-basics`,
 * `poker-hand-rankings`, `starting-hands`, `starting-hand-ranking`, `hand-matrix`) make
 * ABOUT computed numbers, re-derived from the shipped packages the way `claims.test.ts`
 * does. `<Fact>` renders the right number; these tests pin the sentence around it.
 *
 * Each block names the audit item it closes (`docs/reports/stage3/3BETTILT_CONTENT_AUDIT.md`
 * §3 / §6.1). Nothing here copies a literal out of a dataset: every expectation is a
 * relationship the dataset either supports or does not.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  categoryFrequencyOf,
  handClassFacts,
  handStrengthOf,
  HAND_STRENGTH_BY_RANK,
} from '@gto-self/learn-core';
import {
  combosOfHandClass,
  comboCards,
  evaluateHand,
  HAND_CATEGORIES,
  HAND_CLASS_COUNT,
  handClassByKey,
} from '@gto-self/strategy-core';
import { parseCards, suitOf } from '@gto-self/shared';
import { factValue } from './facts.js';

const CONTENT_DIR = fileURLToPath(new URL('../../content/learn', import.meta.url));
const lesson = (slug: string): string => readFileSync(join(CONTENT_DIR, `${slug}.mdx`), 'utf8');

const L1_SLUGS = [
  'holdem-basics',
  'poker-hand-rankings',
  'starting-hands',
  'starting-hand-ranking',
  'hand-matrix',
] as const;

function requireClass(key: string) {
  const handClass = handClassByKey(key);
  if (handClass === undefined) throw new Error(`${key} is not a hand class`);
  return handClass;
}

describe('L1 — lesson template and visual contract (WP-S3-09 template, audit §3 #1-#5)', () => {
  it('every L1 lesson has LessonGoals before the first ## and LessonSummary before the FAQ section', () => {
    for (const slug of L1_SLUGS) {
      const source = lesson(slug);
      const goals = source.indexOf('<LessonGoals');
      const summary = source.indexOf('<LessonSummary');
      const firstH2 = source.search(/^## /mu);
      const faq = source.indexOf('## 사람들이 자주 헷갈리는 부분');
      expect(goals, `${slug}: LessonGoals`).toBeGreaterThan(-1);
      expect(goals, `${slug}: LessonGoals before the first ## heading`).toBeLessThan(firstH2);
      expect(summary, `${slug}: LessonSummary`).toBeGreaterThan(-1);
      expect(faq, `${slug}: FAQ section`).toBeGreaterThan(-1);
      expect(summary, `${slug}: LessonSummary before FAQ`).toBeLessThan(faq);
      // Goals/summary are string props: a single quote inside an item breaks MDX parsing
      // (WP-S3-09 handoff), and a digit would be a typed number outside <Fact>.
      for (const block of [/<LessonGoals[\s\S]*?\/>/u, /<LessonSummary[\s\S]*?\/>/u]) {
        const match = block.exec(source);
        expect(match, `${slug}: ${block}`).not.toBeNull();
        const items = [...(match?.[0] ?? '').matchAll(/'([^']*)'/gu)].map(([, item]) => item!);
        expect(items.length, `${slug}: items`).toBeGreaterThanOrEqual(2);
        expect(items.length, `${slug}: items`).toBeLessThanOrEqual(4);
        for (const item of items) {
          // The grid's name (13×13) is a label, not a poker number.
          const withoutLabels = item.replace(/13×13/gu, '');
          expect(withoutLabels, `${slug}: "${item}" carries a typed digit`).not.toMatch(/\d/u);
        }
      }
    }
  });

  it('carries the deterministic visual the content audit (§3) requires for each lesson', () => {
    const required: Readonly<Record<(typeof L1_SLUGS)[number], readonly string[]>> = {
      'holdem-basics': ['<Timeline'],
      'poker-hand-rankings': ['<DataTable', '<PokerCards'],
      'starting-hands': ['<PokerCards', '<RangeMatrixMini'],
      'starting-hand-ranking': ['<StatsRow', '<RangeMatrixMini'],
      'hand-matrix': [
        '<RangeMatrixMini',
        '<PokerCards hand="KQs"',
        '<PokerCards hand="KQo"',
        '<PokerCards hand="KK"',
      ],
    };
    for (const slug of L1_SLUGS) {
      for (const marker of required[slug]) {
        expect(lesson(slug), `${slug}: ${marker}`).toContain(marker);
      }
    }
  });

  it('the holdem-basics timeline is the six stages the audit names, in hand order, without numbers', () => {
    const source = lesson('holdem-basics');
    const timeline = /<Timeline[\s\S]*?\/>/u.exec(source)?.[0] ?? '';
    const metas = [...timeline.matchAll(/meta: '([^']*)'/gu)].map(([, meta]) => meta!);
    expect(metas).toEqual(['판 시작', '프리플랍', '플랍', '턴', '리버', '판 끝']);
    expect(timeline).not.toMatch(/\d/u);
    // The missing concepts the audit lists: button movement and the stack.
    expect(source).toMatch(/버튼은 한 판이 끝날 때마다 시계 방향으로 한 자리씩 옮겨/u);
    expect(source).toMatch(/<Term id="term-stack">스택<\/Term>/u);
  });
});

describe('starting-hands — suited vs offsuit claims (audit §3 #3)', () => {
  const source = lesson('starting-hands');
  const positionsWith = (key: string): readonly string[] => {
    const rendered = factValue('RFI_POSITIONS_WITH', key);
    return rendered === '한 자리도 없습니다' ? [] : rendered.split(' · ');
  };

  it('AKo has three times the combos of AKs, as the prose says ("세 배 차이")', () => {
    expect(handClassFacts(requireClass('AKo')).comboCount).toBe(
      3 * handClassFacts(requireClass('AKs')).comboCount,
    );
    expect(source).toMatch(/조합 수가 세 배 차이 나는 이유/u);
  });

  it('AKs and AKo are used from the SAME first-in seats (several of them), as the prose now says', () => {
    // The pre-Stage-3 text claimed AKs was used from more seats than AKo; the dataset says
    // the two lists are identical, so the prose was rewritten to "똑같은 경우도 있습니다".
    const suited = positionsWith('AKs');
    const offsuit = positionsWith('AKo');
    expect(suited.length).toBeGreaterThan(1);
    expect(suited).toEqual(offsuit);
    expect(source).toMatch(
      /AKs와 AKo처럼, 숫자가 같으면 학습용 기본 레인지에서 쓰이는 자리가 똑같은 경우도 있습니다/u,
    );
    expect(source).not.toMatch(/더 여러 자리에서 쓰인다/u);
  });

  it('some lower rank pair IS split by suitedness across the first-in seats ("갈리는 칸이 나옵니다")', () => {
    const ranks = 'AKQJT98765432';
    const split: string[] = [];
    for (let hi = 0; hi < ranks.length; hi += 1) {
      for (let lo = hi + 1; lo < ranks.length; lo += 1) {
        const pair = `${ranks[hi]}${ranks[lo]}`;
        const suited = positionsWith(`${pair}s`);
        const offsuit = positionsWith(`${pair}o`);
        // Suitedness never removes a seat: every seat that opens the offsuit hand opens the
        // suited one. (The prose does not claim this; the test pins it as a data guard.)
        for (const seat of offsuit) expect(suited, `${pair}: ${seat}`).toContain(seat);
        if (suited.length !== offsuit.length) split.push(pair);
      }
    }
    expect(split.length).toBeGreaterThan(0);
    expect(source).toMatch(/무늬가 같은지에 따라 쓰이는 자리가 갈리는 칸이 나옵니다/u);
  });

  it('a pocket pair is always the same number of combos, whatever the rank', () => {
    const pairCombos = new Set(
      ['22', '88', 'AA'].map((key) => handClassFacts(requireClass(key)).comboCount),
    );
    expect(pairCombos.size).toBe(1);
    expect(source).toMatch(/88이든 AA든, 어떤 숫자의 포켓페어든 이 숫자는 똑같습니다/u);
  });
});

describe('starting-hand-ranking — 72o is not the weakest class (prose claim)', () => {
  it('72o ranks above the last class, so "진짜 꼴찌는 따로 있습니다" is true', () => {
    const rank72o = handStrengthOf(requireClass('72o')).rank;
    expect(rank72o).toBeLessThan(HAND_CLASS_COUNT);
    expect(HAND_STRENGTH_BY_RANK[HAND_CLASS_COUNT - 1]?.key).not.toBe('72o');
    expect(lesson('starting-hand-ranking')).toMatch(/진짜 꼴찌는 따로 있습니다/u);
  });
});

const SUIT_GLYPH: Readonly<Record<string, string>> = { s: '♠', h: '♥', d: '♦', c: '♣' };

function evaluate(cards: string) {
  const parsed = parseCards(cards);
  if (!parsed.ok) throw new Error(`unparseable cards: ${cards}`);
  return evaluateHand(parsed.value);
}

describe('hand-matrix — KQs suit combos (audit §6.1 #1, ERROR)', () => {
  const source = lesson('hand-matrix');
  const kqs = handClassByKey('KQs');
  if (kqs === undefined) throw new Error('KQs is not a hand class');
  const combos = combosOfHandClass(kqs).map((combo) => comboCards(combo));

  it('the engine says a suited class has exactly one combo per suit, both cards the same suit', () => {
    expect(combos).toHaveLength(4);
    for (const [a, b] of combos) expect(suitOf(a)).toBe(suitOf(b));
    expect(new Set(combos.map(([a]) => suitOf(a))).size).toBe(4);
  });

  it('the prose lists exactly the four same-suit pairs the engine produces, and no mixed pair', () => {
    const listed = [...source.matchAll(/([♠♥♦♣])([♠♥♦♣])/gu)].map(([, a, b]) => `${a}${b}`);
    const engine = combos.map(([a]) => `${SUIT_GLYPH[suitOf(a)]}${SUIT_GLYPH[suitOf(a)]}`);
    expect(new Set(listed)).toEqual(new Set(engine));
    for (const pair of listed) expect(pair[0], pair).toBe(pair[1]);
  });

  it('KQo is 4 × 3 different-suit pairings, as the prose explains', () => {
    const kqo = handClassByKey('KQo');
    if (kqo === undefined) throw new Error('KQo is not a hand class');
    const offsuit = combosOfHandClass(kqo).map((combo) => comboCards(combo));
    expect(offsuit).toHaveLength(12);
    for (const [a, b] of offsuit) expect(suitOf(a)).not.toBe(suitOf(b));
    expect(source).toMatch(/K의 무늬 네 가지마다 Q는 그와 다른 무늬 세 가지/u);
  });
});

describe('poker-hand-rankings — the frequency table (audit §3 #2)', () => {
  const source = lesson('poker-hand-rankings');

  it('rank and five-card count move in exactly opposite directions across all nine categories', () => {
    const byRank = [...HAND_CATEGORIES]
      .map((category) => categoryFrequencyOf(category))
      .sort((a, b) => a.rank - b.rank);
    expect(byRank.map((entry) => entry.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (let i = 1; i < byRank.length; i += 1) {
      expect(
        byRank[i]!.count,
        `${byRank[i]!.category} rarer than ${byRank[i - 1]!.category}`,
      ).toBeGreaterThan(byRank[i - 1]!.count);
    }
  });

  it('the table carries a CATEGORY_FREQUENCY fact for every category, strongest first', () => {
    const args = [...source.matchAll(/<Fact name="CATEGORY_FREQUENCY" arg="([A-Z_]+)" \/>/gu)].map(
      ([, arg]) => arg!,
    );
    expect(new Set(args)).toEqual(new Set(HAND_CATEGORIES));
    expect(args).toHaveLength(HAND_CATEGORIES.length);
    const ranks = args.map(
      (arg) => categoryFrequencyOf(arg as (typeof HAND_CATEGORIES)[number]).rank,
    );
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});

describe('poker-hand-rankings — same-category comparison rules (audit §3 #2 missing concept)', () => {
  const source = lesson('poker-hand-rankings');

  it('two pair: the higher top pair wins even against two higher-looking pairs', () => {
    const top = 'Ah Ad 3c 3d 7s';
    const bottom = 'Kh Kd Qc Qd 7s';
    expect(source).toContain(`<PokerCards cards="${top}" />`);
    expect(source).toContain(`<PokerCards cards="${bottom}" />`);
    const a = evaluate(top);
    const b = evaluate(bottom);
    expect(a.category).toBe('TWO_PAIR');
    expect(b.category).toBe('TWO_PAIR');
    expect(a.strength).toBeGreaterThan(b.strength);
  });

  it('full house: the trips rank decides before the pair rank', () => {
    const lowTripsHighPair = '3h 3s 3c Ah Ad';
    const highTripsLowPair = 'Jh Js Jc 2h 2d';
    expect(source).toContain(`<PokerCards cards="${lowTripsHighPair}" />`);
    expect(source).toContain(`<PokerCards cards="${highTripsLowPair}" />`);
    const a = evaluate(lowTripsHighPair);
    const b = evaluate(highTripsLowPair);
    expect(a.category).toBe('FULL_HOUSE');
    expect(b.category).toBe('FULL_HOUSE');
    expect(b.strength).toBeGreaterThan(a.strength);
  });
});

describe('starting-hand-ranking — the three anchor ranks (audit §3 #4, §6.1 #25)', () => {
  const source = lesson('starting-hand-ranking');
  const at = (rank: number) => {
    const entry = HAND_STRENGTH_BY_RANK[rank - 1];
    if (entry === undefined) throw new Error(`no entry at rank ${rank}`);
    return entry;
  };
  const isPair = (key: string) => at(1).comboCount === 6 && key.length === 2 && key[0] === key[1];

  it('every HAND_EQUITY_VS_RANDOM arg in the StatsRow is the class HAND_AT_RANK names beside it', () => {
    const pairs = [
      ...source.matchAll(
        /<Fact name="HAND_AT_RANK" arg="(\d+)" \/> · <Fact name="HAND_EQUITY_VS_RANDOM" arg="([^"]+)" \/>/gu,
      ),
    ].map(([, rank, key]) => [Number(rank), key!] as const);
    expect(pairs.map(([rank]) => rank)).toEqual([1, 8, 169]);
    for (const [rank, key] of pairs) expect(at(rank).key, `rank ${rank}`).toBe(key);
  });

  it('ranks 1..7 are all pocket pairs and rank 8 is the first non-pair, as the prose says', () => {
    for (let rank = 1; rank <= 7; rank += 1) expect(isPair(at(rank).key), at(rank).key).toBe(true);
    expect(isPair(at(8).key)).toBe(false);
    expect(source).toMatch(/1위부터 7위까지는 전부 포켓페어/u);
    expect(source).toMatch(
      /8위 <Fact name="HAND_AT_RANK" arg="8" \/>가 페어가 아닌 패 중 가장 높은/u,
    );
  });

  it('rank 169 expects "about a third" of the pot against a random hand', () => {
    expect(at(169).equity).toBeGreaterThan(0.3);
    expect(at(169).equity).toBeLessThan(0.36);
    expect(source).toMatch(/3분의 1 정도만/u);
  });

  it('the quiz option that types the combo count matches the COMBO_COUNT fact', () => {
    const option = /'실제 조합 ([\d,]+)가지 중 비율'/u.exec(source);
    expect(option?.[1]).toBe(factValue('COMBO_COUNT'));
  });
});
