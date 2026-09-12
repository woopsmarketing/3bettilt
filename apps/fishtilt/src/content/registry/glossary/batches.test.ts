/**
 * @vitest-environment node
 *
 * The per-batch gate for every glossary batch file (g1..g9) — the assertions the former
 * `j1.test.ts` and `j2.test.ts` made, moved here unchanged in strength and applied to every
 * batch (WP-S3-11 split). A failure names the batch AND the record, so a content agent
 * working on one file sees only its own problems.
 *
 * ## Why this never imports the compiled MDX component
 *
 * `content/glossary/g*.ts` statically import `.mdx` files. That import graph compiles under
 * Next's `@next/mdx` pipeline (proven by `pnpm build`), but the workspace `vitest.config.ts`
 * registers no MDX transform for the `fishtilt` project, so importing a map file from a
 * test fails at Vite's import-analysis step on the raw Korean prose. `pnpm build` is what
 * proves a `.mdx` file compiles and renders; this file proves everything checkable without
 * that pipeline by reading the raw source as text: every `<Term>` resolves to a real,
 * related glossary id and is not repeated; every `<PokerCards hand>` is one of the 169 real
 * hand classes; every component named is on the allow-list; the threshold each record
 * claims (`indexable: true`) is actually cleared; the MDX map file wires every slug the
 * registry file owns and nothing else.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { handClassByKey } from '@gto-self/strategy-core';
import { MDX_COMPONENT_ALLOW_LIST } from '../../allowList.js';
import { GLOSSARY_BATCHES, GLOSSARY_RECORDS } from './index.js';
import {
  estimateReadMinutes,
  measureContent,
  unmetIndexRequirements,
  type ContentMeasurement,
} from '../../threshold.js';
import type { GlossaryRecord } from '../../types.js';

const CONTENT_DIR = fileURLToPath(new URL('../../../../content/glossary/', import.meta.url));
const MAP_DIR = fileURLToPath(new URL('../../glossary/', import.meta.url));

const ALLOWED_COMPONENTS = new Set<string>(MDX_COMPONENT_ALLOW_LIST);
const GLOSSARY_BY_ID = new Map(GLOSSARY_RECORDS.map((record) => [record.id, record]));

function mdxPathFor(slug: string): string {
  return `${CONTENT_DIR}${slug}.mdx`;
}

function mdxSourceFor(record: GlossaryRecord): string {
  return readFileSync(mdxPathFor(record.slug), 'utf8');
}

const BATCH_IDS = Object.keys(GLOSSARY_BATCHES);

describe('glossary batches — the whole registry', () => {
  it('is nine batch files whose union is the registry, with no slug or id in two files', () => {
    expect(BATCH_IDS).toEqual(['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9']);
    const all = Object.values(GLOSSARY_BATCHES).flat();
    expect(all.length).toBe(GLOSSARY_RECORDS.length);
    expect(new Set(all.map((r) => r.slug)).size).toBe(all.length);
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length);
  });

  it('still registers the 58 terms the J1/J2 batches shipped (none lost in the split)', () => {
    // The 28 + 30 slugs the two original batches owned, verbatim from their tests.
    const J1 = [
      'position',
      'open-raise',
      'action',
      'all-in',
      'ante',
      'blind',
      'big-blind',
      'small-blind',
      'button',
      'cutoff',
      'hijack',
      'utg',
      'stack',
      'pot',
      'check',
      'call',
      'bet',
      'raise',
      'fold',
      'limp',
      'three-bet',
      'four-bet',
      'c-bet',
      'bluff',
      'heads-up',
      'showdown',
      'vpip',
      'pfr',
    ];
    const J2 = [
      'range',
      'suited',
      'offsuit',
      'pocket-pair',
      'combo',
      'preflop',
      'hand',
      'board',
      'community-cards',
      'flop',
      'turn',
      'river',
      'hand-ranking',
      'high-card',
      'one-pair',
      'two-pair',
      'three-of-a-kind',
      'straight',
      'flush',
      'full-house',
      'four-of-a-kind',
      'straight-flush',
      'kicker',
      'split-pot',
      'hand-matrix',
      'draw',
      'outs',
      'equity',
      'pot-odds',
      'nuts',
    ];
    expect(J1.length).toBe(28);
    expect(J2.length).toBe(30);
    const slugs = new Set(GLOSSARY_RECORDS.map((r) => r.slug));
    for (const slug of [...J1, ...J2]) expect(slugs.has(slug), slug).toBe(true);
    expect(slugs.size).toBeGreaterThanOrEqual(58);
  });
});

describe.each(BATCH_IDS)('glossary batch %s', (batchId) => {
  const records = GLOSSARY_BATCHES[batchId]!;
  const ownedSlugs = records.map((record) => record.slug);
  const mapSource = readFileSync(`${MAP_DIR}${batchId}.ts`, 'utf8');
  const MEASURED: ReadonlyMap<string, ContentMeasurement> = new Map(
    records.map((record) => [record.id, measureContent(mdxSourceFor(record))]),
  );
  function measurementOf(record: GlossaryRecord): ContentMeasurement {
    const measurement = MEASURED.get(record.id);
    if (measurement === undefined) throw new Error(`no measurement for ${record.id}`);
    return measurement;
  }

  describe('registry', () => {
    it('owns at least one slug, once each', () => {
      expect(ownedSlugs.length).toBeGreaterThan(0);
      expect(new Set(ownedSlugs).size).toBe(ownedSlugs.length);
    });

    it('every owned record is PUBLISHED, indexable, with a positive readMinutes', () => {
      for (const record of records) {
        expect(record.status, record.id).toBe('PUBLISHED');
        expect(record.indexable, record.id).toBe(true);
        expect(record.readMinutes, record.id).not.toBeNull();
        expect(record.readMinutes ?? 0, record.id).toBeGreaterThan(0);
      }
    });
  });

  describe('MDX map registration', () => {
    it('imports every owned slug from its own .mdx file', () => {
      for (const slug of ownedSlugs) {
        expect(mapSource, slug).toMatch(
          new RegExp(`from '\\.\\./\\.\\./\\.\\./content/glossary/${slug}\\.mdx'`, 'u'),
        );
      }
    });

    it('exports a map entry keyed by every owned slug', () => {
      for (const slug of ownedSlugs) {
        const keyPattern = new RegExp(`(^|[\\s{,])'?${slug}'?\\s*:`, 'mu');
        expect(mapSource, slug).toMatch(keyPattern);
      }
    });

    it('the map carries no other slug than the ones this batch owns', () => {
      const marker = `GLOSSARY_${batchId.toUpperCase()}_MDX`;
      expect(mapSource).toContain(marker);
      const exportBlock = mapSource.slice(mapSource.indexOf(marker));
      const keys = [...exportBlock.matchAll(/^\s*'?([a-z0-9-]+)'?:\s*\w+,/gmu)].map(
        ([, key]) => key!,
      );
      expect(new Set(keys)).toEqual(new Set(ownedSlugs));
    });
  });

  describe('MDX prose (content.test.ts equivalents, scoped to this batch)', () => {
    it('every owned slug has an MDX file on disk', () => {
      const missing = records.filter((record) => !existsSync(mdxPathFor(record.slug)));
      expect(missing.map((record) => record.slug)).toEqual([]);
    });

    it('clears the glossary index threshold it claims (§40)', () => {
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
      const problems: string[] = [];
      for (const record of records) {
        const source = mdxSourceFor(record);
        const ids = [...source.matchAll(/<Term\s+id="([^"]+)"/gu)].map(([, id]) => id!);
        const counts = new Map<string, number>();
        for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
        for (const [id, count] of counts) {
          if (count > 1) problems.push(`${record.id}: <Term id="${id}"> used ${count}x`);
          if (GLOSSARY_BY_ID.get(id) === undefined) {
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

    it('never types the banned GTO word, and never writes a conditionless "must"', () => {
      // §6.2's banned constructions: the word itself, and the conditionless
      // "always/never/must" intensifiers CLAUDE.md rule 2 and the content plan both flag
      // as a smuggled strategy claim. (J1's rule, now applied to every batch.)
      for (const record of records) {
        const source = mdxSourceFor(record);
        expect(source, record.id).not.toMatch(/GTO/iu);
        expect(source, record.id).not.toMatch(/무조건|반드시\s*[^.]*해야\s*합니다/u);
      }
    });
  });
});
