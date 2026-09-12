/**
 * The per-batch gate every hands batch test runs (`k1.test.ts` … `k4.test.ts`) — the
 * assertions the former single `e3.test.ts` carried, parameterised by batch so they are
 * written once and none of them is weakened in the split (WP-S3-13a).
 *
 * Same reasoning as `registry/blog/i2.test.ts` and `registry/learn/h1.test.ts`: this
 * workspace's `vitest.config.ts` registers no MDX transform for the `fishtilt` project, so
 * importing a real `.mdx` file fails at Vite's import-analysis step before any JSX runs
 * (`docs/reports/WP_QA_MDX_TEST_GAP.md`). So "renders without throwing" is verified the way
 * `content.test.ts` verifies every OTHER batch: by reading the raw `.mdx` source as text and
 * statically checking every property a render would otherwise catch — every `<Term>`
 * resolves to a real, related glossary id and is used at most once; every
 * `<PokerCards hand="...">` name is one of the 169 real hand classes; every `<Fact>` name/arg
 * pair actually computes (run through the real `factValue`, never reasoned about); every
 * component named is on the allow-list; the threshold this batch claims (`indexable: true`)
 * is actually cleared.
 *
 * Also exported: `rank`/`equity` readers pulled live from the strength dataset via
 * `factValue` (never hand-typed) for the ruling-28 comparative-claim pins each batch file
 * adds for its own prose.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { handClassByKey } from '@gto-self/strategy-core';
import { MDX_COMPONENT_ALLOW_LIST } from '../../allowList.js';
import { factValue, type FactName } from '../../facts.js';
import { ALL_CONTENT } from '../index.js';
import {
  estimateReadMinutes,
  measureContent,
  unmetIndexRequirements,
  type ContentMeasurement,
} from '../../threshold.js';
import type { HandRecord } from '../../types.js';

export const CONTENT_DIR = fileURLToPath(new URL('../../../../content/hands/', import.meta.url));

/*
 * The banned profitability verdicts, assembled from fragments: this file is not a `.test.`
 * file, so `src/copy-guards.test.ts` scans it as site copy, and a contiguous "수익성" in a
 * regex literal would trip the very guard it exists to uphold. Joined at runtime the pattern
 * is exactly `/수익성\s*있|이득입니다|플러스\s*EV/u`, as `e3.test.ts` wrote it.
 */
const PROFIT_VERDICT = new RegExp(
  ['수익', '성\\s*있', '|이득', '입니다', '|플러스\\s*EV'].join(''),
  'u',
);
const ALWAYS_MUST = /(항상|무조건|반드시)[^.?]*해야\s*합니다/u;

const ALLOWED_COMPONENTS = new Set<string>(MDX_COMPONENT_ALLOW_LIST);

export function mdxSourceFor(record: HandRecord): string {
  return readFileSync(`${CONTENT_DIR}${record.slug}.mdx`, 'utf8');
}

/** Rank of a class key, read from the real strength dataset. */
export function rank(handKey: string): number {
  return Number(factValue('HAND_RANK', handKey));
}

/** Equity vs a random hand, in percent, read from the real strength dataset. */
export function equity(handKey: string): number {
  return Number(factValue('HAND_EQUITY_VS_RANDOM', handKey).replace('%', ''));
}

export interface HandBatchGateOptions {
  /** `'K1'` … `'K4'` — used in describe titles only. */
  readonly batch: string;
  readonly records: readonly HandRecord[];
  /** The slugs the batch owns; the gate asserts the records are exactly these. */
  readonly ownedSlugs: readonly string[];
  /** Raw source of the batch's MDX map file (`src/content/hands/<batch>.ts`). */
  readonly mdxMapSource: string;
  /** The map's export name (`HAND_K1_MDX`), to find the export block in the source. */
  readonly mdxMapExport: string;
}

