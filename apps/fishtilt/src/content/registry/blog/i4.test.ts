/**
 * @vitest-environment node
 *
 * WP-I4's own batch gate — same reasoning as `registry/blog/i2.test.ts` and the other batch
 * gates: this workspace's `vitest.config.ts` registers no MDX transform for the `fishtilt`
 * project, so importing a real `.mdx` file fails at Vite's import-analysis step before any
 * JSX runs (`docs/reports/WP_QA_MDX_TEST_GAP.md`). So "renders without throwing" is verified
 * the way `content.test.ts` verifies every other batch: by reading the raw `.mdx` source as
 * text and statically checking every property a render would otherwise catch.
 *
 * Per ruling 26 (`docs/FISHTILT_STATE.md`): this batch's five owned slugs are a fixed,
 * permanent assignment from WP-G4/the content plan §2.2 "I4", not a fact about the site's
 * current state, so listing them as a literal fixture here does not go stale.
 *
 * This batch's central risk is duplication with the lesson each of three articles sits
 * directly on top of (`pot-odds-quick` vs `pot-odds`, `outs-nine` vs `outs`, `why-use-range`
 * vs `poker-range`) and the exact-convention rule for `why-called-3bet` (ruling 18). The
 * "hand-off sentence" tests below assert the §2.3 sentence is present verbatim (bracket
 * placeholder filled with the real lesson reference), not just that a link field is set.
 *
 * Every `<Fact>` this batch cites for its two calculation articles is additionally checked
 * against a hand-derived expected value below (not just "does not throw"), per the brief's
 * requirement to verify worked examples by running them against the real
 * `potOdds`/`outsOdds` in `@gto-self/learn-core`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { handClassByKey } from '@gto-self/strategy-core';
import { outsOdds, potOdds } from '@gto-self/learn-core';
import { Money, parseCards } from '@gto-self/shared';
import { MDX_COMPONENT_ALLOW_LIST } from '../../allowList.js';
import { factValue, type FactName } from '../../facts.js';
import { ALL_CONTENT } from '../index.js';
import { ROUTES } from '../../../lib/routes.js';
import { BLOG_I4_RECORDS } from './i4.js';
import {
  estimateReadMinutes,
  measureContent,
  unmetIndexRequirements,
  type ContentMeasurement,
} from '../../threshold.js';
import type { BlogRecord } from '../../types.js';

const CONTENT_DIR = fileURLToPath(new URL('../../../../content/blog/', import.meta.url));
const MDX_MAP_SOURCE = readFileSync(
  fileURLToPath(new URL('../../blog/i4.ts', import.meta.url)),
  'utf8',
);

/** The five slugs `docs/FISHTILT_CONTENT_PLAN.md` §2.2 "I4" assigns to this batch. Fixed —
 * see the module doc on why this is a safe literal fixture rather than a derived one. */
const OWNED_SLUGS = [
  'why-blinds-exist',
  'why-called-3bet',
  'why-use-range',
  'pot-odds-quick',
  'outs-nine',
] as const;

const ALLOWED_COMPONENTS = new Set<string>(MDX_COMPONENT_ALLOW_LIST);

function mdxSourceFor(record: BlogRecord): string {
  return readFileSync(`${CONTENT_DIR}${record.slug}.mdx`, 'utf8');
}

const MEASURED: ReadonlyMap<string, ContentMeasurement> = new Map(
  BLOG_I4_RECORDS.map((record) => [record.id, measureContent(mdxSourceFor(record))]),
);

function measurementOf(record: BlogRecord): ContentMeasurement {
  const measurement = MEASURED.get(record.id);
  if (measurement === undefined) throw new Error(`no measurement for ${record.id}`);
  return measurement;
}

function recordBySlug(slug: string): BlogRecord {
  const record = BLOG_I4_RECORDS.find((candidate) => candidate.slug === slug);
  if (record === undefined) throw new Error(`no I4 record for slug ${slug}`);
  return record;
}

