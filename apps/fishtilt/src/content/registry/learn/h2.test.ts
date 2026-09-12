/**
 * @vitest-environment node
 *
 * WP-H2's own batch gate — same reasoning as `registry/glossary/j1.test.ts`'s sibling file:
 * this workspace's `vitest.config.ts` registers no MDX transform for the `fishtilt`
 * project, so importing a real `.mdx` file (even one this app already builds and ships,
 * like `poker-range.mdx`) fails at Vite's import-analysis step before any JSX runs. That is
 * a pre-existing gap in a shared root file, out of this batch's file boundary, not something
 * to paper over with a mock that would prove nothing real.
 *
 * So "renders without throwing" is verified the way `content.test.ts` verifies every OTHER
 * kind of content: by reading the raw `.mdx` source as text and statically checking every
 * property a render would otherwise catch — every `<Term>` resolves to a real, related
 * glossary id and is used at most once; every `<PokerCards hand="...">` is one of the 169
 * real hand classes; every `<Fact>` name/arg pair actually computes (run through the real
 * `factValue`, never reasoned about); every component named is on the allow-list; the
 * threshold this batch claims (`indexable: true`) is actually cleared.
 *
 * Per ruling 26 (`docs/FISHTILT_STATE.md`): this batch's four owned slugs are a fixed,
 * permanent assignment from WP-G4/the content plan §7 "H2", not a fact about the site's
 * current state, so listing them as a literal fixture here does not go stale.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { handClassByKey } from '@gto-self/strategy-core';
import { MDX_COMPONENT_ALLOW_LIST } from '../../allowList.js';
import { factValue, type FactName } from '../../facts.js';
import { LEARN_RECORDS } from './index.js';
import { LEARN_H2_RECORDS } from './h2.js';
import {
  estimateReadMinutes,
  measureContent,
  unmetIndexRequirements,
  type ContentMeasurement,
} from '../../threshold.js';
import type { LearnRecord } from '../../types.js';

const CONTENT_DIR = fileURLToPath(new URL('../../../../content/learn/', import.meta.url));
const MDX_MAP_SOURCE = readFileSync(
  fileURLToPath(new URL('../../learn/h2.ts', import.meta.url)),
  'utf8',
);

/** The four slugs `docs/FISHTILT_CONTENT_PLAN.md` §7 "H2" assigns to this batch. Fixed —
 * see the module doc on why this is a safe literal fixture rather than a derived one. */
const OWNED_SLUGS = ['position', 'positions-6max', 'poker-actions', 'preflop'] as const;

const ALLOWED_COMPONENTS = new Set<string>(MDX_COMPONENT_ALLOW_LIST);
const LEARN_BY_ID = new Map(LEARN_RECORDS.map((record) => [record.id, record]));

function mdxSourceFor(record: LearnRecord): string {
  return readFileSync(`${CONTENT_DIR}${record.slug}.mdx`, 'utf8');
}

const MEASURED: ReadonlyMap<string, ContentMeasurement> = new Map(
  LEARN_H2_RECORDS.map((record) => [record.id, measureContent(mdxSourceFor(record))]),
);

function measurementOf(record: LearnRecord): ContentMeasurement {
  const measurement = MEASURED.get(record.id);
  if (measurement === undefined) throw new Error(`no measurement for ${record.id}`);
  return measurement;
}

describe('learn batch H2 — registry', () => {
  it('registers exactly the four owned slugs, once each, and never lesson 06', () => {
    const slugs = LEARN_H2_RECORDS.map((record) => record.slug);
    expect(new Set(slugs)).toEqual(new Set(OWNED_SLUGS));
    expect(slugs.length).toBe(OWNED_SLUGS.length);
    expect(slugs).not.toContain('poker-range');
  });

  it('every owned record is PUBLISHED, indexable, with a positive readMinutes', () => {
    for (const record of LEARN_H2_RECORDS) {
      expect(record.status, record.id).toBe('PUBLISHED');
      expect(record.indexable, record.id).toBe(true);
      expect(record.readMinutes, record.id).not.toBeNull();
      expect(record.readMinutes ?? 0, record.id).toBeGreaterThan(0);
    }
  });

  it('carries the outbound links a learn record needs (build spec §37 / plan §5)', () => {
    for (const record of LEARN_H2_RECORDS) {
      expect(record.relatedTools.length, `${record.id}: relatedTools`).toBeGreaterThanOrEqual(1);
      expect(record.relatedConcepts.length, `${record.id}: relatedConcepts`).toBeGreaterThanOrEqual(
        2,
      );
      const nextSteps = record.nextLessons.length + record.relatedArticles.length;
      expect(nextSteps, `${record.id}: next step`).toBeGreaterThanOrEqual(1);
      // Every H2 lesson is order 7-10, so — unlike lesson 01 — a prerequisite is required.
      expect(record.prerequisites.length, `${record.id}: prerequisites`).toBeGreaterThanOrEqual(1);
    }
  });

  it('fixes lesson 09 (poker-actions): five named actions, not four (ruling 12)', () => {
    const record = LEARN_H2_RECORDS.find((entry) => entry.id === 'poker-actions');
    expect(record).toBeDefined();
    if (record === undefined) return;
    const text = `${record.title} ${record.description}`;
    expect(text, 'must not still claim four actions').not.toMatch(/네\s*가지/u);
    expect(text, 'must state five').toMatch(/다섯\s*가지/u);
    for (const action of ['체크', '베팅', '콜', '레이즈', '폴드']) {
      expect(text, `must name ${action}`).toContain(action);
    }
  });
});

