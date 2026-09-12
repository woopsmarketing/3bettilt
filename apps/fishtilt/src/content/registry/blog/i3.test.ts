/**
 * @vitest-environment node
 *
 * WP-I3's own batch gate — same reasoning as `registry/blog/i1.test.ts` and
 * `registry/blog/i2.test.ts`: this workspace's `vitest.config.ts` registers no MDX transform
 * for the `fishtilt` project, so importing a real `.mdx` file fails at Vite's
 * import-analysis step before any JSX runs (`docs/reports/WP_QA_MDX_TEST_GAP.md`). So
 * "renders without throwing" is verified the way `content.test.ts` verifies every other
 * batch: by reading the raw `.mdx` source as text and statically checking every property a
 * render would otherwise catch.
 *
 * Per ruling 26 (`docs/FISHTILT_STATE.md`): this batch's owned slugs are a fixed, permanent
 * assignment from WP-G4/the content plan §2.2 "I3", not a fact about the site's current
 * state, so listing them as a literal fixture here does not go stale. WP-S3-07 merged
 * `same-pair-who-wins` into `what-is-kicker` (Stage 3 audit B12 → B13), so the fixture is now
 * four slugs and the absorbed example is pinned under `what-is-kicker` below.
 *
 * This batch's defining constraint is ruling 28: three of its four articles turn on who
 * actually wins a specific showdown, and every such claim must be verified against the real
 * evaluator rather than reasoned out. The last `describe` blocks below re-run
 * `bestFiveOf`/`compareHands` from `@gto-self/strategy-core` over the exact card strings this
 * batch's own MDX prints, so a future edit that silently changes a card (and would silently
 * invalidate the claim) fails this suite, not just a one-off script.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  bestFiveOf,
  compareHands,
  HAND_CLASSES,
  handClassByKey,
  hasHandClass,
  type StrategyPosition,
} from '@gto-self/strategy-core';
import { ALL_CARDS, parseCards, unwrap, type Card } from '@gto-self/shared';
import { resolveRange } from '../../../features/range/index.js';
import { MDX_COMPONENT_ALLOW_LIST } from '../../allowList.js';
import { factValue, type FactName } from '../../facts.js';
import { ALL_CONTENT } from '../index.js';
import { BLOG_I3_RECORDS } from './i3.js';
import {
  estimateReadMinutes,
  measureContent,
  unmetIndexRequirements,
  type ContentMeasurement,
} from '../../threshold.js';
import type { BlogRecord } from '../../types.js';

const CONTENT_DIR = fileURLToPath(new URL('../../../../content/blog/', import.meta.url));
const MDX_MAP_SOURCE = readFileSync(
  fileURLToPath(new URL('../../blog/i3.ts', import.meta.url)),
  'utf8',
);

/** The four slugs this batch owns after the WP-S3-07 merge. Fixed — see the module doc on
 *  why this is a safe literal fixture rather than a derived one. */
const OWNED_SLUGS = ['btn-why-wide', 'what-is-kicker', 'playing-the-board', 'a2345-wheel'] as const;

/** The slug the merge removed. It must be gone from the batch, the map and the disk. */
const MERGED_AWAY_SLUG = 'same-pair-who-wins';

const ALLOWED_COMPONENTS = new Set<string>(MDX_COMPONENT_ALLOW_LIST);

function mdxSourceFor(record: BlogRecord): string {
  return readFileSync(`${CONTENT_DIR}${record.slug}.mdx`, 'utf8');
}

const MEASURED: ReadonlyMap<string, ContentMeasurement> = new Map(
  BLOG_I3_RECORDS.map((record) => [record.id, measureContent(mdxSourceFor(record))]),
);

function measurementOf(record: BlogRecord): ContentMeasurement {
  const measurement = MEASURED.get(record.id);
  if (measurement === undefined) throw new Error(`no measurement for ${record.id}`);
  return measurement;
}

const cards = (text: string): Card[] => unwrap(parseCards(text));

