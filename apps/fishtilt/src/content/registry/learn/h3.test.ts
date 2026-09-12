/**
 * @vitest-environment node
 *
 * WP-H3's own batch gate — same reasoning as `h1.test.ts`/`h2.test.ts`'s sibling files: this
 * workspace's `vitest.config.ts` registers no MDX transform for the `fishtilt` project, so
 * importing a real `.mdx` file (even one this app already builds and ships, like
 * `poker-range.mdx`) fails at Vite's import-analysis step before any JSX runs. That is a
 * pre-existing gap in a shared root file, out of this batch's file boundary, not something to
 * paper over with a mock that would prove nothing real.
 *
 * So "renders without throwing" is verified the way `content.test.ts` verifies every OTHER
 * kind of content: by reading the raw `.mdx` source as text and statically checking every
 * property a render would otherwise catch — every `<Term>` resolves to a real, related
 * glossary id and is used at most once; every `<PokerCards cards="...">` parses as real
 * cards; every `<Fact>` name/arg pair actually computes (run through the real `factValue`,
 * never reasoned about); every component named is on the allow-list; the threshold this
 * batch claims (`indexable: true`) is actually cleared.
 *
 * Per ruling 26 (`docs/FISHTILT_STATE.md`): this batch's five owned slugs are a fixed,
 * permanent assignment from WP-G4/the content plan §7 "H3", not a fact about the site's
 * current state, so listing them as a literal fixture here does not go stale.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCards } from '@gto-self/shared';
import { MDX_COMPONENT_ALLOW_LIST } from '../../allowList.js';
import { factValue, type FactName } from '../../facts.js';
import { ROUTES } from '../../../lib/routes.js';
import { LEARN_RECORDS } from './index.js';
import { LEARN_H3_RECORDS } from './h3.js';
import {
  estimateReadMinutes,
  measureContent,
  unmetIndexRequirements,
  type ContentMeasurement,
} from '../../threshold.js';
import type { LearnRecord } from '../../types.js';

const CONTENT_DIR = fileURLToPath(new URL('../../../../content/learn/', import.meta.url));
const MDX_MAP_SOURCE = readFileSync(
  fileURLToPath(new URL('../../learn/h3.ts', import.meta.url)),
  'utf8',
);

/** The five slugs `docs/FISHTILT_CONTENT_PLAN.md` §7 "H3" assigns to this batch. Fixed — see
 * the module doc on why this is a safe literal fixture rather than a derived one. */
const OWNED_SLUGS = ['flop-turn-river', 'three-bet', 'equity', 'pot-odds', 'outs'] as const;

const ALLOWED_COMPONENTS = new Set<string>(MDX_COMPONENT_ALLOW_LIST);
const LEARN_BY_ID = new Map(LEARN_RECORDS.map((record) => [record.id, record]));

function mdxSourceFor(record: LearnRecord): string {
  return readFileSync(`${CONTENT_DIR}${record.slug}.mdx`, 'utf8');
}

const MEASURED: ReadonlyMap<string, ContentMeasurement> = new Map(
  LEARN_H3_RECORDS.map((record) => [record.id, measureContent(mdxSourceFor(record))]),
);

function measurementOf(record: LearnRecord): ContentMeasurement {
  const measurement = MEASURED.get(record.id);
  if (measurement === undefined) throw new Error(`no measurement for ${record.id}`);
  return measurement;
}