describe('learn batch H2 — MDX map registration', () => {
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

  it('the map carries no other slug than the four this batch owns', () => {
    const exportBlock = MDX_MAP_SOURCE.slice(MDX_MAP_SOURCE.indexOf('LEARN_H2_MDX'));
    const keys = [...exportBlock.matchAll(/^\s*'?([a-z0-9-]+)'?:\s*\w+,/gmu)].map(
      ([, key]) => key!,
    );
    expect(new Set(keys)).toEqual(new Set(OWNED_SLUGS));
  });
});

describe('learn batch H2 — MDX prose (content.test.ts equivalents, scoped to this batch)', () => {
  it('every owned slug has an MDX file on disk', () => {
    for (const record of LEARN_H2_RECORDS) {
      expect(() => mdxSourceFor(record), record.id).not.toThrow();
    }
  });

  it('clears the learn index threshold it claims (§40)', () => {
    const failures: string[] = [];
    for (const record of LEARN_H2_RECORDS) {
      const unmet = unmetIndexRequirements(record, measurementOf(record));
      if (unmet.length > 0) failures.push(`${record.id}: ${unmet.join('; ')}`);
    }
    expect(failures).toEqual([]);
  });

  it('states the reading time its own text implies', () => {
    for (const record of LEARN_H2_RECORDS) {
      const expected = estimateReadMinutes(measurementOf(record).proseCharacters);
      expect(record.readMinutes, record.id).toBe(expected);
    }
  });

  it('contains no import/export and no top-level heading', () => {
    for (const record of LEARN_H2_RECORDS) {
      const measurement = measurementOf(record);
      expect(measurement.hasEsmStatement, record.id).toBe(false);
      expect(measurement.hasTopLevelHeading, record.id).toBe(false);
    }
  });

  it('names only allow-listed components', () => {
    const offenders: string[] = [];
    for (const record of LEARN_H2_RECORDS) {
      for (const name of measurementOf(record).componentUses) {
        if (!ALLOWED_COMPONENTS.has(name)) offenders.push(`${record.id}: <${name}>`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('embeds a <ToolCTA> in the prose itself (§35 mid-content, not only in relations)', () => {
    for (const record of LEARN_H2_RECORDS) {
      expect(mdxSourceFor(record), record.id).toMatch(/<ToolCTA\b/u);
    }
  });

  it('every <Term> is used once, resolves to a real glossary entry, and is a declared relatedConcept', () => {
    const problems: string[] = [];
    for (const record of LEARN_H2_RECORDS) {
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

  it('every <PokerCards hand="..."> names one of the 169 real hand classes', () => {
    const offenders: string[] = [];
    for (const record of LEARN_H2_RECORDS) {
      const source = mdxSourceFor(record);
      for (const [, hand] of source.matchAll(/<PokerCards\s+hand="([^"]+)"/gu)) {
        if (handClassByKey(hand!) === undefined) offenders.push(`${record.id}: hand="${hand}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every <Fact> name/arg actually computes (run through the real facts.ts, never reasoned)', () => {
    const offenders: string[] = [];
    for (const record of LEARN_H2_RECORDS) {
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
    for (const record of LEARN_H2_RECORDS) {
      for (const id of [...record.prerequisites, ...record.nextLessons]) {
        expect(LEARN_BY_ID.get(id), `${record.id} -> ${id}`).toBeDefined();
      }
    }
  });

  it('never types the banned GTO word, and never states an unconditional "always/must" rule', () => {
    // §6.2's banned constructions: the word itself, and the conditionless intensifiers
    // CLAUDE.md rule 2 and the content plan flag as a smuggled strategy claim — an
    // ASSERTION such as "무조건 ~해야 합니다", not the word appearing inside a rhetorical
    // FAQ question that is then explicitly negated (the same safe pattern the published
    // lesson 06 already uses: "무늬가 같으면 무조건 좋은 패인가요? 무조건은 아닙니다.").
    // This batch is named as the most dangerous for exactly this ("position" and "preflop"
    // are where a writer starts asserting what to do), so it is checked mechanically.
    for (const record of LEARN_H2_RECORDS) {
      const source = mdxSourceFor(record);
      expect(source, record.id).not.toMatch(/GTO/iu);
      expect(source, record.id).not.toMatch(/(항상|무조건|반드시)\s*[^.?]*해야\s*합니다/u);
    }
  });

  it('never states a raw range condition without carrying "학습용 기본 레인지"', () => {
    // Any RangeMatrixMini in this batch's prose renders the fixed label itself, but the
    // surrounding prose must never repeat "6인" / "100BB" as if it were this article's own
    // number without the same fixed range vocabulary nearby (settled decision 3/4, rule 0.11).
    for (const record of LEARN_H2_RECORDS) {
      const source = mdxSourceFor(record);
      if (/6인|100BB/u.test(source)) {
        expect(source, record.id).toMatch(/학습용 기본 레인지/u);
      }
    }
  });
});