/** `compareHands` over the best five of two seven-card (or five-card) deals. */
function showdown(hero: string, villain: string): -1 | 0 | 1 {
  const a = bestFiveOf(cards(hero));
  const b = bestFiveOf(cards(villain));
  return compareHands(a.value.strength, b.value.strength);
}

describe('blog batch I3 — registry', () => {
  it('registers exactly the four owned slugs, once each', () => {
    const slugs = BLOG_I3_RECORDS.map((record) => record.slug);
    expect(new Set(slugs)).toEqual(new Set(OWNED_SLUGS));
    expect(slugs.length).toBe(OWNED_SLUGS.length);
  });

  it('every owned record is PUBLISHED, indexable, with a positive readMinutes', () => {
    for (const record of BLOG_I3_RECORDS) {
      expect(record.status, record.id).toBe('PUBLISHED');
      expect(record.indexable, record.id).toBe(true);
      expect(record.readMinutes, record.id).not.toBeNull();
      expect(record.readMinutes ?? 0, record.id).toBeGreaterThan(0);
    }
  });

  it('carries the outbound links a blog answer needs (build spec §35 / plan §2.2)', () => {
    for (const record of BLOG_I3_RECORDS) {
      expect(record.relatedTools.length, `${record.id}: relatedTools`).toBeGreaterThanOrEqual(1);
      expect(record.relatedConcepts.length, `${record.id}: relatedConcepts`).toBeGreaterThanOrEqual(
        1,
      );
      const nextSteps = record.nextLessons.length + record.relatedArticles.length;
      expect(nextSteps, `${record.id}: next step`).toBeGreaterThanOrEqual(1);
    }
  });

  it('every record states the search title separately from its H1 (WP-S3-07)', () => {
    for (const record of BLOG_I3_RECORDS) {
      expect(record.seoTitle, record.id).toBeTruthy();
      expect(record.seoTitle, record.id).not.toBe(record.title);
      expect(record.contentType, record.id).toBe('search-guide');
    }
  });

  it('the merged-away slug is gone from the batch, the MDX map and the disk, and no record links to it', () => {
    expect(BLOG_I3_RECORDS.map((record) => record.slug)).not.toContain(MERGED_AWAY_SLUG);
    // The map's doc comment may still NAME the merge; the imports and the export block may not.
    const mapCode = MDX_MAP_SOURCE.replace(/\/\*\*[\s\S]*?\*\//u, '');
    expect(mapCode).not.toContain(MERGED_AWAY_SLUG);
    expect(() => readFileSync(`${CONTENT_DIR}${MERGED_AWAY_SLUG}.mdx`, 'utf8')).toThrow();
    for (const record of ALL_CONTENT) {
      expect(record.relatedArticles, record.id).not.toContain(`blog-${MERGED_AWAY_SLUG}`);
    }
  });
});

describe('blog batch I3 — MDX map registration', () => {
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

  it('the map carries no other slug than the four this batch owns', () => {
    const exportBlock = MDX_MAP_SOURCE.slice(MDX_MAP_SOURCE.indexOf('BLOG_I3_MDX'));
    const keys = [...exportBlock.matchAll(/^\s*'?([a-z0-9-]+)'?:\s*\w+,/gmu)].map(
      ([, key]) => key!,
    );
    expect(new Set(keys)).toEqual(new Set(OWNED_SLUGS));
  });
});

describe('blog batch I3 — MDX prose (content.test.ts equivalents, scoped to this batch)', () => {
  it('every owned slug has an MDX file on disk', () => {
    for (const record of BLOG_I3_RECORDS) {
      expect(() => mdxSourceFor(record), record.id).not.toThrow();
    }
  });

  it('clears the blog index threshold it claims (§40)', () => {
    const failures: string[] = [];
    for (const record of BLOG_I3_RECORDS) {
      const unmet = unmetIndexRequirements(record, measurementOf(record));
      if (unmet.length > 0) failures.push(`${record.id}: ${unmet.join('; ')}`);
    }
    expect(failures).toEqual([]);
  });

  it('states the reading time its own text implies', () => {
    for (const record of BLOG_I3_RECORDS) {
      const expected = estimateReadMinutes(measurementOf(record).proseCharacters);
      expect(record.readMinutes, record.id).toBe(expected);
    }
  });

  it('contains no import/export and no top-level heading', () => {
    for (const record of BLOG_I3_RECORDS) {
      const measurement = measurementOf(record);
      expect(measurement.hasEsmStatement, record.id).toBe(false);
      expect(measurement.hasTopLevelHeading, record.id).toBe(false);
    }
  });

  it('names only allow-listed components', () => {
    const offenders: string[] = [];
    for (const record of BLOG_I3_RECORDS) {
      for (const name of measurementOf(record).componentUses) {
        if (!ALLOWED_COMPONENTS.has(name)) offenders.push(`${record.id}: <${name}>`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('opens with a <QuickAnswer>, has ≥3 unique ## sections, and a FAQ section with ≥2 ### questions (WP-S3-07 shape)', () => {
    for (const record of BLOG_I3_RECORDS) {
      const source = mdxSourceFor(record);
      expect(source.trimStart().startsWith('<QuickAnswer'), `${record.id}: QuickAnswer first`).toBe(
        true,
      );
      expect(source, `${record.id}: no <FAQ> alongside the heading convention`).not.toMatch(
        /<FAQ\b/u,
      );
      const h2s = [...source.matchAll(/^##\s+(.+)$/gmu)].map(([, text]) => text!.trim());
      expect(h2s.length, `${record.id}: ## count`).toBeGreaterThanOrEqual(3);
      expect(new Set(h2s).size, `${record.id}: unique ##`).toBe(h2s.length);
      const faqStart = source.indexOf('## 사람들이 자주 헷갈리는 부분');
      expect(faqStart, `${record.id}: FAQ heading`).toBeGreaterThan(-1);
      const faqBlock = source.slice(faqStart).split(/\n##\s/u)[0] ?? '';
      const questions = [...faqBlock.matchAll(/^###\s+.+\?$/gmu)];
      expect(questions.length, `${record.id}: FAQ questions`).toBeGreaterThanOrEqual(2);
    }
  });

  it('embeds exactly one <ToolCTA> in the prose itself (§35 mid-content, not only in relations)', () => {
    for (const record of BLOG_I3_RECORDS) {
      expect(mdxSourceFor(record).match(/<ToolCTA\b/gu)?.length, record.id).toBe(1);
    }
  });

  it('every <Term> is used once, resolves to a real glossary entry, and is a declared relatedConcept', () => {
    const byId = new Map(ALL_CONTENT.map((entry) => [entry.id, entry]));
    const problems: string[] = [];
    for (const record of BLOG_I3_RECORDS) {
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

  it('every in-body internal link points at a record that exists (blog/learn/hands)', () => {
    const bySlug = new Map(ALL_CONTENT.map((entry) => [`${entry.kind}/${entry.slug}`, entry]));
    const problems: string[] = [];
    for (const record of BLOG_I3_RECORDS) {
      const source = mdxSourceFor(record);
      for (const [, href] of source.matchAll(/\]\((\/[a-z0-9/-]+)\)/gu)) {
        const [, kind, slug] = href!.split('/');
        if (kind === 'tools') continue;
        if (!bySlug.has(`${kind}/${slug}`)) problems.push(`${record.id}: ${href}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('every <PokerCards hand="..."> names one of the 169 real hand classes', () => {
    const offenders: string[] = [];
    for (const record of BLOG_I3_RECORDS) {
      const source = mdxSourceFor(record);
      for (const [, hand] of source.matchAll(/<PokerCards\s+hand="([^"]+)"/gu)) {
        if (handClassByKey(hand!) === undefined) offenders.push(`${record.id}: hand="${hand}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every <PokerCards cards="..."> and <BoardCards> parses as real, distinct cards', () => {
    const offenders: string[] = [];
    for (const record of BLOG_I3_RECORDS) {
      const source = mdxSourceFor(record);
      for (const [, cardsArg] of source.matchAll(/<PokerCards\s+cards="([^"]+)"/gu)) {
        const parsed = parseCards(cardsArg ?? '');
        if (!parsed.ok) offenders.push(`${record.id}: cards="${cardsArg}" (${parsed.error})`);
      }
      for (const [, flop, turn, river] of source.matchAll(
        /<BoardCards\s+flop="([^"]+)"\s+turn="([^"]+)"\s+river="([^"]+)"/gu,
      )) {
        const parsed = parseCards(`${flop} ${turn} ${river}`);
        if (!parsed.ok || parsed.value.length !== 5) {
          offenders.push(`${record.id}: board "${flop} ${turn} ${river}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every <Fact> name/arg actually computes (run through the real facts.ts, never reasoned)', () => {
    const offenders: string[] = [];
    for (const record of BLOG_I3_RECORDS) {
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
    for (const record of BLOG_I3_RECORDS) {
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
    for (const record of BLOG_I3_RECORDS) {
      const source = mdxSourceFor(record);
      expect(source, record.id).not.toMatch(/GTO/iu);
      expect(source, record.id).not.toMatch(/수익성\s*있|이득입니다|플러스\s*EV/u);
      expect(source, record.id).not.toMatch(/(항상|무조건|반드시)\s*[^.?]*해야\s*합니다/u);
    }
  });
});

describe('blog batch I3 — ruling 28: btn-why-wide makes no strategy claim', () => {
  const record = BLOG_I3_RECORDS.find((entry) => entry.id === 'blog-btn-why-wide');

  it('the record exists in this batch', () => {
    expect(record).toBeDefined();
  });

  it('never ASSERTS that a wider BTN range is profitable/correct — only discusses and denies it', () => {
    // This article's honest job (ruling 30/38) is to name the claim it refuses to make —
    // "이득이다", "맞는 방식이다" — inside its own disclaimer, and then deny it. A whole-body
    // substring check cannot tell that denial from an assertion (ruling 38: "a test that
    // forbids a phrase must know where the phrase is allowed to appear"), so this strips the
    // `<Callout>` disclaimer and every sentence that itself carries a negation marker
    // (아닙니다/않습니다/범위 밖/다루지 않습니다), then checks only what remains.
    if (record === undefined) throw new Error('blog-btn-why-wide not found');
    const source = mdxSourceFor(record);
    const withoutCallouts = source.replace(/<Callout[\s\S]*?<\/Callout>/gu, '');
    const sentences = withoutCallouts.split(/(?<=[.!?])\s+|\n+/u);
    const affirmative = sentences
      .filter((sentence) => !/아닙니다|않습니다|범위\s*밖/u.test(sentence))
      .join(' ');
    expect(affirmative).not.toMatch(/이득|더\s*좋은\s*자리|정답|맞는\s*방식|써야\s*합니다/u);
  });

  it('DOES name and deny the exact strategy claim it refuses to make (honest content per ruling 38)', () => {
    if (record === undefined) throw new Error('blog-btn-why-wide not found');
    const source = mdxSourceFor(record);
    expect(source).toMatch(/이득/u);
    expect(source).toMatch(/맞는\s*방식/u);
    expect(source).toMatch(/아닙니다/u);
  });

  it('cites only RFI_* facts and mechanical counts — no HAND_RANK / EQUITY claims', () => {
    // WP-S3-07 added `COMBO_COUNT` (the 1,326 two-card combinations the percentages are
    // taken against) — a deck constant, not a strength or profitability claim, so it keeps the
    // intent of this guard: the article may count, never rank or value.
    if (record === undefined) throw new Error('blog-btn-why-wide not found');
    const source = mdxSourceFor(record);
    const factNames = [...source.matchAll(/<Fact\s+name="([^"]+)"/gu)].map(([, name]) => name!);
    for (const name of factNames) {
      expect(['RFI_COMBOS', 'RFI_PERCENT', 'RFI_POSITIONS_WITH', 'COMBO_COUNT']).toContain(name);
    }
  });
});

describe('blog batch I3 — btn-why-wide: every narrative claim about the baseline ranges is pinned to the dataset', () => {
  const rfi = (position: StrategyPosition) =>
    resolveRange({ heroPosition: position, spot: 'RFI', stackDepth: 100, tableSize: 6 });

  it('"UTG → HJ → CO → BTN 으로 갈수록 조합 수가 한 번도 줄지 않고 늘어난다"', () => {
    const counts = (['UTG', 'HJ', 'CO', 'BTN'] as const).map((position) => {
      const resolution = rfi(position);
      if (resolution.kind !== 'RANGE') throw new Error(`no range for ${position}`);
      return resolution.comboCount;
    });
    for (let i = 1; i < counts.length; i += 1) {
      expect(counts[i]!, `${i}`).toBeGreaterThan(counts[i - 1]!);
    }
  });

  it('"SB 행의 첫 레이즈 조합 수가 BTN보다 많다" (the FAQ denies that SB is narrower)', () => {
    const sb = rfi('SB');
    const btn = rfi('BTN');
    if (sb.kind !== 'RANGE' || btn.kind !== 'RANGE') throw new Error('no range');
    expect(sb.comboCount).toBeGreaterThan(btn.comboCount);
  });

  it('"BTN도 전체 조합의 절반이 되지 않는다"', () => {
    const btn = rfi('BTN');
    if (btn.kind !== 'RANGE') throw new Error('no range');
    expect(btn.percentage).toBeLessThan(0.5);
  });

  it('"앞자리에서 쓰던 패가 빠지지는 않는다": UTG ⊆ HJ ⊆ CO ⊆ BTN over all 169 classes', () => {
    const chain = ['UTG', 'HJ', 'CO', 'BTN'] as const;
    for (let i = 1; i < chain.length; i += 1) {
      const narrower = rfi(chain[i - 1]!);
      const wider = rfi(chain[i]!);
      if (narrower.kind !== 'RANGE' || wider.kind !== 'RANGE') throw new Error('no range');
      const dropped = HAND_CLASSES.filter(
        (handClass) =>
          hasHandClass(narrower.range, handClass.index) &&
          !hasHandClass(wider.range, handClass.index),
      ).map((handClass) => handClass.key);
      expect(dropped, `${chain[i - 1]} → ${chain[i]}`).toEqual([]);
    }
  });

  it('"A5s는 첫 레이즈가 가능한 모든 자리의 목록에 들어 있다" and "72o는 한 자리도 없다"', () => {
    expect(factValue('RFI_POSITIONS_WITH', 'A5s')).toBe('UTG · HJ · CO · BTN · SB');
    expect(factValue('RFI_POSITIONS_WITH', '72o')).toBe('한 자리도 없습니다');
  });

  it('"65s는 UTG·HJ·CO의 첫 레이즈 목록에 없다"', () => {
    const positions = factValue('RFI_POSITIONS_WITH', '65s').split(' · ');
    for (const position of ['UTG', 'HJ', 'CO']) expect(positions).not.toContain(position);
    expect(positions).toContain('BTN');
  });
});

describe('blog batch I3 — ruling 28: what-is-kicker showdowns are evaluator-verified', () => {
  it('absorbed from same-pair-who-wins: Hero (As Qc) beats Villain (Ah Jc) on Ks Kd 7h 4c 2s — same King pair, first kicker ties (A), second decides (Q > J)', () => {
    const board = 'Ks Kd 7h 4c 2s';
    const hero = bestFiveOf(cards(`As Qc ${board}`));
    const villain = bestFiveOf(cards(`Ah Jc ${board}`));
    expect(hero.value.category).toBe('PAIR');
    expect(villain.value.category).toBe('PAIR');
    expect(hero.value.ranks[0]).toBe(villain.value.ranks[0]); // same pair (Kings)
    expect(hero.value.ranks[1]).toBe(villain.value.ranks[1]); // first kicker ties (Ace)
    expect(hero.value.ranks[2]).toBeGreaterThan(villain.value.ranks[2]!); // Q > J
    expect(compareHands(hero.value.strength, villain.value.strength)).toBe(1);
  });

  it('one-pair keeps three kickers; two-pair one; trips two (the DataTable rows)', () => {
    expect(bestFiveOf(cards('As Qc Ks Kd 7h 4c 2s')).value.ranks).toHaveLength(1 + 3);
    expect(bestFiveOf(cards('Ah 2c Kh Kd 9s 9c 4d')).value.ranks).toHaveLength(2 + 1);
    expect(bestFiveOf(cards('As Kd 7h 7d 7c 2s 3d')).value.ranks).toHaveLength(1 + 2);
    expect(bestFiveOf(cards('Kh Qd Jc Ts 9h')).value.ranks).toHaveLength(1); // straight: none
  });

  it('Hero (Ac Kd) beats Villain (Ad Qh) on Ah Td 6c 3s 2d — same Ace pair, first kicker decides', () => {
    expect(showdown('Ac Kd Ah Td 6c 3s 2d', 'Ad Qh Ah Td 6c 3s 2d')).toBe(1);
  });

  it('two pair on board Kh Kd 9s 9c 4d: Ah 2c beats Qs 3d on the single kicker', () => {
    const board = 'Kh Kd 9s 9c 4d';
    expect(bestFiveOf(cards(`Ah 2c ${board}`)).value.category).toBe('TWO_PAIR');
    expect(bestFiveOf(cards(`Qs 3d ${board}`)).value.category).toBe('TWO_PAIR');
    expect(showdown(`Ah 2c ${board}`, `Qs 3d ${board}`)).toBe(1);
  });

  it('trips on board 7h 7d 7c 2s 3d: As Kd beats Ah Qc on the second kicker', () => {
    const board = '7h 7d 7c 2s 3d';
    expect(bestFiveOf(cards(`As Kd ${board}`)).value.category).toBe('TRIPS');
    expect(showdown(`As Kd ${board}`, `Ah Qc ${board}`)).toBe(1);
  });

  it('on Kh Qd Jc Ts 9h, 2c 3d and 4s 5c both just play the board — no kicker reached, split', () => {
    const board = 'Kh Qd Jc Ts 9h';
    expect(bestFiveOf(cards(`2c 3d ${board}`)).value.category).toBe('STRAIGHT');
    expect(showdown(`2c 3d ${board}`, `4s 5c ${board}`)).toBe(0);
  });

  it('kickers all equal → split: As Qc vs Ad Qh on Ah Kd 9c 5s 2d', () => {
    expect(showdown('As Qc Ah Kd 9c 5s 2d', 'Ad Qh Ah Kd 9c 5s 2d')).toBe(0);
  });

  it('a low hole card never reaches the best five: As 3c vs Ad 2h on Ah Kd Qc Js 4d is a split', () => {
    const board = 'Ah Kd Qc Js 4d';
    const hero = bestFiveOf(cards(`As 3c ${board}`));
    expect(hero.value.category).toBe('PAIR');
    expect(hero.value.ranks).toEqual([12, 11, 10, 9]); // A pair, K Q J kickers — the 3 is out
    expect(showdown(`As 3c ${board}`, `Ad 2h ${board}`)).toBe(0);
  });
});

describe('blog batch I3 — ruling 28: playing-the-board showdowns are evaluator-verified', () => {
  const STRAIGHT_BOARD = '5h 6d 7c 8s 9h';

  it('on 5h 6d 7c 8s 9h, 2c 3d and Ac Kd both play the board — genuine split', () => {
    expect(bestFiveOf(cards(`2c 3d ${STRAIGHT_BOARD}`)).value.category).toBe('STRAIGHT');
    expect(bestFiveOf(cards(`Ac Kd ${STRAIGHT_BOARD}`)).value.category).toBe('STRAIGHT');
    expect(showdown(`2c 3d ${STRAIGHT_BOARD}`, `Ac Kd ${STRAIGHT_BOARD}`)).toBe(0);
  });

  it('a ten extends it (T-high beats the board), J-T extends it further (J-high) and is the nuts', () => {
    expect(showdown(`Tc 2c ${STRAIGHT_BOARD}`, `2c 3d ${STRAIGHT_BOARD}`)).toBe(1);
    expect(showdown(`Jh Tc ${STRAIGHT_BOARD}`, `Td 2c ${STRAIGHT_BOARD}`)).toBe(1);
    const nuts = bestFiveOf(cards(`Jh Tc ${STRAIGHT_BOARD}`));
    expect(nuts.value.category).toBe('STRAIGHT');
    // Nothing among all two-card holdings beats J-T here.
    const board = cards(STRAIGHT_BOARD);
    const rest = ALL_CARDS.filter((card) => !board.includes(card));
    for (let i = 0; i < rest.length; i += 1) {
      for (let j = i + 1; j < rest.length; j += 1) {
        const hand = bestFiveOf([rest[i]!, rest[j]!, ...board]);
        expect(compareHands(hand.value.strength, nuts.value.strength)).toBeLessThanOrEqual(0);
      }
    }
  });

  it('on 9h 9d 7c 4s 2h, Ac 9c trips beats Kd Qd (pair with K·Q kickers), and NO holding ties the board', () => {
    const boardText = '9h 9d 7c 4s 2h';
    const hero = bestFiveOf(cards(`Ac 9c ${boardText}`));
    const villain = bestFiveOf(cards(`Kd Qd ${boardText}`));
    expect(hero.value.category).toBe('TRIPS');
    expect(villain.value.category).toBe('PAIR');
    expect(villain.value.ranks).toEqual([7, 11, 10, 5]); // 9 pair, K Q 7 kickers
    expect(compareHands(hero.value.strength, villain.value.strength)).toBe(1);
    const board = cards(boardText);
    const boardOnly = bestFiveOf(board);
    const rest = ALL_CARDS.filter((card) => !board.includes(card));
    for (let i = 0; i < rest.length; i += 1) {
      for (let j = i + 1; j < rest.length; j += 1) {
        const hand = bestFiveOf([rest[i]!, rest[j]!, ...board]);
        expect(compareHands(hand.value.strength, boardOnly.value.strength)).toBe(1);
      }
    }
  });

  it('board flush Ah Kh 9h 5h 2h: Qh 3c beats the board-only hand and Th 4c; Th 4c also beats the board', () => {
    const board = 'Ah Kh 9h 5h 2h';
    expect(bestFiveOf(cards(`Jc Td ${board}`)).value.category).toBe('FLUSH');
    expect(showdown(`Qh 3c ${board}`, `Jc Td ${board}`)).toBe(1);
    expect(showdown(`Th 4c ${board}`, `Jc Td ${board}`)).toBe(1);
    expect(showdown(`Qh 3c ${board}`, `Th 4c ${board}`)).toBe(1);
  });

  it('board full house Kh Kd Kc 7s 7d: Ah Qd, 2c 3d AND 7c 2d all just play the board; only quads (the last King, or both remaining sevens) beat it', () => {
    const boardText = 'Kh Kd Kc 7s 7d';
    expect(showdown(`Ah Qd ${boardText}`, `2c 3d ${boardText}`)).toBe(0);
    expect(showdown(`7c 2d ${boardText}`, `2c 3d ${boardText}`)).toBe(0);
    expect(showdown(`Ks 2d ${boardText}`, `2c 3d ${boardText}`)).toBe(1);
    expect(bestFiveOf(cards(`Ks 2d ${boardText}`)).value.category).toBe('QUADS');
    expect(bestFiveOf(cards(`7c 7h ${boardText}`)).value.category).toBe('QUADS');
    const board = cards(boardText);
    const boardOnly = bestFiveOf(board);
    const rest = ALL_CARDS.filter((card) => !board.includes(card));
    const ks = cards('Ks')[0]!;
    const [sevenC, sevenH] = cards('7c 7h');
    const SEVEN = bestFiveOf(cards('7c 2d Kh Kd Kc 7s 7d')).value.ranks[1]!; // the pair slot of K-full-of-7s
    for (let i = 0; i < rest.length; i += 1) {
      for (let j = i + 1; j < rest.length; j += 1) {
        const holding = [rest[i]!, rest[j]!];
        const hand = bestFiveOf([...holding, ...board]);
        const beats = compareHands(hand.value.strength, boardOnly.value.strength) === 1;
        const quads =
          holding.includes(ks) || (holding.includes(sevenC!) && holding.includes(sevenH!));
        // "7보다 높은 포켓 페어로 더 높은 풀하우스" — K trips + a higher pair than the board's 7s.
        const higherFullHouse =
          hand.value.category === 'FULL_HOUSE' && hand.value.ranks[1]! > SEVEN;
        if (quads) expect(hand.value.category, holding.join(' ')).toBe('QUADS');
        expect(beats, holding.join(' ')).toBe(quads || higherFullHouse);
      }
    }
    // The higher-full-house route is exactly a pocket pair above 7 (88 … AA; KK is impossible).
    expect(showdown(`8c 8h ${boardText}`, `2c 3d ${boardText}`)).toBe(1);
    expect(bestFiveOf(cards(`8c 8h ${boardText}`)).value.category).toBe('FULL_HOUSE');
    expect(showdown(`6c 6h ${boardText}`, `2c 3d ${boardText}`)).toBe(0);
  });
});

describe('blog batch I3 — ruling 28: a2345-wheel claims are evaluator-verified', () => {
  it('A2345 IS evaluated as a straight (the wheel, five-high), also from A5 + a 2-3-4 board', () => {
    expect(bestFiveOf(cards('Ah 2c 3d 4c 5s')).value.category).toBe('STRAIGHT');
    const fromBoard = bestFiveOf(cards('Ah 5h 2c 3d 4s Kc 9d'));
    expect(fromBoard.value.category).toBe('STRAIGHT');
    expect(fromBoard.value.ranks).toEqual([3]); // five-high
  });

  it('QKA23 and KA234 are NOT straights — no wrap-around; both are ace-high', () => {
    expect(bestFiveOf(cards('Qh Kc Ad 2c 3s')).value.category).toBe('HIGH_CARD');
    expect(bestFiveOf(cards('Kh Ac 2d 3c 4s')).value.category).toBe('HIGH_CARD');
  });

  it('the ten straights in the DataTable are all straights, strictly ordered from Broadway down to the wheel', () => {
    const rows = [
      'Th Jc Qd Kc As',
      '9h Tc Jd Qc Ks',
      '8h 9c Td Jc Qs',
      '7h 8c 9d Tc Js',
      '6h 7c 8d 9c Ts',
      '5h 6c 7d 8c 9s',
      '4h 5c 6d 7c 8s',
      '3h 4c 5d 6c 7s',
      '2h 3c 4d 5c 6s',
      'Ah 2c 3d 4c 5s',
    ];
    const strengths = rows.map((row) => {
      const hand = bestFiveOf(cards(row));
      expect(hand.value.category, row).toBe('STRAIGHT');
      return hand.value.strength;
    });
    for (let i = 1; i < strengths.length; i += 1) {
      expect(compareHands(strengths[i - 1]!, strengths[i]!), rows[i]).toBe(1);
    }
    expect(new Set(rows.map((row) => bestFiveOf(cards(row)).value.ranks[0])).size).toBe(10);
  });

  it('StatsRow verdicts: wheel loses to 6-high and to Broadway, beats K trips', () => {
    expect(showdown('Ah 2c 3d 4c 5s', '2h 3c 4d 5c 6s')).toBe(-1);
    expect(showdown('Ah 2c 3d 4c 5s', 'Th Jc Qd Kc As')).toBe(-1);
    expect(showdown('Ah 2c 3d 4c 5s', 'Kh Kc Kd 2s 3s')).toBe(1);
  });

  it('two wheels of different suits split', () => {
    expect(showdown('Ah 2c 3d 4c 5s', 'As 2d 3h 4h 5d')).toBe(0);
  });

  it('steel wheel: same-suit A2345 is a straight flush, below 23456 suited, above an A-high flush', () => {
    expect(bestFiveOf(cards('Ah 2h 3h 4h 5h')).value.category).toBe('STRAIGHT_FLUSH');
    expect(showdown('Ah 2h 3h 4h 5h', '2c 3c 4c 5c 6c')).toBe(-1);
    expect(showdown('Ah 2h 3h 4h 5h', 'Ac Kc Qc Jc 9c')).toBe(1);
  });
});
