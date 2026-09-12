/**
 * @vitest-environment node
 *
 * WP-I1's own batch gate — same reasoning as `registry/blog/i2.test.ts`,
 * `registry/learn/h1.test.ts` and `registry/glossary/j1.test.ts`: this workspace's
 * `vitest.config.ts` registers no MDX transform for the `fishtilt` project, so importing a
 * real `.mdx` file fails at Vite's import-analysis step before any JSX runs
 * (`docs/reports/WP_QA_MDX_TEST_GAP.md`). That gap is a shared root file outside this
 * batch's boundary, not something to paper over with a mock that would prove nothing real.
 *
 * So "renders without throwing" is verified the way `content.test.ts` verifies every OTHER
 * batch: by reading the raw `.mdx` source as text and statically checking every property a
 * render would otherwise catch — every `<Term>` resolves to a real, related glossary id and
 * is used at most once; every `<PokerCards hand="...">` name is one of the 169 real hand
 * classes; every `<Fact>` name/arg pair actually computes (run through the real
 * `factValue`, never reasoned about); every component named is on the allow-list; the
 * threshold this batch claims (`indexable: true`) is actually cleared.
 *
 * Per ruling 26 (`docs/FISHTILT_STATE.md`): this batch's five owned slugs are a fixed,
 * permanent assignment from WP-G4/the content plan §2.2 "I1", not a fact about the site's
 * current state, so listing them as a literal fixture here does not go stale.
 *
 * `blog-qq-vs-ak` is the ruling-24 record: it must cite BOTH `CLASS_VS_CLASS_EQUITY`
 * matchups (`QQ|AKs` and `QQ|AKo`) rather than blending them into one figure, so this file
 * asserts that directly rather than trusting the generic "every Fact computes" check alone.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { handClassByKey } from '@gto-self/strategy-core';
import { parseCards } from '@gto-self/shared';
import { MDX_COMPONENT_ALLOW_LIST } from '../../allowList.js';
import { factValue, type FactName } from '../../facts.js';
import { ALL_CONTENT } from '../index.js';
import { BLOG_I1_RECORDS } from './i1.js';
import {
  estimateReadMinutes,
  measureContent,
  unmetIndexRequirements,
  type ContentMeasurement,
} from '../../threshold.js';
import type { BlogRecord } from '../../types.js';

const CONTENT_DIR = fileURLToPath(new URL('../../../../content/blog/', import.meta.url));
const MDX_MAP_SOURCE = readFileSync(
  fileURLToPath(new URL('../../blog/i1.ts', import.meta.url)),
  'utf8',
);

/** The five slugs `docs/FISHTILT_CONTENT_PLAN.md` §2.2 "I1" assigns to this batch. Fixed —
 *  see the module doc on why this is a safe literal fixture rather than a derived one. */
const OWNED_SLUGS = [
  'aks-vs-ako',
  'next-best-after-aa',
  'how-often-aa',
  'is-ak-good',
  'qq-vs-ak',
] as const;

const ALLOWED_COMPONENTS = new Set<string>(MDX_COMPONENT_ALLOW_LIST);

function mdxSourceFor(record: BlogRecord): string {
  return readFileSync(`${CONTENT_DIR}${record.slug}.mdx`, 'utf8');
}

function recordOf(slug: (typeof OWNED_SLUGS)[number]): BlogRecord {
  const record = BLOG_I1_RECORDS.find((entry) => entry.slug === slug);
  if (record === undefined) throw new Error(`${slug} is not in batch I1`);
  return record;
}

/** `"67.04%"` → `67.04`. Every percentage fact renders two decimals (`facts.ts` Rounding). */
function percent(rendered: string): number {
  const value = Number(rendered.replace('%', ''));
  if (Number.isNaN(value)) throw new Error(`not a percentage: ${rendered}`);
  return value;
}

/** `"1,326"` → `1326`. Counts render with Korean digit grouping. */
function count(rendered: string): number {
  const value = Number(rendered.replace(/,/gu, ''));
  if (Number.isNaN(value)) throw new Error(`not a count: ${rendered}`);
  return value;
}

const MEASURED: ReadonlyMap<string, ContentMeasurement> = new Map(
  BLOG_I1_RECORDS.map((record) => [record.id, measureContent(mdxSourceFor(record))]),
);