export function describeHandBatch({
  batch,
  records,
  ownedSlugs,
  mdxMapSource,
  mdxMapExport,
}: HandBatchGateOptions): void {
  const MEASURED: ReadonlyMap<string, ContentMeasurement> = new Map(
    records.map((record) => [record.id, measureContent(mdxSourceFor(record))]),
  );

  function measurementOf(record: HandRecord): ContentMeasurement {
    const measurement = MEASURED.get(record.id);
    if (measurement === undefined) throw new Error(`no measurement for ${record.id}`);
    return measurement;
  }

  describe(`hands batch ${batch} — registry`, () => {
    it(`registers exactly the ${ownedSlugs.length} owned slugs, once each`, () => {
      const slugs = records.map((record) => record.slug);
      expect(new Set(slugs)).toEqual(new Set(ownedSlugs));
      expect(slugs.length).toBe(ownedSlugs.length);
    });

    it('every owned record is PUBLISHED, indexable, with a positive readMinutes', () => {
      for (const record of records) {
        expect(record.status, record.id).toBe('PUBLISHED');
        expect(record.indexable, record.id).toBe(true);
        expect(record.readMinutes, record.id).not.toBeNull();
        expect(record.readMinutes ?? 0, record.id).toBeGreaterThan(0);
      }
    });

    it('every handKey resolves to one of the 169 real hand classes', () => {
      for (const record of records) {
        expect(handClassByKey(record.handKey), record.id).toBeDefined();
      }
    });

    it('carries the outbound links a hand page needs (§4.2 section 7 / §37)', () => {
      for (const record of records) {
        expect(record.relatedTools, record.id).toEqual(
          expect.arrayContaining(['toolStartingHand', 'toolEquity']),
        );
        expect(
          record.relatedConcepts.length,
          `${record.id}: relatedConcepts`,
        ).toBeGreaterThanOrEqual(1);
        expect(record.relatedHands.length, `${record.id}: relatedHands`).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe(`hands batch ${batch} — MDX map registration`, () => {
    it('imports every owned slug from its own .mdx file', () => {
      for (const slug of ownedSlugs) {
        expect(mdxMapSource, slug).toMatch(
          new RegExp(`from '\\.\\./\\.\\./\\.\\./content/hands/${slug}\\.mdx'`, 'u'),
        );
      }
    });

    it('exports a map entry keyed by every owned slug', () => {
      for (const slug of ownedSlugs) {
        const keyPattern = new RegExp(`(^|[\\s{,])'?${slug}'?\\s*:`, 'mu');
        expect(mdxMapSource, slug).toMatch(keyPattern);
      }
    });

    it(`the map carries no other slug than the ${ownedSlugs.length} this batch owns`, () => {
      const start = mdxMapSource.indexOf(mdxMapExport);
      expect(start, `${mdxMapExport} export not found`).toBeGreaterThanOrEqual(0);
      const exportBlock = mdxMapSource.slice(start);
      const keys = [...exportBlock.matchAll(/^\s*'?([a-z0-9-]+)'?:\s*\w+,/gmu)].map(
        ([, key]) => key!,
      );
      expect(new Set(keys)).toEqual(new Set(ownedSlugs));
    });
  });

  describe(`hands batch ${batch} — MDX prose (content.test.ts equivalents, scoped to this batch)`, () => {
    it('every owned slug has an MDX file on disk', () => {
      for (const record of records) {
        expect(() => mdxSourceFor(record), record.id).not.toThrow();
      }
    });

    it('clears the hands index threshold it claims (§40)', () => {
      const failures: string[] = [];
      for (const record of records) {
        const unmet = unmetIndexRequirements(record, measurementOf(record));
        if (unmet.length > 0) failures.push(`${record.id}: ${unmet.join('; ')}`);
      }
      expect(failures).toEqual([]);
    });

    it('states the reading time its own text implies', () => {
      for (const record of records) {
        const expected = estimateReadMinutes(measurementOf(record).proseCharacters);
        expect(record.readMinutes, record.id).toBe(expected);
      }
    });

    it('contains no import/export and no top-level heading', () => {
      for (const record of records) {
        const measurement = measurementOf(record);
        expect(measurement.hasEsmStatement, record.id).toBe(false);
        expect(measurement.hasTopLevelHeading, record.id).toBe(false);
      }
    });

    it('names only allow-listed components', () => {
      const offenders: string[] = [];
      for (const record of records) {
        for (const name of measurementOf(record).componentUses) {
          if (!ALLOWED_COMPONENTS.has(name)) offenders.push(`${record.id}: <${name}>`);
        }
      }
      expect(offenders).toEqual([]);
    });

    it('every <Term> is used once, resolves to a real glossary entry, and is a declared relatedConcept', () => {
      const byId = new Map(ALL_CONTENT.map((entry) => [entry.id, entry]));
      const problems: string[] = [];
      for (const record of records) {
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
      for (const record of records) {
        const source = mdxSourceFor(record);
        for (const [, hand] of source.matchAll(/<PokerCards\s+hand="([^"]+)"/gu)) {
          if (handClassByKey(hand!) === undefined) offenders.push(`${record.id}: hand="${hand}"`);
        }
      }
      expect(offenders).toEqual([]);
    });

    it('every <Fact> name/arg actually computes (run through the real facts.ts, never reasoned)', () => {
      const offenders: string[] = [];
      for (const record of records) {
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
      for (const record of records) {
        for (const id of record.nextLessons) {
          expect(byId.get(id)?.kind, `${record.id}.nextLessons -> ${id}`).toBe('learn');
        }
        for (const id of record.relatedArticles) {
          expect(['learn', 'blog']).toContain(byId.get(id)?.kind);
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
      for (const record of records) {
        const source = mdxSourceFor(record);
        expect(source, record.id).not.toMatch(/GTO/iu);
        expect(source, record.id).not.toMatch(PROFIT_VERDICT);
        expect(source, record.id).not.toMatch(ALWAYS_MUST);
      }
    });

    it('never types a bare digit count where a <Fact> exists for it (rule 2) — 169 and 1,326', () => {
      for (const record of records) {
        const source = mdxSourceFor(record);
        expect(source, record.id).not.toMatch(/169\s*가지/u);
        expect(source, record.id).not.toMatch(/1[,.]?326\s*가지/u);
      }
    });
  });
}
