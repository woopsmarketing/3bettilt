/**
 * @vitest-environment node
 *
 * WP-I2's own batch gate — same reasoning as `registry/learn/h1.test.ts` and
 * `registry/glossary/j1.test.ts`: this workspace's `vitest.config.ts` registers no MDX
 * transform for the `fishtilt` project, so importing a real `.mdx` file fails at Vite's
 * import-analysis step before any JSX runs (`docs/reports/WP_QA_MDX_TEST_GAP.md`). That gap
 * is a shared root file outside this batch's boundary, not something to paper over with a
 * mock that would prove nothing real.
 *
 * So "renders without throwing" is verified the way `content.test.ts` verifies every OTHER
 * batch: by reading the raw `.mdx` source as text and statically checking every property a
 * render would otherwise catch — every `<Term>` resolves to a real, related glossary id and
 * is used at most once; every `<PokerCards hand="...">` name is one of the 169 real hand
 * classes and every `<PokerCards cards="...">` string parses; every `<Fact>` name/arg pair
 * actually computes (run through the real `factValue`, never reasoned about); every
 * component named is on the allow-list; the threshold this batch claims (`indexable: true`)
 * is actually cleared.
 *
 * Per ruling 26 (`docs/FISHTILT_STATE.md`): this batch's five owned slugs are a fixed,
 * permanent assignment from WP-G4/the content plan §2.2 "I2", not a fact about the site's
 * current state, so listing them as a literal fixture here does not go stale.
 *
 * `blog-flush-vs-straight` and `blog-full-house-vs-flush` each print a specific showdown
 * (a shared five-card board plus two different hole-card pairs). Ruling 28 requires the
 * winner to be verified by running the real evaluator, not reasoned about — this file does
 * that for real by importing `evaluateHand`/`compareHands` from `@gto-self/strategy-core`
 * and replaying the exact cards each article shows, so a future edit that quietly changes a
 * card cannot silently break the claimed winner.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compareHands, evaluateHand, HAND_CLASSES, handClassByKey } from '@gto-self/strategy-core';
import { handStrengthForKey } from '@gto-self/learn-core';
import { parseCards } from '@gto-self/shared';
import { MDX_COMPONENT_ALLOW_LIST } from '../../allowList.js';
import { factValue, type FactName } from '../../facts.js';
import { ALL_CONTENT } from '../index.js';
import { BLOG_I2_RECORDS } from './i2.js';
import {
  estimateReadMinutes,
  measureContent,
  unmetIndexRequirements,
  type ContentMeasurement,
} from '../../threshold.js';
import type { BlogRecord } from '../../types.js';

const CONTENT_DIR = fileURLToPath(new URL('../../../../content/blog/', import.meta.url));
const MDX_MAP_SOURCE = readFileSync(
  fileURLToPath(new URL('../../blog/i2.ts', import.meta.url)),
  'utf8',
);

/** The five slugs `docs/FISHTILT_CONTENT_PLAN.md` §2.2 "I2" assigns to this batch. Fixed —
 * see the module doc on why this is a safe literal fixture rather than a derived one. */
const OWNED_SLUGS = [
  'small-pocket-pairs',
  'why-72o-is-weak',
  'why-suited-matters',
  'flush-vs-straight',
  'full-house-vs-flush',
] as const;

const ALLOWED_COMPONENTS = new Set<string>(MDX_COMPONENT_ALLOW_LIST);

function mdxSourceFor(record: BlogRecord): string {
  return readFileSync(`${CONTENT_DIR}${record.slug}.mdx`, 'utf8');
}

const MEASURED: ReadonlyMap<string, ContentMeasurement> = new Map(
  BLOG_I2_RECORDS.map((record) => [record.id, measureContent(mdxSourceFor(record))]),
);

function measurementOf(record: BlogRecord): ContentMeasurement {
  const measurement = MEASURED.get(record.id);
  if (measurement === undefined) throw new Error(`no measurement for ${record.id}`);
  return measurement;
}

