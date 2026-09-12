/**
 * @vitest-environment node
 *
 * WP-S3-10 batch L2 (poker-range, position, positions-6max, poker-actions, preflop) — the
 * sentences these lessons write ABOUT their computed numbers, re-derived from the shipped
 * datasets the way `claims.test.ts` does for the blog. Nothing here pins a copied literal:
 * every precondition is read off `resolveRange` / `factValue`, and the prose is then checked
 * against it. If the learning ranges were regenerated and (say) SB stopped being the widest
 * first-in table, the assertion that positions-6max says "SB가 가장 넓습니다" is what should
 * fail — not silently keep passing.
 *
 * Also the structural contract of the L2 batch: every lesson carries `<LessonGoals>` near the
 * top and `<LessonSummary>` before the FAQ section, the audit's required deterministic visual
 * is present, every BettingTimeline amount is labelled as an example size, and no percentage
 * is typed into the prose as a literal (CLAUDE.md rule 2 / AGENT_COMMON_RULES rule 3).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STRATEGY_POSITIONS, type StrategyPosition } from '@gto-self/strategy-core';
import { resolveRange } from '../features/range/index.js';
import { factValue } from './facts.js';
import { LEARN_RECORDS } from './registry/learn/index.js';

const CONTENT_DIR = fileURLToPath(new URL('../../content/learn', import.meta.url));
const L2_SLUGS = ['poker-range', 'position', 'positions-6max', 'poker-actions', 'preflop'] as const;

function mdx(slug: string): string {
  return readFileSync(join(CONTENT_DIR, `${slug}.mdx`), 'utf8');
}

function rfi(position: StrategyPosition) {
  return resolveRange({ heroPosition: position, spot: 'RFI', stackDepth: 100, tableSize: 6 });
}

/** Preflop order is a rule of the game; the lessons print it in this order. */
const PREFLOP_ORDER: readonly StrategyPosition[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

const WITH_RANGE = STRATEGY_POSITIONS.filter((position) => rfi(position).kind === 'RANGE');

function percentOf(position: StrategyPosition): number {
  const resolution = rfi(position);
  if (resolution.kind !== 'RANGE') throw new Error(`${position} has no first-in range`);
  return resolution.percentage;
}

describe('L2 — range-size claims re-derived from the shipped first-in ranges', () => {
  it('exactly the five non-BB seats have a first-in table, and BB does not', () => {
    expect(new Set(WITH_RANGE)).toEqual(new Set(['UTG', 'HJ', 'CO', 'BTN', 'SB']));
    expect(rfi('BB').kind).not.toBe('RANGE');
  });

  it('positions-6max: the table grows strictly along preflop order (UTG narrowest, SB widest)', () => {
    const ordered = PREFLOP_ORDER.filter((position) => WITH_RANGE.includes(position));
    for (let index = 1; index < ordered.length; index += 1) {
      const earlier = ordered[index - 1]!;
      const later = ordered[index]!;
      expect(percentOf(later), `${earlier} < ${later}`).toBeGreaterThan(percentOf(earlier));
    }
    const source = mdx('positions-6max');
    expect(source).toMatch(/UTG가 가장 좁고 SB가 가장 넓습니다/u);
    // The table row for BB carries the honest "no table" text, never a number.
    expect(source).toMatch(/position: 'BB'[\s\S]*?percent: '표 없음'/u);
  });

  it('positions-6max: 22 is carried by exactly one first-in table, and the prose says so', () => {
    expect(factValue('RFI_POSITIONS_WITH', '22')).toBe('SB');
    const source = mdx('positions-6max');
    expect(source).toContain('<Fact name="RFI_POSITIONS_WITH" arg="22" />뿐입니다');
    // The relation the record declares for this example.
    const record = LEARN_RECORDS.find((entry) => entry.id === 'positions-6max');
    expect(record?.relatedHands).toContain('hand-22');
  });

  it('position: AA is in every first-in table ("다섯 자리 전부") and 87s is not in UTG', () => {
    expect(factValue('RFI_POSITIONS_WITH', 'AA')).toBe(WITH_RANGE.join(' · '));
    expect(WITH_RANGE.length).toBe(5);
    expect(factValue('RFI_POSITIONS_WITH', '87s')).not.toMatch(/\bUTG\b/u);
    const source = mdx('position');
    expect(source).toContain(
      '<Fact name="RFI_POSITIONS_WITH" arg="AA" />, 즉 표가 있는 다섯 자리 전부',
    );
    expect(source).toContain('UTG는 이 목록에 없습니다');
  });

  it('position / poker-range: the UTG-vs-BTN StatsRow compares a narrower with a wider table', () => {
    expect(percentOf('BTN')).toBeGreaterThan(percentOf('UTG'));
    for (const slug of ['position', 'poker-range']) {
      const source = mdx(slug);
      expect(source, slug).toContain('<Fact name="RFI_PERCENT" arg="UTG" />');
      expect(source, slug).toContain('<Fact name="RFI_PERCENT" arg="BTN" />');
    }
  });

  it('poker-range FAQ: suited is never opened from fewer seats than offsuit, and some pairs are equal (WP-S3-19)', () => {
    // The FAQ used to say the suited side is used from MORE seats for every pair of cells;
    // the shipped tables have pairs with identical seat lists, so the prose now says "적은
    // 경우는 없습니다" and names both the split and the equal case.
    const positionsWith = (key: string): readonly string[] => {
      const rendered = factValue('RFI_POSITIONS_WITH', key);
      return rendered === '한 자리도 없습니다' ? [] : rendered.split(' · ');
    };
    const ranks = 'AKQJT98765432';
    let equal = 0;
    let split = 0;
    for (let hi = 0; hi < ranks.length; hi += 1) {
      for (let lo = hi + 1; lo < ranks.length; lo += 1) {
        const suited = positionsWith(`${ranks[hi]}${ranks[lo]}s`);
        const offsuit = positionsWith(`${ranks[hi]}${ranks[lo]}o`);
        for (const seat of offsuit) expect(suited, `${ranks[hi]}${ranks[lo]}`).toContain(seat);
        if (suited.length === offsuit.length) equal += 1;
        else split += 1;
      }
    }
    expect(equal + split).toBe(78);
    expect(equal).toBeGreaterThan(0);
    expect(split).toBeGreaterThan(0);
    expect(positionsWith('AKs')).toEqual(positionsWith('AKo'));
    const source = mdx('poker-range');
    expect(source).not.toMatch(/같은 무늬 쪽이 더 여러 자리에서 쓰입니다/u);
    expect(source).toMatch(/다른 무늬 쪽보다 적은 경우는 없습니다/u);
    expect(source).toMatch(/AKs와 AKo처럼 쓰이는 자리가 똑같은 칸도 있습니다/u);
  });

  it('preflop: 72o is in no first-in table, and the prose frames it as the empty answer', () => {
    expect(factValue('RFI_POSITIONS_WITH', '72o')).toBe('한 자리도 없습니다');
    expect(mdx('preflop')).toContain('아무 자리에서도 쓰지 않는 패도 있습니다');
  });
});

describe('L2 — lesson template and visual contract', () => {
  it('every L2 lesson has LessonGoals near the top and LessonSummary before the FAQ section', () => {
    for (const slug of L2_SLUGS) {
      const source = mdx(slug);
      const goals = source.indexOf('<LessonGoals');
      const summary = source.indexOf('<LessonSummary');
      const faq = source.indexOf('## 사람들이 자주 헷갈리는 부분');
      const firstH2 = source.indexOf('\n## ');
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
          // The grid's name (13×13), the fixed range-condition label (6인 · 100BB), the big
          // blind's own unit (1BB) and the action names 3벳/4벳 (3-Bet/4-Bet — the digit is
          // part of the term, exactly as the glossary spells `three-bet`/`four-bet`) are
          // labels, not poker numbers. Everything else with a digit is a typed number.
          const withoutLabels = item.replace(/13×13|6인|100BB|1BB|[34](?:벳|-?[Bb]et)/gu, '');
          expect(withoutLabels, `${slug}: "${item}" carries a typed digit`).not.toMatch(/\d/u);
        }
      }
    }
  });

  it('carries the deterministic visual the content audit (§3) requires for each lesson', () => {
    const required: Readonly<Record<(typeof L2_SLUGS)[number], readonly string[]>> = {
      'poker-range': ['<RangeMatrixMini', '<StatsRow'],
      position: ['<PositionDiagram', '<StatsRow', '<RangeMatrixMini'],
      'positions-6max': ['<PositionDiagram', '<DataTable', '<RangeMatrixMini'],
      'poker-actions': ['<BettingTimeline', '<DataTable'],
      preflop: ['<BettingTimeline', '<ComparisonTable', '<RangeMatrixMini'],
    };
    for (const slug of L2_SLUGS) {
      const source = mdx(slug);
      for (const tag of required[slug]) expect(source, `${slug}: ${tag}`).toContain(tag);
    }
    // poker-actions draws one plain street and one check-raise; preflop draws limp vs open.
    expect(mdx('poker-actions').match(/<BettingTimeline/gu)?.length).toBe(2);
    expect(mdx('preflop').match(/<BettingTimeline/gu)?.length).toBe(2);
  });

  it('every BettingTimeline amount is an example size, and the limp amount equals the big blind', () => {
    for (const slug of ['poker-actions', 'preflop']) {
      expect(mdx(slug), slug).toMatch(/예시 크기/u);
    }
    const preflop = mdx('preflop');
    const limp = /<BettingTimeline[\s\S]*?label="림프 예시"[\s\S]*?\/>/u.exec(preflop)?.[0] ?? '';
    const bbAmount = /position: 'BB'[^}]*amount: '([^']+)'/u.exec(limp)?.[1];
    const limpAmount =
      /note: '림프'[^}]*/u.exec(limp) === null
        ? undefined
        : /position: 'UTG'[^}]*amount: '([^']+)'/u.exec(limp)?.[1];
    expect(bbAmount).toBe('1BB');
    expect(limpAmount, 'limp = the big blind amount (audit NUMBER-RISK #22)').toBe(bbAmount);
  });

  it('never types a percentage or a range-size count as a literal; every number is a <Fact>', () => {
    for (const slug of L2_SLUGS) {
      const prose = mdx(slug).replace(/<Fact\b[^>]*\/>/gu, '');
      expect(prose, `${slug}: literal percentage`).not.toMatch(/\d+(?:\.\d+)?\s*%/u);
      expect(prose, `${slug}: literal combo count`).not.toMatch(
        /\b(?:226|280|368|568|622|1,?326)\b/u,
      );
    }
  });

  it('poker-range and preflop state the unsupported situations as unsupported', () => {
    for (const slug of ['poker-range', 'preflop']) {
      const source = mdx(slug);
      expect(source, slug).toMatch(/지원하지 않/u);
      expect(source, slug).toMatch(/First In/u);
      expect(source, slug).toMatch(/학습용 기본 레인지/u);
    }
  });

  it('the L2 records point at existing hands and articles that the prose actually uses', () => {
    const expectHands: Readonly<Record<string, readonly string[]>> = {
      position: ['hand-aa'],
      'positions-6max': ['hand-22'],
      'poker-actions': ['hand-ajs'],
      preflop: ['hand-aqo'],
      'poker-range': ['hand-aks', 'hand-ako'],
    };
    for (const slug of L2_SLUGS) {
      const record = LEARN_RECORDS.find((entry) => entry.slug === slug);
      expect(record, slug).toBeDefined();
      expect(record?.relatedHands, slug).toEqual(expectHands[slug]);
      // Each hand L2 added is a worked example in the lesson (a <PokerCards> or a <Fact arg>);
      // poker-range's pre-existing AKs/AKo pair is related through `blog-aks-vs-ako` instead.
      for (const hand of (record?.relatedHands ?? []).filter((id) => id !== 'hand-ako')) {
        const key = hand
          .replace(/^hand-/u, '')
          .toUpperCase()
          .replace(/S$/u, 's')
          .replace(/O$/u, 'o');
        expect(mdx(slug), `${slug}: ${key}`).toContain(key);
      }
    }
  });
});