describe('blog batch I4 — registry', () => {
  it('registers exactly the five owned slugs, once each', () => {
    const slugs = BLOG_I4_RECORDS.map((record) => record.slug);
    expect(new Set(slugs)).toEqual(new Set(OWNED_SLUGS));
    expect(slugs.length).toBe(OWNED_SLUGS.length);
  });

  it('every owned record is PUBLISHED, indexable, with a positive readMinutes', () => {
    for (const record of BLOG_I4_RECORDS) {
      expect(record.status, record.id).toBe('PUBLISHED');
      expect(record.indexable, record.id).toBe(true);
      expect(record.readMinutes, record.id).not.toBeNull();
      expect(record.readMinutes ?? 0, record.id).toBeGreaterThan(0);
    }
  });

  it('WP-S3-07: every record states the search query in seoTitle, distinct from the H1', () => {
    for (const record of BLOG_I4_RECORDS) {
      expect(record.seoTitle, record.id).toBeDefined();
      expect(record.seoTitle, record.id).not.toBe(record.title);
      expect(record.seoTitle?.length ?? 0, record.id).toBeGreaterThan(10);
    }
  });

  it('WP-S3-07: content types follow the Stage 3 audit (B16–B20; B17/B18 moved role)', () => {
    expect(recordBySlug('outs-nine').contentType).toBe('data-probability');
    expect(recordBySlug('pot-odds-quick').contentType).toBe('data-probability');
    expect(recordBySlug('why-use-range').contentType).toBe('search-guide');
    expect(recordBySlug('why-blinds-exist').contentType).toBe('concept-culture');
    expect(recordBySlug('why-called-3bet').contentType).toBe('concept-culture');
  });

  it('carries the outbound links a blog answer needs (build spec §35 / plan §2.2)', () => {
    for (const record of BLOG_I4_RECORDS) {
      expect(record.relatedTools.length, `${record.id}: relatedTools`).toBeGreaterThanOrEqual(1);
      expect(record.relatedConcepts.length, `${record.id}: relatedConcepts`).toBeGreaterThanOrEqual(
        1,
      );
      const nextSteps = record.nextLessons.length + record.relatedArticles.length;
      expect(nextSteps, `${record.id}: next step`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('blog batch I4 — MDX map registration', () => {
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
    const exportBlock = MDX_MAP_SOURCE.slice(MDX_MAP_SOURCE.indexOf('BLOG_I4_MDX'));
    const keys = [...exportBlock.matchAll(/^\s*'?([a-z0-9-]+)'?:\s*\w+,/gmu)].map(
      ([, key]) => key!,
    );
    expect(new Set(keys)).toEqual(new Set(OWNED_SLUGS));
  });
});

describe('blog batch I4 — MDX prose (content.test.ts equivalents, scoped to this batch)', () => {
  it('every owned slug has an MDX file on disk', () => {
    for (const record of BLOG_I4_RECORDS) {
      expect(() => mdxSourceFor(record), record.id).not.toThrow();
    }
  });

  it('clears the blog index threshold it claims (§40)', () => {
    const failures: string[] = [];
    for (const record of BLOG_I4_RECORDS) {
      const unmet = unmetIndexRequirements(record, measurementOf(record));
      if (unmet.length > 0) failures.push(`${record.id}: ${unmet.join('; ')}`);
    }
    expect(failures).toEqual([]);
  });

  it('states the reading time its own text implies', () => {
    for (const record of BLOG_I4_RECORDS) {
      const expected = estimateReadMinutes(measurementOf(record).proseCharacters);
      expect(record.readMinutes, record.id).toBe(expected);
    }
  });

  it('contains no import/export and no top-level heading', () => {
    for (const record of BLOG_I4_RECORDS) {
      const measurement = measurementOf(record);
      expect(measurement.hasEsmStatement, record.id).toBe(false);
      expect(measurement.hasTopLevelHeading, record.id).toBe(false);
    }
  });

  it('names only allow-listed components', () => {
    const offenders: string[] = [];
    for (const record of BLOG_I4_RECORDS) {
      for (const name of measurementOf(record).componentUses) {
        if (!ALLOWED_COMPONENTS.has(name)) offenders.push(`${record.id}: <${name}>`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('embeds exactly one <ToolCTA> in the prose itself (§35 mid-content, not only in relations)', () => {
    for (const record of BLOG_I4_RECORDS) {
      expect(mdxSourceFor(record).match(/<ToolCTA\b/gu)?.length, record.id).toBe(1);
    }
  });

  it('WP-S3-07: opens with <QuickAnswer>, never uses <FAQ>, and keeps every ## unique', () => {
    for (const record of BLOG_I4_RECORDS) {
      const source = mdxSourceFor(record);
      expect(source.trimStart().startsWith('<QuickAnswer>'), `${record.id}: first element`).toBe(
        true,
      );
      expect(source, `${record.id}: <FAQ> and the ### convention never together`).not.toMatch(
        /<FAQ\b/u,
      );
      const h2s = [...source.matchAll(/^##\s+(.+)$/gmu)].map(([, text]) => text!.trim());
      expect(h2s.length, `${record.id}: sections for the TOC`).toBeGreaterThanOrEqual(3);
      expect(new Set(h2s).size, `${record.id}: duplicate ##`).toBe(h2s.length);
    }
  });

  it('WP-S3-07: the FAQ section carries at least two real ### questions, each a question', () => {
    for (const record of BLOG_I4_RECORDS) {
      const source = mdxSourceFor(record);
      const start = source.indexOf('## 사람들이 자주 헷갈리는 부분');
      expect(start, `${record.id}: FAQ section`).toBeGreaterThan(-1);
      const questions = [...source.slice(start).matchAll(/^###\s+(.+)$/gmu)].map(([, q]) =>
        q!.trim(),
      );
      expect(questions.length, `${record.id}: FAQ items`).toBeGreaterThanOrEqual(2);
      for (const question of questions) expect(question, record.id).toMatch(/\?$/u);
    }
  });

  it('every <Term> is used once, resolves to a real glossary entry, and is a declared relatedConcept', () => {
    const byId = new Map(ALL_CONTENT.map((entry) => [entry.id, entry]));
    const problems: string[] = [];
    for (const record of BLOG_I4_RECORDS) {
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
    for (const record of BLOG_I4_RECORDS) {
      const source = mdxSourceFor(record);
      for (const [, hand] of source.matchAll(/<PokerCards\s+hand="([^"]+)"/gu)) {
        if (handClassByKey(hand!) === undefined) offenders.push(`${record.id}: hand="${hand}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every <PokerCards cards="..."> parses as real, distinct cards', () => {
    const offenders: string[] = [];
    for (const record of BLOG_I4_RECORDS) {
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
    for (const record of BLOG_I4_RECORDS) {
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
    for (const record of BLOG_I4_RECORDS) {
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

  it('every relatedTools id is a real, available route (never available: false)', () => {
    const routesById = new Map(ROUTES.map((route) => [route.id, route]));
    for (const record of BLOG_I4_RECORDS) {
      for (const toolId of record.relatedTools) {
        const route = routesById.get(toolId);
        expect(route, `${record.id}: relatedTools "${toolId}"`).toBeDefined();
        expect(route?.available, `${record.id}: relatedTools "${toolId}"`).toBe(true);
      }
    }
  });

  it('never types the banned GTO word, and never asserts a profitability/strength verdict (rule 0.10)', () => {
    for (const record of BLOG_I4_RECORDS) {
      const source = mdxSourceFor(record);
      expect(source, record.id).not.toMatch(/GTO/iu);
      expect(source, record.id).not.toMatch(/수익성\s*있|이득입니다|플러스\s*EV/u);
      expect(source, record.id).not.toMatch(/(항상|무조건|반드시)\s*[^.?]*해야\s*합니다/u);
    }
  });

  it('never presents money arithmetic results typed by hand outside a <Fact> (CLAUDE.md rule 1)', () => {
    // The two calculation articles state BB *inputs* in prose (pot/bet labels), which is not
    // money arithmetic, but every OUTPUT (a required equity or an outs probability) must come
    // from a <Fact>. Heuristic: no raw "%" sign appears outside a <Fact ... /> tag.
    for (const slug of ['pot-odds-quick', 'outs-nine']) {
      const source = mdxSourceFor(recordBySlug(slug));
      const withoutFacts = source.replace(/<Fact\s+name="[^"]+"(?:\s+arg="[^"]+")?\s*\/>/gu, '');
      expect(withoutFacts, slug).not.toMatch(/\d+(\.\d+)?%/u);
    }
  });
});

describe('blog batch I4 — anti-duplication: the §2.3 hand-off sentence is present verbatim', () => {
  it('why-use-range hands off to the poker-range lesson', () => {
    const source = mdxSourceFor(recordBySlug('why-use-range'));
    expect(source).toContain(
      '표를 읽는 법 자체가 처음이라면 [핸드레인지란?](/learn/poker-range)을 먼저 보세요. 이 글은 "왜 굳이 묶어서 보나"에만 답합니다.',
    );
  });

  it('pot-odds-quick hands off to the pot-odds lesson', () => {
    const source = mdxSourceFor(recordBySlug('pot-odds-quick'));
    expect(source).toContain(
      '팟오즈가 정확히 무엇을 재는 값인지부터 보고 싶다면 [팟오즈 레슨](/learn/pot-odds)을 먼저 읽어 주세요. 여기서는 이미 알고 있다고 보고, 계산만 빠르게 합니다.',
    );
  });

  it('outs-nine hands off to the outs lesson', () => {
    const source = mdxSourceFor(recordBySlug('outs-nine'));
    expect(source).toContain(
      '아웃츠라는 말 자체가 처음이라면 [아웃츠 레슨](/learn/outs)이 먼저입니다. 여기서는 9라는 숫자 하나만 끝까지 따라가 보겠습니다.',
    );
  });

  it('the three duplication-risk articles never reproduce their lesson worked-example numbers', () => {
    // `outs.mdx` opens on the exact same flush-draw scenario (9 outs) with FLOP|NEXT and
    // TURN|NEXT facts the lesson already shows, so `outs-nine` must not restate the lesson's
    // per-street breakdown.
    //
    // The FLOP|NEXT ban was originally absolute. WP-P1's F8 found why it could not stay that
    // way: the article's own synthesis priced the BY-RIVER probability (two cards to come)
    // against ONE call on the flop, and the honest comparison needs the next-card number.
    // MASTER accepted that fix (`docs/reports/WP_Q_DISPOSITION.md` §2, "the conclusion
    // flips"), so the correctness requirement and the anti-duplication rule collide and
    // correctness wins — but only by exactly one number. The rule is therefore narrowed, not
    // dropped: FLOP|NEXT may appear at most once, and only inside the pot-odds synthesis
    // section, which is what makes it a synthesis rather than a restatement of the lesson.
    // TURN|NEXT stays banned outright — the article never prices the turn.
    const outsNine = mdxSourceFor(recordBySlug('outs-nine'));
    const flopNext = [...outsNine.matchAll(/OUTS_PROB"\s+arg="9\|FLOP\|NEXT"/gu)];
    expect(flopNext.length, 'outs-nine may cite FLOP|NEXT once, for the pot-odds comparison').toBe(
      1,
    );
    const synthesisStart = outsNine.indexOf('## 이 숫자, 콜에 쓸 수 있나요?');
    const synthesisEnd = outsNine.indexOf('## 규칙은 이번에도 어긋나지만');
    expect(synthesisStart, 'the pot-odds synthesis section').toBeGreaterThan(-1);
    expect(synthesisEnd, 'the section after it').toBeGreaterThan(synthesisStart);
    const at = flopNext[0]?.index ?? -1;
    expect(at, 'FLOP|NEXT sits inside the pot-odds synthesis').toBeGreaterThan(synthesisStart);
    expect(at, 'FLOP|NEXT sits inside the pot-odds synthesis').toBeLessThan(synthesisEnd);
    expect(outsNine).not.toMatch(/OUTS_PROB"\s+arg="9\|TURN\|NEXT"/u);

    // `pot-odds-quick` must not reuse the lesson's own worked pot/bet pairs (10|5, 9|3, 3|2).
    const potOddsQuick = mdxSourceFor(recordBySlug('pot-odds-quick'));
    for (const pair of ['10|5', '9|3', '3|2']) {
      expect(potOddsQuick, pair).not.toMatch(
        new RegExp(`POT_ODDS_REQUIRED_EQUITY"\\s+arg="${pair.replace('|', '\\|')}"`, 'u'),
      );
    }

    // `why-use-range` must not restate the lesson's own K9s/K9o RFI_POSITIONS_WITH example or
    // its AKs HAND_COMBOS/HAND_SHARE example; it cites RFI_COMBOS/RFI_PERCENT for UTG/BTN
    // instead, a different fact pair the lesson never uses.
    const whyUseRange = mdxSourceFor(recordBySlug('why-use-range'));
    expect(whyUseRange).not.toMatch(/RFI_POSITIONS_WITH/u);
    expect(whyUseRange).not.toMatch(/HAND_COMBOS/u);
    expect(whyUseRange).not.toMatch(/HAND_SHARE/u);
  });
});

describe('blog batch I4 — ruling 18 (3-Bet counting convention)', () => {
  it('why-called-3bet states the recorded convention and does not invent a competing one', () => {
    const source = mdxSourceFor(recordBySlug('why-called-3bet'));
    // States the convention: BB forced post = 1st, open raise = 2nd, first re-raise = 3rd.
    expect(source).toMatch(/빅\s*블라인드[^.]*첫\s*번째/u);
    expect(source).toMatch(/오픈\s*레이즈[^.]*두\s*번째/u);
    expect(source).toMatch(/세\s*번째.*3-Bet/su);
    // Phrases it as the convention this site uses, not an invented origin story, and explicitly
    // declines to assert a competing count is equally used without evidence.
    //
    // The pinned phrase was `가장 널리 쓰이는 세는 방식` — a SUPERLATIVE prevalence claim, which
    // the site has no source for. ADR-0081 never says that; it says "the ordinary hold'em
    // convention", and its own consequence clause forbids calling a competing count equally
    // standard without a cited source. The same rule read symmetrically forbids ranking our own
    // as the most widely used. The ADR's decision (BB = first bet) is untouched; only WP-I4's
    // phrasing of it is narrowed to what the ADR actually licenses.
    expect(source).toMatch(/홀덤에서\s*일반적으로\s*쓰이는\s*세는\s*방식/u);
    expect(source, 'no unsourced superlative about prevalence').not.toMatch(/가장\s*널리/u);
    expect(source).not.toMatch(/유래|기원|처음\s*(생기|만들어)/u);
  });
});

describe('blog batch I4 — worked examples: exact numbers, verified against the real engines', () => {
  it('pot-odds-quick: 6|3 (half pot), 6|4 (two-thirds pot), 6|6 (full pot) + the less common sizes', () => {
    const cases: ReadonlyArray<readonly [number, number, number]> = [
      [6, 3, 25.0],
      [6, 4, 28.57],
      [6, 6, 33.33],
      [9, 6, 28.57], // same ratio as 6|4 — the article's own "same ratio, same number" claim
      [9, 3, 20.0], // used by outs-nine's synthesis section
      [8, 2, 16.67], // WP-S3-07 second table: 1/4 pot
      [8, 6, 30.0], // 3/4 pot
      [6, 9, 37.5], // 1.5x overbet
      [6, 12, 40.0], // 2x overbet
    ];
    for (const [pot, bet, expected] of cases) {
      const potMbb = Money.parseBB(String(pot));
      const betMbb = Money.parseBB(String(bet));
      if (!potMbb.ok || !betMbb.ok) throw new Error('bad fixture BB amount');
      const result = potOdds({
        potBeforeCallMbb: potMbb.value,
        villainBetMbb: betMbb.value,
        callAmountMbb: betMbb.value,
      });
      if (!result.ok) throw new Error(`potOdds(${pot}|${bet}) failed: ${result.error}`);
      const pct = Number((result.value.requiredEquity * 100).toFixed(2));
      expect(pct, `${pot}|${bet}`).toBeCloseTo(expected, 2);
      expect(factValue('POT_ODDS_REQUIRED_EQUITY', `${pot}|${bet}`), `${pot}|${bet}`).toBe(
        `${expected.toFixed(2)}%`,
      );
    }
  });

  it('pot-odds-quick: the typed final pots (12/14/18BB) are the Money sum, and 2x overbet stays under half', () => {
    const finalPot = (pot: string, bet: string): string => {
      const potMbb = Money.parseBB(pot);
      const betMbb = Money.parseBB(bet);
      if (!potMbb.ok || !betMbb.ok) throw new Error('bad fixture BB amount');
      return Money.formatBB(Money.add(Money.add(potMbb.value, betMbb.value), betMbb.value));
    };
    const source = mdxSourceFor(recordBySlug('pot-odds-quick'));
    for (const [bet, expected] of [
      ['3', '12'],
      ['4', '14'],
      ['6', '18'],
    ] as const) {
      expect(finalPot('6', bet), `6|${bet}`).toBe(expected);
      expect(source, `6|${bet} final pot typed as ${expected}BB`).toContain(
        `final: '${expected}BB'`,
      );
    }
    // "벳이 팟의 두 배까지 커져도 필요 승률은 절반에 닿지 않습니다"
    const potMbb = Money.parseBB('6');
    const betMbb = Money.parseBB('12');
    if (!potMbb.ok || !betMbb.ok) throw new Error('bad fixture BB amount');
    const double = potOdds({
      potBeforeCallMbb: potMbb.value,
      villainBetMbb: betMbb.value,
      callAmountMbb: betMbb.value,
    });
    if (!double.ok) throw new Error('potOdds(6|12) failed');
    expect(double.value.requiredEquity).toBeLessThan(0.5);
  });

  it('outs-nine: the 8-out and 15-out FAQ numbers and the turn number compute, and 9 sits between 8 and 15', () => {
    const eight = outsOdds({ outs: 8, street: 'FLOP' });
    const nine = outsOdds({ outs: 9, street: 'FLOP' });
    const fifteen = outsOdds({ outs: 15, street: 'FLOP' });
    const nineTurn = outsOdds({ outs: 9, street: 'TURN' });
    if (!eight.ok || !nine.ok || !fifteen.ok || !nineTurn.ok) throw new Error('outsOdds failed');
    expect(eight.value.byRiverProb).toBeLessThan(nine.value.byRiverProb); // "9장보다 한 장 적은 만큼 확률도 조금 낮습니다"
    expect(fifteen.value.byRiverProb).toBeGreaterThan(nine.value.byRiverProb); // "15장이 되고, 그때는 … 올라갑니다"
    expect(nineTurn.value.byRiverProb).toBeLessThan(nine.value.byRiverProb); // "턴을 넘기고 나면 … 내려가고"
    // "어림잡아 세 번에 한 번 정도 완성된다" — a narrative rounding of 34.97%, pinned to a band.
    expect(nine.value.byRiverProb).toBeGreaterThan(0.3);
    expect(nine.value.byRiverProb).toBeLessThan(0.4);
    for (const arg of ['8|FLOP|RIVER', '15|FLOP|RIVER', '9|TURN|RIVER']) {
      expect(() => factValue('OUTS_PROB', arg), arg).not.toThrow();
    }
  });

  it('why-use-range: the position table widens UTG → HJ → CO → BTN, SB has a table, BB has none', () => {
    const combos = (position: string): number =>
      Number(factValue('RFI_COMBOS', position).replace(/[^\d]/gu, ''));
    expect(combos('UTG')).toBeLessThan(combos('HJ'));
    expect(combos('HJ')).toBeLessThan(combos('CO'));
    expect(combos('CO')).toBeLessThan(combos('BTN'));
    expect(() => factValue('RFI_PERCENT', 'SB')).not.toThrow();
    // "빅 블라인드는 이 상황에서 첫 레이즈를 할 일이 없어 표가 없습니다" — the facade has no BB range.
    expect(() => factValue('RFI_PERCENT', 'BB')).toThrow();
  });

  it('outs-nine: 9 outs, FLOP->RIVER exact vs SHORTCUT_RIVER (shortcut runs HIGH here)', () => {
    const flop = outsOdds({ outs: 9, street: 'FLOP' });
    if (!flop.ok) throw new Error('outsOdds(9, FLOP) failed');
    const exactRiver = Number((flop.value.byRiverProb * 100).toFixed(2));
    const shortcutRiver = Number((flop.value.ruleOfTwoAndFour.byRiverProb * 100).toFixed(2));
    expect(exactRiver).toBeCloseTo(34.97, 2);
    expect(shortcutRiver).toBeCloseTo(36.0, 2);
    expect(shortcutRiver).toBeGreaterThan(exactRiver); // shortcut overstates at 9 outs
    expect(factValue('OUTS_PROB', '9|FLOP|RIVER')).toBe('34.97%');
    expect(factValue('OUTS_PROB', '9|FLOP|SHORTCUT_RIVER')).toBe('36.00%');
  });

  it('outs-nine synthesis: by-river clears the 9|3 bar, the next card does NOT', () => {
    const flop = outsOdds({ outs: 9, street: 'FLOP' });
    if (!flop.ok) throw new Error('outsOdds(9, FLOP) failed');
    const potMbb = Money.parseBB('9');
    const betMbb = Money.parseBB('3');
    if (!potMbb.ok || !betMbb.ok) throw new Error('bad fixture BB amount');
    const odds = potOdds({
      potBeforeCallMbb: potMbb.value,
      villainBetMbb: betMbb.value,
      callAmountMbb: betMbb.value,
    });
    if (!odds.ok) throw new Error('potOdds(9|3) failed');

    // Seeing BOTH remaining cards clears the price.
    expect(flop.value.byRiverProb).toBeGreaterThan(odds.value.requiredEquity);

    // One call on the flop does not buy both cards — it buys the turn. And the next-card
    // probability does NOT clear the same price. This is the whole of WP-P1's F8: the article
    // used to price `byRiverProb` against a single flop call and conclude the call was
    // arithmetically fine, and under the comparison it was actually making, it is not.
    // Both directions are pinned deliberately. The old test asserted only the first line and
    // was titled "9-out draw clears the break-even bar", which is exactly the claim the
    // article had to withdraw — a passing test that endorsed the defect.
    expect(flop.value.nextCardProb).toBeLessThan(odds.value.requiredEquity);
  });

  it("the shortcut's error does NOT have a fixed direction — 9 outs runs high, 4 outs runs low", () => {
    const nine = outsOdds({ outs: 9, street: 'FLOP' });
    const four = outsOdds({ outs: 4, street: 'FLOP' });
    if (!nine.ok || !four.ok) throw new Error('outsOdds failed');
    expect(nine.value.ruleOfTwoAndFour.byRiverError).toBeGreaterThan(0); // shortcut too high
    expect(four.value.ruleOfTwoAndFour.byRiverError).toBeLessThan(0); // shortcut too low
  });
});
