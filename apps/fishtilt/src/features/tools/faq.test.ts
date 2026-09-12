import { describe, expect, it } from 'vitest';
import { COMBO_COUNT, HAND_CLASS_COUNT } from '@gto-self/strategy-core';
import {
  RANGE_LABEL,
  RANGE_PROVENANCE_SENTENCE,
  UNSUPPORTED_REASON_LABEL,
} from '../range/index.js';
import { METHODOLOGY_SENTENCE } from '../strength/index.js';
import { routeById } from '../../lib/routes.js';
import {
  EQUITY_FAQ,
  HAND_CHECKER_FAQ,
  OUTS_FAQ,
  POT_ODDS_FAQ,
  RANGE_FAQ,
  STARTING_HAND_FAQ,
} from './faq.js';

/*
 * The six tool FAQs are ONE system: what `FaqSection` renders and what WP-7's `FAQPage` block
 * will publish come from these arrays, so anything asserted here holds for both. The
 * properties below are the ones that make that safe — a question shaped like a question,
 * an answer that is publishable as a plain string, and no answer that quietly advises.
 */
const FAQS = [
  ['equity', EQUITY_FAQ],
  ['pot-odds', POT_ODDS_FAQ],
  ['outs', OUTS_FAQ],
  ['hand-checker', HAND_CHECKER_FAQ],
  ['range', RANGE_FAQ],
  ['starting-hand', STARTING_HAND_FAQ],
] as const;

describe('tool FAQ data', () => {
  it('gives every tool at least the two questions a FAQPage needs', () => {
    // `seo.spec.ts` fails a page that declares a `FAQPage` with fewer than two entries, so a
    // one-question tool would ship structured data that is refused rather than useful.
    for (const [name, items] of FAQS) {
      expect(items.length, name).toBeGreaterThanOrEqual(2);
    }
  });

  it('asks questions — every entry is interrogative and unique across the whole site', () => {
    const seen = new Set<string>();
    for (const [name, items] of FAQS) {
      for (const item of items) {
        expect(item.question.endsWith('?'), `${name}: ${item.question}`).toBe(true);
        expect(seen.has(item.question), `duplicate question: ${item.question}`).toBe(false);
        seen.add(item.question);
      }
    }
    // Six tools, no two of which compete for the same question in search.
    expect(seen.size).toBe(FAQS.reduce((total, [, items]) => total + items.length, 0));
  });

  it('keeps every answer publishable as a plain string', () => {
    for (const [name, items] of FAQS) {
      for (const item of items) {
        const where = `${name}: ${item.question}`;
        expect(item.answer.length, where).toBeGreaterThan(20);
        // A `FAQPage` answer is a string. Markup or a line break in one means the published
        // answer and the rendered answer are not the same thing (FISHTILT_STATE ruling 107).
        expect(item.answer, where).not.toMatch(/[<>]/u);
        expect(item.answer, where).not.toMatch(/[\n\r]/u);
        expect(item.answer.trim(), where).toBe(item.answer);
      }
    }
  });

  it('never says GTO and never tells the reader what to do', () => {
    for (const [name, items] of FAQS) {
      for (const item of items) {
        const text = `${item.question} ${item.answer}`;
        expect(text.toUpperCase(), name).not.toContain('GTO');
        // The site computes and refuses to advise. These are the imperatives that would be
        // the first to appear if that line ever slipped.
        for (const advice of ['콜하세요', '폴드하세요', '레이즈하세요', '콜하시면 됩니다']) {
          expect(text, `${name}: ${item.question}`).not.toContain(advice);
        }
      }
    }
  });

  it('links every tool to /about exactly once, in its own words', () => {
    const about = routeById('about');
    const labels: string[] = [];
    for (const [name, items] of FAQS) {
      const aboutLinks = items.filter((item) => item.link?.href === about.path);
      expect(aboutLinks, `${name} must reach /about from exactly one question`).toHaveLength(1);
      labels.push(aboutLinks[0]?.link?.label ?? '');
    }
    // WP-1 §6 priority 9 asked for a route to `/about` from each tool, not the same sentence
    // stamped six times. Two tools that ask the same thing ("무엇을 하고 하지 않나요") share a
    // label deliberately; the rest do not.
    expect(new Set(labels).size).toBeGreaterThanOrEqual(4);
    for (const label of labels) expect(label.length).toBeGreaterThan(4);
  });

  it('resolves every follow-on link through the registry, never to an external host', () => {
    for (const [name, items] of FAQS) {
      for (const item of items) {
        if (item.link === undefined) continue;
        const href = item.link.href;
        if (href === null) continue;
        expect(href, `${name}: ${item.question}`).toMatch(/^\/(?!\/)/u);
      }
    }
  });

  it('reads its poker facts from the packages rather than restating them', () => {
    const rangeAnswers = RANGE_FAQ.map((item) => item.answer).join(' ');
    expect(rangeAnswers).toContain(COMBO_COUNT.toLocaleString('ko-KR'));
    expect(rangeAnswers).toContain(String(HAND_CLASS_COUNT));
    expect(rangeAnswers).toContain(RANGE_PROVENANCE_SENTENCE);
    // The label travels with the table, never a bare "레인지" or an invented name.
    expect(RANGE_FAQ.some((item) => item.question.includes(RANGE_LABEL))).toBe(true);

    // The methodology sentence is the shared constant, not a paraphrase of it.
    expect(STARTING_HAND_FAQ.some((item) => item.answer === METHODOLOGY_SENTENCE)).toBe(true);
  });

  /*
   * The honest empty state, stated once. `RangeExplorer` renders
   * `UNSUPPORTED_REASON_LABEL.BB_HAS_NO_RFI_RANGE` when a reader selects BB; the FAQ answers
   * the same question with the SAME string rather than a second explanation that could drift
   * from the one the tool shows.
   */
  it('explains the BB empty state with the sentence the tool itself renders', () => {
    const answers = RANGE_FAQ.map((item) => item.answer);
    expect(answers).toContain(UNSUPPORTED_REASON_LABEL.BB_HAS_NO_RFI_RANGE);
  });
});