describe('learn batch H3 — registry', () => {
  it('registers exactly the five owned slugs, once each, and never lesson 06', () => {
    const slugs = LEARN_H3_RECORDS.map((record) => record.slug);
    expect(new Set(slugs)).toEqual(new Set(OWNED_SLUGS));
    expect(slugs.length).toBe(OWNED_SLUGS.length);
    expect(slugs).not.toContain('poker-range');
  });

  it('every owned record is PUBLISHED, indexable, with a positive readMinutes', () => {
    for (const record of LEARN_H3_RECORDS) {
      expect(record.status, record.id).toBe('PUBLISHED');
      expect(record.indexable, record.id).toBe(true);
      expect(record.readMinutes, record.id).not.toBeNull();
      expect(record.readMinutes ?? 0, record.id).toBeGreaterThan(0);
    }
  });

  it('carries the outbound links a learn record needs (build spec §37 / plan §5)', () => {
    for (const record of LEARN_H3_RECORDS) {
      expect(record.relatedTools.length, `${record.id}: relatedTools`).toBeGreaterThanOrEqual(1);
      expect(record.relatedConcepts.length, `${record.id}: relatedConcepts`).toBeGreaterThanOrEqual(
        2,
      );
      const nextSteps = record.nextLessons.length + record.relatedArticles.length;
      expect(nextSteps, `${record.id}: next step`).toBeGreaterThanOrEqual(1);
      // Every H3 lesson is order 11-15, so — unlike lesson 01 — a prerequisite is required.
      expect(record.prerequisites.length, `${record.id}: prerequisites`).toBeGreaterThanOrEqual(1);
    }
  });

  it('every H3 tool CTA points at a route that is actually available today', () => {
    // All six tools shipped before this batch was written (`docs/FISHTILT_STATE.md` ruling
    // 26 / WP-E2). The content plan's per-lesson fallback instructions (drafted while
    // toolEquity/toolStartingHand/toolHandChecker were still `available: false`) are stale on
    // this point; this batch links each lesson's own tool directly rather than a fallback.
    const availableById = new Map(ROUTES.map((route) => [route.id, route.available]));
    for (const record of LEARN_H3_RECORDS) {
      for (const toolId of record.relatedTools) {
        expect(availableById.get(toolId), `${record.id} -> ${toolId}`).toBe(true);
      }
    }
  });
});