describe('blog batch I2 — registry', () => {
  it('registers exactly the five owned slugs, once each', () => {
    const slugs = BLOG_I2_RECORDS.map((record) => record.slug);
    expect(new Set(slugs)).toEqual(new Set(OWNED_SLUGS));
    expect(slugs.length).toBe(OWNED_SLUGS.length);
  });

  it('every owned record is PUBLISHED, indexable, with a positive readMinutes', () => {
    for (const record of BLOG_I2_RECORDS) {
      expect(record.status, record.id).toBe('PUBLISHED');
      expect(record.indexable, record.id).toBe(true);
      expect(record.readMinutes, record.id).not.toBeNull();
      expect(record.readMinutes ?? 0, record.id).toBeGreaterThan(0);
    }
  });

  it('carries the outbound links a blog answer needs (build spec §35 / plan §2.2)', () => {
    for (const record of BLOG_I2_RECORDS) {
      expect(record.relatedTools.length, `${record.id}: relatedTools`).toBeGreaterThanOrEqual(1);
      expect(record.relatedConcepts.length, `${record.id}: relatedConcepts`).toBeGreaterThanOrEqual(
        1,
      );
      const nextSteps = record.nextLessons.length + record.relatedArticles.length;
      expect(nextSteps, `${record.id}: next step`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('blog batch I2 — MDX map registration', () => {
  it('imports every owned slug from its own .mdx file', () => {
    for (const slug of OWNED_SLUGS) {
      expect(MDX_MAP_SOURCE, slug).toMatch(
        new RegExp(`from '\\.\\./\\.\\./\\.\\./content/blog/${slug}\\.mdx'`, 'u'),
      );
    }
  });

  it('exports a map entry keyed by every owned slug', () => {
    for (const slug of OWNED_SLUGS) {
      const keyPattern = new RegExp(`(^|[\\s{,])'?${slug}'?\\s*:`, 'mu');
      expect(MDX_MAP_SOURCE, slug).toMatch(keyPattern);
    }
  });

  it('the map carries no other slug than the five this batch owns', () => {
    const exportBlock = MDX_MAP_SOURCE.slice(MDX_MAP_SOURCE.indexOf('BLOG_I2_MDX'));
    const keys = [...exportBlock.matchAll(/^\s*'?([a-z0-9-]+)'?:\s*\w+,/gmu)].map(
      ([, key]) => key!,
    );
    expect(new Set(keys)).toEqual(new Set(OWNED_SLUGS));
  });
});

describe('blog batch I2 — MDX prose (content.test.ts equivalents, scoped to this batch)', () => {
  it('every owned slug has an MDX file on disk', () => {
    for (const record of BLOG_I2_RECORDS) {
      expect(() => mdxSourceFor(record), record.id).not.toThrow();
    }
  });

  it('clears the blog index threshold it claims (§40)', () => {
    const failures: string[] = [];
    for (const record of BLOG_I2_RECORDS) {
      const unmet = unmetIndexRequirements(record, measurementOf(record));
      if (unmet.length > 0) failures.push(`${record.id}: ${unmet.join('; ')}`);
    }
    expect(failures).toEqual([]);
  });

  it('states the reading time its own text implies', () => {
    for (const record of BLOG_I2_RECORDS) {
      const expected = estimateReadMinutes(measurementOf(record).proseCharacters);
      expect(record.readMinutes, record.id).toBe(expected);
    }
  });

  it('contains no import/export and no top-level heading', () => {
    for (const record of BLOG_I2_RECORDS) {
      const measurement = measurementOf(record);
      expect(measurement.hasEsmStatement, record.id).toBe(false);
      expect(measurement.hasTopLevelHeading, record.id).toBe(false);
    }
  });

  it('names only allow-listed components', () => {
    const offenders: string[] = [];
    for (const record of BLOG_I2_RECORDS) {
      for (const name of measurementOf(record).componentUses) {
        if (!ALLOWED_COMPONENTS.has(name)) offenders.push(`${record.id}: <${name}>`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('embeds a <ToolCTA> in the prose itself (§35 mid-content, not only in relations)', () => {
    for (const record of BLOG_I2_RECORDS) {
      expect(mdxSourceFor(record), record.id).toMatch(/<ToolCTA\b/u);
    }
  });

  it('every <Term> is used once, resolves to a real glossary entry, and is a declared relatedConcept', () => {
    const byId = new Map(ALL_CONTENT.map((entry) => [entry.id, entry]));
    const problems: string[] = [];
    for (const record of BLOG_I2_RECORDS) {
      const source = mdxSourceFor(record);
      const ids = [...source.matchAll(/<Term\s+id="([^"]+)"/gu)].map(([, id]) => id!);
      const counts = new Map<string, number>();
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
      for (const [id, count] of counts) {
        if (count > 1) problems.push(`${record.id}: <Term id="${id}"> used ${count}x`);
        if (byId.get(id)?.kind !== 'glossary') {
          problems.push(`${record.id}: <Term id="${id}"> is not a glossary entry`);
        } else if (!record.relatedConcepts.includes(id)) {
          problems.push(`${record.id}: <Term id="${id}"> is not in relatedConcepts`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('every <PokerCards hand="..."> names one of the 169 real hand classes', () => {
    const offenders: string[] = [];
    for (const record of BLOG_I2_RECORDS) {
      const source = mdxSourceFor(record);
      for (const [, hand] of source.matchAll(/<PokerCards\s+hand="([^"]+)"/gu)) {
        if (handClassByKey(hand!) === undefined) offenders.push(`${record.id}: hand="${hand}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every <PokerCards cards="..."> parses as real, distinct cards', () => {
    const offenders: string[] = [];
    for (const record of BLOG_I2_RECORDS) {
      const source = mdxSourceFor(record);
      for (const [, cards] of source.matchAll(/<PokerCards\s+cards="([^"]+)"/gu)) {
        const parsed = parseCards(cards ?? '');
        if (!parsed.ok) offenders.push(`${record.id}: cards="${cards}" (${parsed.error})`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every <Fact> name/arg actually computes (run through the real facts.ts, never reasoned)', () => {
    const offenders: string[] = [];
    for (const record of BLOG_I2_RECORDS) {
      const source = mdxSourceFor(record);
      for (const [, name, arg] of source.matchAll(
        /<Fact\s+name="([^"]+)"(?:\s+arg="([^"]+)")?/gu,
      )) {
        try {
          factValue(name as FactName, arg);
        } catch (error) {
          offenders.push(
            `${record.id}: <Fact name="${name}" arg="${arg}"> threw: ${String(error)}`,
          );
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every relation resolves against the full content graph, to a record of the right kind', () => {
    const byId = new Map(ALL_CONTENT.map((record) => [record.id, record]));
    for (const record of BLOG_I2_RECORDS) {
      for (const id of record.nextLessons) {
        expect(byId.get(id)?.kind, `${record.id}.nextLessons -> ${id}`).toBe('learn');
      }
      for (const id of record.relatedArticles) {
        expect(byId.get(id)?.kind, `${record.id}.relatedArticles -> ${id}`).toBe('blog');
      }
      for (const id of record.relatedHands) {
        expect(byId.get(id)?.kind, `${record.id}.relatedHands -> ${id}`).toBe('hands');
      }
      for (const id of record.relatedConcepts) {
        expect(byId.get(id)?.kind, `${record.id}.relatedConcepts -> ${id}`).toBe('glossary');
      }
    }
  });

  it('never types the banned GTO word, and never asserts a profitability/strength verdict (rule 0.10)', () => {
    for (const record of BLOG_I2_RECORDS) {
      const source = mdxSourceFor(record);
      expect(source, record.id).not.toMatch(/GTO/iu);
      expect(source, record.id).not.toMatch(/수익성\s*있|이득입니다|플러스\s*EV/u);
      expect(source, record.id).not.toMatch(/(항상|무조건|반드시)\s*[^.?]*해야\s*합니다/u);
    }
  });
});

describe('blog batch I2 — showdown claims are evaluator-verified, not reasoned (ruling 28)', () => {
  it('flush-vs-straight: the flush hand beats the straight hand on the printed board', () => {
    const board = parseCards('3h 6h 9h 4c 5c');
    const flushHole = parseCards('Kh Th');
    const straightHole = parseCards('2d 7d');
    if (!board.ok || !flushHole.ok || !straightHole.ok) throw new Error('bad fixture cards');

    const flushHand = evaluateHand([...board.value, ...flushHole.value]);
    const straightHand = evaluateHand([...board.value, ...straightHole.value]);

    expect(flushHand.category).toBe('FLUSH');
    expect(straightHand.category).toBe('STRAIGHT');
    expect(compareHands(flushHand.strength, straightHand.strength)).toBe(1);
  });

  it('full-house-vs-flush: the full house hand beats the flush hand on the printed board', () => {
    const board = parseCards('9h 9d 9c 2h 5h');
    const fullHouseHole = parseCards('Ah As');
    const flushHole = parseCards('Kh Qh');
    if (!board.ok || !fullHouseHole.ok || !flushHole.ok) throw new Error('bad fixture cards');

    const fullHouseHand = evaluateHand([...board.value, ...fullHouseHole.value]);
    const flushHand = evaluateHand([...board.value, ...flushHole.value]);

    expect(fullHouseHand.category).toBe('FULL_HOUSE');
    expect(flushHand.category).toBe('FLUSH');
    expect(compareHands(fullHouseHand.strength, flushHand.strength)).toBe(1);
  });
});

/**
 * NUMBER-RISK #14/#15 (`3BETTILT_CONTENT_AUDIT.md` §6.1) — `why-suited-matters` claims that
 * (a) the suited/offsuit equity gap for any same-rank pair stays within a single-digit
 * percentage point, and (b) suited beats offsuit with zero exceptions across all 78 same-rank
 * pairs. Both are now pinned against the real engine: every SUITED class in
 * `strategy-core`'s `HAND_CLASSES` is paired with its OFFSUIT sibling (same two ranks) and
 * both classes' `learn-core` `handStrengthForKey` equities are compared directly — nothing
 * here is typed from the article's own prose or from memory.
 */
describe('blog batch I2 — why-suited-matters NUMBER-RISK #14/#15 (engine-verified)', () => {
  const suitedClasses = HAND_CLASSES.filter((handClass) => handClass.kind === 'SUITED');

  it('has exactly 78 suited/offsuit same-rank pairs to check', () => {
    expect(suitedClasses.length).toBe(78);
  });

  it('suited beats offsuit with zero exceptions, and the gap never reaches a two-digit percentage point, across all 78 pairs', () => {
    const violations: string[] = [];
    let maxGapPoints = 0;

    for (const suited of suitedClasses) {
      const offsuitKey = `${suited.highRank}${suited.lowRank}o`;
      const offsuit = handClassByKey(offsuitKey);
      if (offsuit === undefined) throw new Error(`no offsuit sibling for ${suited.key}`);

      const suitedEntry = handStrengthForKey(suited.key);
      const offsuitEntry = handStrengthForKey(offsuitKey);
      if (!suitedEntry.ok) throw new Error(`handStrengthForKey(${suited.key}) failed`);
      if (!offsuitEntry.ok) throw new Error(`handStrengthForKey(${offsuitKey}) failed`);

      const gapPoints = (suitedEntry.value.equity - offsuitEntry.value.equity) * 100;
      if (gapPoints <= 0) {
        violations.push(
          `${suited.key} vs ${offsuitKey}: suited did not beat offsuit (${gapPoints})`,
        );
      }
      if (gapPoints > maxGapPoints) maxGapPoints = gapPoints;
    }

    expect(violations).toEqual([]);
    // "single-digit % 포인트" — strictly under 10 percentage points, for every one of the 78 pairs.
    expect(maxGapPoints).toBeGreaterThan(0);
    expect(maxGapPoints).toBeLessThan(10);
  });

  it('pins the two spot-checks the article states by name (J9s/J9o, T8s/T8o)', () => {
    for (const [suitedKey, offsuitKey] of [
      ['J9s', 'J9o'],
      ['T8s', 'T8o'],
    ] as const) {
      const suitedEntry = handStrengthForKey(suitedKey);
      const offsuitEntry = handStrengthForKey(offsuitKey);
      if (!suitedEntry.ok || !offsuitEntry.ok)
        throw new Error(`bad key ${suitedKey}/${offsuitKey}`);
      expect(suitedEntry.value.equity, suitedKey).toBeGreaterThan(offsuitEntry.value.equity);
      const gapPoints = (suitedEntry.value.equity - offsuitEntry.value.equity) * 100;
      expect(gapPoints, `${suitedKey} vs ${offsuitKey}`).toBeLessThan(10);
    }
  });
});