/*
 * WP-S3-14 additions. Two answers state something checkable against the packages: the
 * notation reading ("33+ is every pair from 33 up", "A5s-A2s is the four between") and the
 * ratio-to-percent identity. Both are parsed/computed here rather than trusted.
 */
describe('tool FAQ data — WP-S3-14 additions', () => {
  it('reads chart notation the way strategy-core parses it', async () => {
    const { parseHandClasses } = await import('@gto-self/strategy-core');
    const pairs = parseHandClasses('33+').map((hc) => hc.key);
    expect(pairs).toContain('33');
    expect(pairs).toContain('AA');
    expect(pairs).not.toContain('22');
    expect(parseHandClasses('33+').every((hc) => hc.kind === 'PAIR')).toBe(true);
    const suitedAces = parseHandClasses('A2s+').map((hc) => hc.key);
    expect(suitedAces).toContain('A2s');
    expect(suitedAces).toContain('AKs');
    expect(parseHandClasses('A2s+').every((hc) => hc.kind === 'SUITED')).toBe(true);
    expect(
      parseHandClasses('A5s-A2s')
        .map((hc) => hc.key)
        .sort(),
    ).toEqual(['A2s', 'A3s', 'A4s', 'A5s']);
    const item = RANGE_FAQ.find((entry) => entry.question.startsWith('33+'));
    expect(item?.answer).toContain('33부터 AA까지');
    expect(item?.answer).toContain('A2s부터 AKs까지');
  });

  it("states the ratio-to-percent identity with the walkthrough's own numbers", async () => {
    const { potOddsWalkthrough } = await import('./guide/potOddsGuide.js');
    const { formatPercent, formatMultiplier } = await import('./format.js');
    const walk = potOddsWalkthrough();
    const item = POT_ODDS_FAQ.find((entry) => entry.question.includes('비율은 어떻게'));
    expect(item).toBeDefined();
    expect(item?.answer).toContain(formatMultiplier(walk.odds.oddsAgainst));
    expect(item?.answer).toContain(formatPercent(walk.odds.requiredEquity));
    expect(1 / (walk.odds.oddsAgainst + 1)).toBeCloseTo(walk.odds.requiredEquity, 12);
  });

  it('every tool FAQ has between 5 and 8 questions — real next-questions, not padding', () => {
    for (const [, faq] of FAQS) {
      expect(faq.length).toBeGreaterThanOrEqual(5);
      expect(faq.length).toBeLessThanOrEqual(8);
    }
  });
});