describe('learn batch H3 — MDX map registration', () => {
  it('imports every owned slug from its own .mdx file', () => {
    for (const slug of OWNED_SLUGS) {
      expect(MDX_MAP_SOURCE, slug).toMatch(
        new RegExp(`from '\\.\\./\\.\\./\\.\\./content/learn/${slug}\\.mdx'`, 'u'),
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
    const exportBlock = MDX_MAP_SOURCE.slice(MDX_MAP_SOURCE.indexOf('LEARN_H3_MDX'));
    const keys = [...exportBlock.matchAll(/^\s*'?([a-z0-9-]+)'?:\s*\w+,/gmu)].map(
      ([, key]) => key!,
    );
    expect(new Set(keys)).toEqual(new Set(OWNED_SLUGS));
  });
});

describe('learn batch H3 — MDX prose (content.test.ts equivalents, scoped to this batch)', () => {
  it('every owned slug has an MDX file on disk', () => {
    for (const record of LEARN_H3_RECORDS) {
      expect(() => mdxSourceFor(record), record.id).not.toThrow();
    }
  });

  it('clears the learn index threshold it claims (§40)', () => {
    const failures: string[] = [];
    for (const record of LEARN_H3_RECORDS) {
      const unmet = unmetIndexRequirements(record, measurementOf(record));
      if (unmet.length > 0) failures.push(`${record.id}: ${unmet.join('; ')}`);
    }
    expect(failures).toEqual([]);
  });

  it('states the reading time its own text implies', () => {
    for (const record of LEARN_H3_RECORDS) {
      const expected = estimateReadMinutes(measurementOf(record).proseCharacters);
      expect(record.readMinutes, record.id).toBe(expected);
    }
  });

  it('contains no import/export and no top-level heading', () => {
    for (const record of LEARN_H3_RECORDS) {
      const measurement = measurementOf(record);
      expect(measurement.hasEsmStatement, record.id).toBe(false);
      expect(measurement.hasTopLevelHeading, record.id).toBe(false);
    }
  });

  it('names only allow-listed components', () => {
    const offenders: string[] = [];
    for (const record of LEARN_H3_RECORDS) {
      for (const name of measurementOf(record).componentUses) {
        if (!ALLOWED_COMPONENTS.has(name)) offenders.push(`${record.id}: <${name}>`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('embeds a <ToolCTA> in the prose itself (§35 mid-content, not only in relations)', () => {
    for (const record of LEARN_H3_RECORDS) {
      expect(mdxSourceFor(record), record.id).toMatch(/<ToolCTA\b/u);
    }
  });

  it('every <Term> is used once, resolves to a real glossary entry, and is a declared relatedConcept', () => {
    const problems: string[] = [];
    for (const record of LEARN_H3_RECORDS) {
      const source = mdxSourceFor(record);
      const ids = [...source.matchAll(/<Term\s+id="([^"]+)"/gu)].map(([, id]) => id!);
      const counts = new Map<string, number>();
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
      for (const [id, count] of counts) {
        if (count > 1) problems.push(`${record.id}: <Term id="${id}"> used ${count}x`);
        if (!record.relatedConcepts.includes(id)) {
          problems.push(`${record.id}: <Term id="${id}"> is not in relatedConcepts`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('every <PokerCards cards="..."> parses as legal, non-duplicated cards', () => {
    const offenders: string[] = [];
    for (const record of LEARN_H3_RECORDS) {
      const source = mdxSourceFor(record);
      for (const [, cards] of source.matchAll(/<PokerCards\s+cards="([^"]+)"/gu)) {
        const parsed = parseCards(cards!);
        if (!parsed.ok) offenders.push(`${record.id}: cards="${cards}" -> ${parsed.error}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every <Fact> name/arg actually computes (run through the real facts.ts, never reasoned)', () => {
    const offenders: string[] = [];
    for (const record of LEARN_H3_RECORDS) {
      const source = mdxSourceFor(record);
      for (const [, name, arg] of source.matchAll(
        /<Fact\s+name="([^"]+)"(?:\s+arg="([^"]+)")?/gu,
      )) {
        try {
          factValue(name as FactName, arg);
        } catch (error) {
          offenders.push(`${record.id}: <Fact name="${name}" arg="${arg}"> threw: ${String(error)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every relation in prose resolves against the full content graph', () => {
    for (const record of LEARN_H3_RECORDS) {
      for (const id of [...record.prerequisites, ...record.nextLessons]) {
        expect(LEARN_BY_ID.get(id), `${record.id} -> ${id}`).toBeDefined();
      }
    }
  });

  it('never types the banned GTO word, and never states an unconditional "always/must" rule', () => {
    for (const record of LEARN_H3_RECORDS) {
      const source = mdxSourceFor(record);
      expect(source, record.id).not.toMatch(/GTO/iu);
      expect(source, record.id).not.toMatch(/(항상|무조건|반드시)\s*[^.?]*해야\s*합니다/u);
    }
  });

  it('never asserts a profitability/strength verdict on raw equity or pot-odds numbers (rule 0.10)', () => {
    for (const record of LEARN_H3_RECORDS) {
      const source = mdxSourceFor(record);
      expect(source, record.id).not.toMatch(/수익성\s*있|이득입니다|플러스\s*EV/u);
    }
  });

  it('lesson 12 (three-bet) never shows a 3-bet range chart (settled decision 2)', () => {
    // No verified facing-a-3-bet range dataset exists in this repository. The lesson may
    // explain the counting convention (ruling 18) but must not render a RangeMatrixMini as
    // if it depicted a 3-bet range, and must say the range itself is not yet available.
    const record = LEARN_H3_RECORDS.find((entry) => entry.id === 'three-bet');
    expect(record).toBeDefined();
    if (record === undefined) return;
    const source = mdxSourceFor(record);
    expect(source, 'must not embed a range chart').not.toMatch(/<RangeMatrixMini\b/u);
    expect(source, 'must say the facing-3bet range is not ready').toMatch(/준비/u);
  });

  it('lesson 13 (equity) never slides equity into a call/profitability verdict (rule 0.10 / brief #3)', () => {
    const record = LEARN_H3_RECORDS.find((entry) => entry.id === 'equity');
    expect(record).toBeDefined();
    if (record === undefined) return;
    const source = mdxSourceFor(record);
    // A negated rhetorical form ("콜해야 한다는 뜻은 아닙니다" — the same safe pattern the
    // published lesson 06 uses for "무조건 좋은 패인가요? 무조건은 아닙니다") is fine; only an
    // unnegated imperative is banned.
    expect(source, 'must not instruct the reader to call').not.toMatch(/콜(해야|하세요|하십시오)\s*합니다(?!는)/u);
    expect(source, 'must not instruct the reader to call').not.toContain('콜하세요');
    expect(source, 'must not instruct the reader to call').not.toContain('콜하십시오');
  });

  it('lesson 15 (outs) shows the rule-of-2-and-4 shortcut beside the exact figure, never as the answer', () => {
    const record = LEARN_H3_RECORDS.find((entry) => entry.id === 'outs');
    expect(record).toBeDefined();
    if (record === undefined) return;
    const source = mdxSourceFor(record);
    expect(source, 'must cite an exact OUTS_PROB target').toMatch(
      /<Fact\s+name="OUTS_PROB"\s+arg="[^"]*\|(NEXT|RIVER)"/u,
    );
    expect(source, 'must cite a SHORTCUT_* target beside it').toMatch(
      /<Fact\s+name="OUTS_PROB"\s+arg="[^"]*\|SHORTCUT_(NEXT|RIVER)"/u,
    );
  });
});