function measurementOf(record: BlogRecord): ContentMeasurement {
  const measurement = MEASURED.get(record.id);
  if (measurement === undefined) throw new Error(`no measurement for ${record.id}`);
  return measurement;
}

describe('blog batch I1 — registry', () => {
  it('registers exactly the five owned slugs, once each', () => {
    const slugs = BLOG_I1_RECORDS.map((record) => record.slug);
    expect(new Set(slugs)).toEqual(new Set(OWNED_SLUGS));
    expect(slugs.length).toBe(OWNED_SLUGS.length);
  });

  it('every owned record is PUBLISHED, indexable, with a positive readMinutes', () => {
    for (const record of BLOG_I1_RECORDS) {
      expect(record.status, record.id).toBe('PUBLISHED');
      expect(record.indexable, record.id).toBe(true);
      expect(record.readMinutes, record.id).not.toBeNull();
      expect(record.readMinutes ?? 0, record.id).toBeGreaterThan(0);
    }
  });

  it('carries the outbound links a blog answer needs (build spec §35 / plan §2.2)', () => {
    for (const record of BLOG_I1_RECORDS) {
      expect(record.relatedTools.length, `${record.id}: relatedTools`).toBeGreaterThanOrEqual(1);
      expect(record.relatedConcepts.length, `${record.id}: relatedConcepts`).toBeGreaterThanOrEqual(
        1,
      );
      const nextSteps = record.nextLessons.length + record.relatedArticles.length;
      expect(nextSteps, `${record.id}: next step`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('blog batch I1 — MDX map registration', () => {
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
    const exportBlock = MDX_MAP_SOURCE.slice(MDX_MAP_SOURCE.indexOf('BLOG_I1_MDX'));
    const keys = [...exportBlock.matchAll(/^\s*'?([a-z0-9-]+)'?:\s*\w+,/gmu)].map(
      ([, key]) => key!,
    );
    expect(new Set(keys)).toEqual(new Set(OWNED_SLUGS));
  });
});

describe('blog batch I1 — MDX prose (content.test.ts equivalents, scoped to this batch)', () => {
  it('every owned slug has an MDX file on disk', () => {
    for (const record of BLOG_I1_RECORDS) {
      expect(() => mdxSourceFor(record), record.id).not.toThrow();
    }
  });

  it('clears the blog index threshold it claims (§40)', () => {
    const failures: string[] = [];
    for (const record of BLOG_I1_RECORDS) {
      const unmet = unmetIndexRequirements(record, measurementOf(record));
      if (unmet.length > 0) failures.push(`${record.id}: ${unmet.join('; ')}`);
    }
    expect(failures).toEqual([]);
  });

  it('states the reading time its own text implies', () => {
    for (const record of BLOG_I1_RECORDS) {
      const expected = estimateReadMinutes(measurementOf(record).proseCharacters);
      expect(record.readMinutes, record.id).toBe(expected);
    }
  });

  it('contains no import/export and no top-level heading', () => {
    for (const record of BLOG_I1_RECORDS) {
      const measurement = measurementOf(record);
      expect(measurement.hasEsmStatement, record.id).toBe(false);
      expect(measurement.hasTopLevelHeading, record.id).toBe(false);
    }
  });

  it('names only allow-listed components', () => {
    const offenders: string[] = [];
    for (const record of BLOG_I1_RECORDS) {
      for (const name of measurementOf(record).componentUses) {
        if (!ALLOWED_COMPONENTS.has(name)) offenders.push(`${record.id}: <${name}>`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('embeds a <ToolCTA> in the prose itself (§35 mid-content, not only in relations)', () => {
    for (const record of BLOG_I1_RECORDS) {
      expect(mdxSourceFor(record), record.id).toMatch(/<ToolCTA\b/u);
    }
  });

  it('every <Term> is used once, resolves to a real glossary entry, and is a declared relatedConcept', () => {
    const byId = new Map(ALL_CONTENT.map((entry) => [entry.id, entry]));
    const problems: string[] = [];
    for (const record of BLOG_I1_RECORDS) {
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
    for (const record of BLOG_I1_RECORDS) {
      const source = mdxSourceFor(record);
      for (const [, hand] of source.matchAll(/<PokerCards\s+hand="([^"]+)"/gu)) {
        if (handClassByKey(hand!) === undefined) offenders.push(`${record.id}: hand="${hand}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every <PokerCards cards="..."> parses as real, distinct cards', () => {
    const offenders: string[] = [];
    for (const record of BLOG_I1_RECORDS) {
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
    for (const record of BLOG_I1_RECORDS) {
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
    for (const record of BLOG_I1_RECORDS) {
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
    for (const record of BLOG_I1_RECORDS) {
      const source = mdxSourceFor(record);
      expect(source, record.id).not.toMatch(/GTO/iu);
      expect(source, record.id).not.toMatch(/수익성\s*있|이득입니다|플러스\s*EV/u);
      expect(source, record.id).not.toMatch(/(항상|무조건|반드시)\s*[^.?]*해야\s*합니다/u);
    }
  });
});

describe('blog batch I1 — ruling 24: blog-qq-vs-ak states both matchups, never a blend', () => {
  const record = BLOG_I1_RECORDS.find((entry) => entry.id === 'blog-qq-vs-ak');

  it('the record exists in this batch', () => {
    expect(record).toBeDefined();
  });

  it('cites CLASS_VS_CLASS_EQUITY for both QQ|AKs and QQ|AKo (either side), and no other class pair', () => {
    if (record === undefined) throw new Error('blog-qq-vs-ak not found');
    const source = mdxSourceFor(record);
    const matchups = [
      ...source.matchAll(/<Fact\s+name="CLASS_VS_CLASS_EQUITY"\s+arg="([^"]+)"/gu),
    ].map(([, arg]) => arg!);
    // WP-S3-07: the article now also shows the same two matchups from AK's side. Both QQ-side
    // args must be present; the only other args allowed are their mirrors.
    expect(new Set(matchups)).toContain('QQ|AKs');
    expect(new Set(matchups)).toContain('QQ|AKo');
    for (const arg of matchups) {
      expect(['QQ|AKs', 'QQ|AKo', 'AKs|QQ', 'AKo|QQ'], arg).toContain(arg);
    }
  });

  it('the two frozen matchups actually differ (suited and offsuit are not blended)', () => {
    const suited = factValue('CLASS_VS_CLASS_EQUITY', 'QQ|AKs');
    const offsuit = factValue('CLASS_VS_CLASS_EQUITY', 'QQ|AKo');
    expect(suited).not.toBe(offsuit);
  });

  it('the AK-side view of each matchup is the complement of the QQ-side view (one pot)', () => {
    for (const ak of ['AKs', 'AKo']) {
      const qqSide = percent(factValue('CLASS_VS_CLASS_EQUITY', `QQ|${ak}`));
      const akSide = percent(factValue('CLASS_VS_CLASS_EQUITY', `${ak}|QQ`));
      expect(Math.abs(qqSide + akSide - 100), ak).toBeLessThan(0.011);
    }
  });

  it("never uses EXACT_EQUITY as a stand-in for the class matchup (the plan's stale advice)", () => {
    if (record === undefined) throw new Error('blog-qq-vs-ak not found');
    const source = mdxSourceFor(record);
    expect(source).not.toMatch(/<Fact\s+name="EXACT_EQUITY"/u);
  });
});

/**
 * WP-S3-07 — the Stage 3 search-guide shape, and every number the five articles state in a
 * place a `<Fact>` cannot reach (a title, a description, a FAQ answer kept component-free so
 * `FAQPage` markup can carry it, or an arithmetic sentence such as "세 배"). Each such claim
 * is re-derived from the engine here, never trusted (`AGENT_COMMON_RULES.md` rule 3).
 */
describe('blog batch I1 — WP-S3-07 search-guide shape', () => {
  it('every record carries a seoTitle that differs from the H1 and states the query', () => {
    for (const record of BLOG_I1_RECORDS) {
      expect(record.seoTitle, record.id).toBeDefined();
      expect(record.seoTitle, record.id).not.toBe(record.title);
      expect(record.seoTitle?.length ?? 0, record.id).toBeGreaterThan(10);
    }
  });

  it('opens with <QuickAnswer> as the first element, and its numbers are <Fact>s', () => {
    for (const record of BLOG_I1_RECORDS) {
      const source = mdxSourceFor(record);
      expect(source.trimStart().startsWith('<QuickAnswer>'), record.id).toBe(true);
      const quick = source.slice(0, source.indexOf('</QuickAnswer>'));
      // A bare percentage or "N위/N가지/N판" typed in the quick answer would be a number the
      // reader cannot check; every digit inside must sit in a Fact arg or be a hand key.
      const stripped = quick.replace(/<Fact\b[^>]*\/>/gu, '').replace(/<\/?QuickAnswer>/gu, '');
      expect(stripped, `${record.id}: typed number in QuickAnswer`).not.toMatch(
        /\d+(?:\.\d+)?\s*(?:%|위|가지|판|배)/u,
      );
    }
  });

  it('has at least three unique ## headings (TOC) and a FAQ section with 2+ ### questions', () => {
    for (const record of BLOG_I1_RECORDS) {
      const source = mdxSourceFor(record);
      const h2s = [...source.matchAll(/^##\s+(.+)$/gmu)].map(([, text]) => text!.trim());
      expect(h2s.length, record.id).toBeGreaterThanOrEqual(3);
      expect(new Set(h2s).size, `${record.id}: duplicate ##`).toBe(h2s.length);
      expect(h2s, record.id).toContain('사람들이 자주 헷갈리는 부분');
      const faqStart = source.indexOf('## 사람들이 자주 헷갈리는 부분');
      const faq = source.slice(faqStart);
      const questions = [...faq.matchAll(/^###\s+(.+)$/gmu)].map(([, text]) => text!.trim());
      expect(questions.length, `${record.id}: FAQ items`).toBeGreaterThanOrEqual(2);
      for (const question of questions) expect(question, record.id).toMatch(/\?$/u);
      expect(source, `${record.id}: <FAQ> and the heading convention together`).not.toMatch(
        /<FAQ\b/u,
      );
    }
  });

  it('embeds exactly one <ToolCTA>', () => {
    for (const record of BLOG_I1_RECORDS) {
      expect(mdxSourceFor(record).match(/<ToolCTA\b/gu)?.length, record.id).toBe(1);
    }
  });

  it('every in-body content link resolves to a PUBLISHED record of the right prefix', () => {
    const published = new Map(
      ALL_CONTENT.filter((record) => record.status === 'PUBLISHED').map((record) => [
        `/${record.kind}/${record.slug}`,
        record,
      ]),
    );
    const dangling: string[] = [];
    for (const record of BLOG_I1_RECORDS) {
      for (const [, href] of mdxSourceFor(record).matchAll(/\]\((\/[^)\s]*)\)/gu)) {
        if (!published.has(href!)) dangling.push(`${record.id} -> ${href}`);
      }
    }
    expect(dangling).toEqual([]);
  });
});

describe('blog batch I1 — WP-S3-07 typed claims re-derived from the engine', () => {
  const rankOf = (key: string) => count(factValue('HAND_RANK', key));
  const equityOf = (key: string) => percent(factValue('HAND_EQUITY_VS_RANDOM', key));
  const combosOf = (key: string) => count(factValue('HAND_COMBOS', key));

  describe('aks-vs-ako', () => {
    it('"등수로는 네 자리" / "2%p가 안 되는" / "세 배" / "세 번 중 두 번 이상은 오프수트"', () => {
      expect(rankOf('AKo') - rankOf('AKs')).toBe(4);
      const gap = equityOf('AKs') - equityOf('AKo');
      expect(gap).toBeGreaterThan(0);
      expect(gap).toBeLessThan(2);
      expect(combosOf('AKo') / combosOf('AKs')).toBe(3);
      expect(combosOf('AKo') / (combosOf('AKo') + combosOf('AKs'))).toBeGreaterThanOrEqual(2 / 3);
    });

    it('"AKs와 AKo 사이에 세 패가 끼어 있다" — ranks 9, 10, 11 are named as Facts', () => {
      const source = mdxSourceFor(recordOf('aks-vs-ako'));
      for (let rank = rankOf('AKs') + 1; rank < rankOf('AKo'); rank += 1) {
        expect(source).toContain(`<Fact name="HAND_AT_RANK" arg="${rank}" />`);
      }
      expect(rankOf('AKo') - rankOf('AKs') - 1).toBe(3);
    });

    it('A♠K♠ vs A♥K♦: the suited side is ahead, by little, and the two views sum to the pot', () => {
      const suited = percent(factValue('EXACT_EQUITY', 'AsKs|AhKd'));
      const offsuit = percent(factValue('EXACT_EQUITY', 'AhKd|AsKs'));
      expect(suited).toBeGreaterThan(50);
      expect(suited).toBeLessThan(55);
      expect(Math.abs(suited + offsuit - 100)).toBeLessThan(0.011);
    });

    it('"첫 레이즈로 쓰이는 자리는 똑같습니다"', () => {
      expect(factValue('RFI_POSITIONS_WITH', 'AKs')).toBe(factValue('RFI_POSITIONS_WITH', 'AKo'));
    });
  });

  describe('next-best-after-aa', () => {
    const source = mdxSourceFor(recordOf('next-best-after-aa'));

    it('each DataTable row types the class the ranking actually puts at that rank', () => {
      const rows = [...source.matchAll(/rank:\s*'(\d+)',\s*hand:\s*'([^']+)'/gu)];
      expect(rows.length).toBe(20);
      for (const [, rank, hand] of rows) {
        expect(factValue('HAND_AT_RANK', rank!), `rank ${rank}`).toBe(hand);
        // And the three Facts on that row cite the same class.
        const line = source.split('\n').find((l) => l.includes(`rank: '${rank}'`)) ?? '';
        expect(
          line.match(/arg="([^"]+)"/gu)?.every((m) => m === `arg="${hand}"`),
          line,
        ).toBe(true);
      }
    });

    it('"맨 위 일곱 자리는 전부 포켓페어", "포켓페어가 아닌 패는 8위 AKs에서 처음"', () => {
      const pairCombos = count(factValue('COMBOS_OF_KIND', 'PAIR'));
      for (let rank = 1; rank <= 7; rank += 1) {
        expect(combosOf(factValue('HAND_AT_RANK', String(rank))), `rank ${rank}`).toBe(pairCombos);
      }
      expect(factValue('HAND_AT_RANK', '8')).toBe('AKs');
      expect(rankOf('AKs')).toBe(8);
    });

    it('"11~20위에서 포켓페어는 66 하나뿐"', () => {
      const pairCombos = count(factValue('COMBOS_OF_KIND', 'PAIR'));
      const pairs = [];
      for (let rank = 11; rank <= 20; rank += 1) {
        const key = factValue('HAND_AT_RANK', String(rank));
        if (combosOf(key) === pairCombos) pairs.push(key);
      }
      expect(pairs).toEqual(['66']);
    });

    it('"20위까지 조합 기준 열 개 중 하나 정도", "KK는 AA와 크게 벌어지지 않는다", "AKs는 77보다 앞"', () => {
      const top20 = percent(factValue('HAND_TOP_SHARE', factValue('HAND_AT_RANK', '20')));
      expect(top20).toBeGreaterThan(8);
      expect(top20).toBeLessThan(12);
      expect(equityOf('AA') - equityOf('KK')).toBeLessThan(5);
      expect(equityOf('KK') - equityOf('QQ')).toBeLessThan(5);
      expect(rankOf('AKs')).toBeLessThan(rankOf('77'));
    });
  });

  describe('how-often-aa', () => {
    it('title "조합 6가지" and the FAQ\'s "약 221" match the engine', () => {
      expect(factValue('HAND_COMBOS', 'AA')).toBe('6');
      expect(recordOf('how-often-aa').title).toContain('6가지');
      expect(factValue('HAND_ONE_IN_N', 'AA')).toBe('221');
      expect(mdxSourceFor(recordOf('how-often-aa'))).toContain('약 221로 나눈');
    });

    it('"아무 포켓페어" = 78가지 · 5.88% · 약 17판에 한 번 · AA의 열세 배', () => {
      const classes = count(factValue('CLASSES_OF_KIND', 'PAIR'));
      const combos = count(factValue('COMBOS_OF_KIND', 'PAIR'));
      const total = count(factValue('COMBO_COUNT'));
      expect(classes * combos).toBe(78);
      expect(((classes * combos * 100) / total).toFixed(2)).toBe('5.88');
      expect(Math.round(total / (classes * combos))).toBe(17);
      expect((classes * combos) / combosOf('AA')).toBe(13);
    });

    it('"AK는 열여섯 가지 조합이라 AA보다 두 배 넘게"', () => {
      const ak = combosOf('AKs') + combosOf('AKo');
      expect(ak).toBe(16);
      expect(ak / combosOf('AA')).toBeGreaterThan(2);
    });

    it('draws exactly the six AA combos, each a distinct pair of aces', () => {
      const cards = [
        ...mdxSourceFor(recordOf('how-often-aa')).matchAll(/<PokerCards\s+cards="([^"]+)"/gu),
      ].map(([, c]) => c!.split(' ').sort().join(' '));
      expect(cards.length).toBe(6);
      expect(new Set(cards).size).toBe(6);
      for (const pair of cards) expect(pair).toMatch(/^A[cdhs] A[cdhs]$/u);
    });
  });

  describe('is-ak-good', () => {
    it('description "AKs 8위·AKo 12위" and "1위부터 7위까지가 전부 포켓페어"', () => {
      const record = recordOf('is-ak-good');
      expect(record.description).toContain(`AKs ${rankOf('AKs')}위`);
      expect(record.description).toContain(`AKo ${rankOf('AKo')}위`);
      const pairCombos = count(factValue('COMBOS_OF_KIND', 'PAIR'));
      for (let rank = 1; rank <= 7; rank += 1) {
        expect(combosOf(factValue('HAND_AT_RANK', String(rank)))).toBe(pairCombos);
      }
    });

    it('"QQ를 만나면 AK 쪽이 절반보다 적은 몫", "순위표에서는 QQ가 AKs보다 앞"', () => {
      expect(percent(factValue('CLASS_VS_CLASS_EQUITY', 'AKs|QQ'))).toBeLessThan(50);
      expect(percent(factValue('CLASS_VS_CLASS_EQUITY', 'AKo|QQ'))).toBeLessThan(50);
      expect(rankOf('QQ')).toBeLessThan(rankOf('AKs'));
    });

    it('"네 번 중 세 번 가까이는 끝까지 페어를 만들지 못한다" (6 outs, flop → river)', () => {
      const hit = percent(factValue('OUTS_PROB', '6|FLOP|RIVER'));
      expect(hit).toBeGreaterThan(20);
      expect(hit).toBeLessThan(30);
    });

    it('"첫 레이즈 레인지가 있는 다섯 자리 전부"', () => {
      expect(factValue('RFI_POSITIONS_WITH', 'AKs').split(' · ')).toHaveLength(5);
      expect(factValue('RFI_POSITIONS_WITH', 'AKo').split(' · ')).toHaveLength(5);
    });
  });

  describe('qq-vs-ak (audit NUMBER-RISK #27: "코인플립" is a belief, the engine decides)', () => {
    it('QQ is above one half against both AKs and AKo — so "코인플립" is not exact', () => {
      for (const arg of ['QQ|AKs', 'QQ|AKo']) {
        const qq = percent(factValue('CLASS_VS_CLASS_EQUITY', arg));
        expect(qq, arg).toBeGreaterThan(50);
        expect(qq, arg).toBeLessThan(60);
      }
    });

    it('"AKs를 만났을 때 QQ의 몫이 더 낮다"', () => {
      expect(percent(factValue('CLASS_VS_CLASS_EQUITY', 'QQ|AKs'))).toBeLessThan(
        percent(factValue('CLASS_VS_CLASS_EQUITY', 'QQ|AKo')),
      );
    });

    it('"24가지 대결", "72가지 대결" are the combo products', () => {
      expect(combosOf('QQ') * combosOf('AKs')).toBe(24);
      expect(combosOf('QQ') * combosOf('AKo')).toBe(72);
    });

    it('names 코인플립 as a belief and checks it, never asserts it', () => {
      const source = mdxSourceFor(recordOf('qq-vs-ak'));
      expect(source).toMatch(/코인플립/u);
      expect(source).toMatch(/정확한 표현이 아니|반반은 아닙니다/u);
    });
  });
});
