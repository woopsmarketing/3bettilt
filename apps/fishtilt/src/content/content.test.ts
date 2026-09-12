/**
 * @vitest-environment node
 *
 * Node, not the project's happy-dom default: this file reads content off disk, and under
 * happy-dom `import.meta.url` is an `http:` URL that `fileURLToPath` rejects. Nothing here
 * touches the DOM (same reasoning as `tests/layering.test.ts`).
 */
/**
 * The content graph's validation suite — build spec §67, audit §6.2.
 *
 * This file, not the registry, is the deliverable. A typed record stops a `nextLessons`
 * entry from being a number; it cannot stop it from being `'positon'`. Everything below is a
 * property that has to keep holding as ~100 pieces of content are written by later work
 * packages, checked mechanically rather than by review:
 *
 *   - every referenced content id exists;
 *   - every `relatedTools` entry names a real route in `src/lib/routes.ts`;
 *   - no duplicate slug and no dead internal link;
 *   - no orphan lesson — every one is reachable from `/learn`;
 *   - glossary aliases are unique and never collide with a term;
 *   - every lesson offers at least one tool and at least one next step (§35);
 *   - every `indexable: true` piece actually clears the minimum content threshold (§40);
 *   - MDX prose contains no `import`/`export` and names only allow-listed components (§79).
 */
import { DEFAULT_LOCALE, localeOfPath, sitePathOf } from '../lib/locale.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { handClassByKey } from '@gto-self/strategy-core';
import { ROUTES } from '../lib/routes.js';
import { extractFaqItems } from '../lib/seo/faq.js';
import { MDX_COMPONENT_ALLOW_LIST } from './allowList.js';
import {
  CONTENT_PREFIX,
  CONTENT_ROUTE_TEMPLATE,
  LEARN_ROADMAP,
  RELATION_HEADING,
  RELATION_KINDS,
  contentPath,
  findContent,
  glossaryRecords,
  hrefOfContent,
} from './graph.js';
import { ALL_CONTENT } from './registry/index.js';
import {
  estimateReadMinutes,
  measureContent,
  unmetIndexRequirements,
  type ContentMeasurement,
} from './threshold.js';
import { CONTENT_KINDS, type AnyContentRecord, type ContentKind } from './types.js';

const APP_DIR = fileURLToPath(new URL('../app', import.meta.url));
const CONTENT_DIR = fileURLToPath(new URL('../../content', import.meta.url));

/** The MDX file a record's prose lives in, whether or not it is written yet. */
function mdxPathFor(record: AnyContentRecord): string {
  return join(CONTENT_DIR, record.kind, `${record.slug}.mdx`);
}

const ROUTE_IDS = new Set(ROUTES.map((route) => route.id));

/** Every measurable published piece, measured once. */
const MEASURED: ReadonlyMap<string, ContentMeasurement> = new Map(
  ALL_CONTENT.filter((record) => record.status === 'PUBLISHED').map((record) => [
    record.id,
    measureContent(readFileSync(mdxPathFor(record), 'utf8')),
  ]),
);

function measurementOf(record: AnyContentRecord): ContentMeasurement {
  const measurement = MEASURED.get(record.id);
  if (measurement === undefined) throw new Error(`no measurement for ${record.id}`);
  return measurement;
}

describe('content registry — identity', () => {
  it('has content', () => {
    expect(ALL_CONTENT.length).toBeGreaterThan(0);
  });

  it('ids are unique across every kind', () => {
    const ids = ALL_CONTENT.map((record) => record.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('slugs are unique within a kind', () => {
    for (const kind of CONTENT_KINDS) {
      const slugs = ALL_CONTENT.filter((record) => record.kind === kind).map(
        (record) => record.slug,
      );
      expect(new Set(slugs).size, `duplicate slug in ${kind}`).toBe(slugs.length);
    }
  });

  it('slugs are URL-safe lower-kebab', () => {
    for (const record of ALL_CONTENT) {
      expect(record.slug, record.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
    }
  });

  it('every record has a title and a description a person can read', () => {
    for (const record of ALL_CONTENT) {
      expect(record.title.trim().length, record.id).toBeGreaterThan(0);
      expect(record.description.trim().length, record.id).toBeGreaterThan(10);
    }
  });

  it('never uses the word GTO anywhere in registry copy (CLAUDE.md rule 2)', () => {
    for (const record of ALL_CONTENT) {
      const text = `${record.title} ${record.description}`;
      expect(text, record.id).not.toMatch(/GTO/iu);
    }
  });
});

describe('content graph — every reference resolves', () => {
  it('every referenced content id exists', () => {
    const dangling: string[] = [];
    for (const record of ALL_CONTENT) {
      for (const relation of RELATION_KINDS) {
        if (relation === 'relatedTools') continue;
        for (const id of record[relation]) {
          if (findContent(id) === undefined) dangling.push(`${record.id}.${relation} -> ${id}`);
        }
      }
    }
    expect(dangling).toEqual([]);
  });

  it('every relatedTools entry names a real route id', () => {
    const unknown: string[] = [];
    for (const record of ALL_CONTENT) {
      for (const id of record.relatedTools) {
        if (!ROUTE_IDS.has(id)) unknown.push(`${record.id}.relatedTools -> ${id}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it('never references itself', () => {
    for (const record of ALL_CONTENT) {
      for (const relation of RELATION_KINDS) {
        if (relation === 'relatedTools') continue;
        expect(record[relation], `${record.id}.${relation}`).not.toContain(record.id);
      }
    }
  });

  it('a relation never lists the same target twice', () => {
    for (const record of ALL_CONTENT) {
      for (const relation of RELATION_KINDS) {
        const ids = record[relation];
        expect(new Set(ids).size, `${record.id}.${relation}`).toBe(ids.length);
      }
    }
  });

  it('nextLessons and prerequisites only ever point at lessons', () => {
    for (const record of ALL_CONTENT) {
      for (const id of [...record.nextLessons, ...record.prerequisites]) {
        expect(findContent(id)?.kind, `${record.id} -> ${id}`).toBe('learn');
      }
    }
  });

  it('relatedConcepts only ever point at glossary terms', () => {
    for (const record of ALL_CONTENT) {
      for (const id of record.relatedConcepts) {
        expect(findContent(id)?.kind, `${record.id} -> ${id}`).toBe('glossary');
      }
    }
  });

  it('relatedHands only ever point at hand pages, and each names one of the 169', () => {
    for (const record of ALL_CONTENT) {
      for (const id of record.relatedHands) {
        expect(findContent(id)?.kind, `${record.id} -> ${id}`).toBe('hands');
      }
      if (record.kind === 'hands') {
        expect(handClassByKey(record.handKey), record.id).toBeDefined();
      }
    }
  });

  it('the prerequisite graph has no cycle', () => {
    const seen = new Map<string, 'VISITING' | 'DONE'>();
    const cycles: string[] = [];
    const walk = (id: string, trail: readonly string[]): void => {
      const state = seen.get(id);
      if (state === 'DONE') return;
      if (state === 'VISITING') {
        cycles.push([...trail, id].join(' -> '));
        return;
      }
      seen.set(id, 'VISITING');
      for (const next of findContent(id)?.prerequisites ?? []) walk(next, [...trail, id]);
      seen.set(id, 'DONE');
    };
    for (const record of ALL_CONTENT) walk(record.id, []);
    expect(cycles).toEqual([]);
  });
});

describe('content graph — no dead internal link', () => {
  it('a link is only ever offered for a PUBLISHED piece', () => {
    for (const record of ALL_CONTENT) {
      const href = hrefOfContent(record);
      if (record.status === 'PUBLISHED') expect(href, record.id).toBe(contentPath(record));
      else expect(href, record.id).toBeNull();
    }
  });

  it('every PUBLISHED piece has its MDX file on disk', () => {
    const missing = ALL_CONTENT.filter(
      (record) => record.status === 'PUBLISHED' && !existsSync(mdxPathFor(record)),
    );
    expect(missing.map((record) => `${record.kind}/${record.slug}.mdx`)).toEqual([]);
  });

  it('every kind that has a PUBLISHED piece has its route template on disk', () => {
    const kinds = new Set<ContentKind>(
      ALL_CONTENT.filter((record) => record.status === 'PUBLISHED').map((record) => record.kind),
    );
    for (const kind of kinds) {
      const template = join(APP_DIR, CONTENT_ROUTE_TEMPLATE[kind], 'page.tsx');
      expect(existsSync(template), `${kind}: ${CONTENT_ROUTE_TEMPLATE[kind]}`).toBe(true);
    }
  });

  it('every published path sits under its kind prefix, under the default locale', () => {
    for (const record of ALL_CONTENT) {
      const path = contentPath(record);
      expect(localeOfPath(path), record.id).toBe(DEFAULT_LOCALE);
      expect(sitePathOf(path).startsWith(`${CONTENT_PREFIX[record.kind]}/`), record.id).toBe(true);
    }
  });
});

describe('learn curriculum', () => {
  it('is gapless and uniquely ordered from 1', () => {
    const orders = LEARN_ROADMAP.map((lesson) => lesson.order);
    expect(orders).toEqual(Array.from({ length: orders.length }, (_, index) => index + 1));
  });

  it('has no orphan lesson — every lesson is on the hub roadmap', () => {
    const lessons = ALL_CONTENT.filter((record) => record.kind === 'learn');
    expect(new Set(LEARN_ROADMAP.map((lesson) => lesson.id))).toEqual(
      new Set(lessons.map((lesson) => lesson.id)),
    );
    expect(LEARN_ROADMAP.length).toBe(lessons.length);
  });

  it('every lesson offers at least one tool and at least one next step (§35)', () => {
    for (const lesson of LEARN_ROADMAP) {
      expect(lesson.relatedTools.length, `${lesson.id}: tool CTA`).toBeGreaterThanOrEqual(1);
      const nextSteps = lesson.nextLessons.length + lesson.relatedArticles.length;
      expect(nextSteps, `${lesson.id}: next step`).toBeGreaterThanOrEqual(1);
    }
  });

  it('a prerequisite always comes earlier in the curriculum', () => {
    const orderOf = new Map(LEARN_ROADMAP.map((lesson) => [lesson.id, lesson.order]));
    for (const lesson of LEARN_ROADMAP) {
      for (const id of lesson.prerequisites) {
        expect(orderOf.get(id) ?? Infinity, `${lesson.id} <- ${id}`).toBeLessThan(lesson.order);
      }
    }
  });

  it('a PLANNED lesson states no reading time; a PUBLISHED one does', () => {
    for (const lesson of LEARN_ROADMAP) {
      if (lesson.status === 'PUBLISHED') expect(lesson.readMinutes, lesson.id).toBeGreaterThan(0);
      else expect(lesson.readMinutes, lesson.id).toBeNull();
    }
  });
});

describe('glossary', () => {
  it('aliases are unique across the whole glossary', () => {
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const entry of glossaryRecords()) {
      for (const alias of entry.aliases) {
        const owner = seen.get(alias);
        if (owner !== undefined) collisions.push(`"${alias}": ${owner} vs ${entry.id}`);
        else seen.set(alias, entry.id);
      }
    }
    expect(collisions).toEqual([]);
  });

  it('an alias never collides with another entry’s term or slug', () => {
    const entries = glossaryRecords();
    const terms = new Map(entries.map((entry) => [entry.term.toLowerCase(), entry.id]));
    const slugs = new Map(entries.map((entry) => [entry.slug.toLowerCase(), entry.id]));
    const collisions: string[] = [];
    for (const entry of entries) {
      for (const alias of entry.aliases) {
        const key = alias.toLowerCase();
        const termOwner = terms.get(key);
        const slugOwner = slugs.get(key);
        if (termOwner !== undefined && termOwner !== entry.id) {
          collisions.push(`alias "${alias}" (${entry.id}) is the term of ${termOwner}`);
        }
        if (slugOwner !== undefined && slugOwner !== entry.id) {
          collisions.push(`alias "${alias}" (${entry.id}) is the slug of ${slugOwner}`);
        }
      }
    }
    expect(collisions).toEqual([]);
  });

  it('every entry carries the one-line definition a tooltip needs', () => {
    for (const entry of glossaryRecords()) {
      expect(entry.shortDefinition.trim().length, entry.id).toBeGreaterThan(10);
      expect(entry.term.trim().length, entry.id).toBeGreaterThan(0);
      expect(entry.aliases.length, entry.id).toBeGreaterThan(0);
    }
  });
});

describe('index quality control (§40)', () => {
  it('every indexable piece clears the minimum content threshold', () => {
    const failures: string[] = [];
    for (const record of ALL_CONTENT) {
      if (!record.indexable) continue;
      const unmet = unmetIndexRequirements(record, measurementOf(record));
      if (unmet.length > 0) failures.push(`${record.id}: ${unmet.join('; ')}`);
    }
    expect(failures).toEqual([]);
  });

  it('a PLANNED piece is never indexable', () => {
    for (const record of ALL_CONTENT) {
      if (record.status === 'PLANNED') expect(record.indexable, record.id).toBe(false);
    }
  });

  it('a published piece states the reading time its own text implies', () => {
    for (const record of ALL_CONTENT) {
      if (record.status !== 'PUBLISHED') continue;
      const expected = estimateReadMinutes(measurementOf(record).proseCharacters);
      expect(record.readMinutes, record.id).toBe(expected);
    }
  });
});

describe('MDX authoring surface (§79)', () => {
  const published = ALL_CONTENT.filter((record) => record.status === 'PUBLISHED');

  it('there is prose to check', () => {
    expect(published.length).toBeGreaterThan(0);
  });

  it('no MDX file contains an import or an export', () => {
    const offenders = published.filter((record) => measurementOf(record).hasEsmStatement);
    expect(offenders.map((record) => record.id)).toEqual([]);
  });

  it('no MDX file names a component outside the allow-list', () => {
    const allowed = new Set<string>(MDX_COMPONENT_ALLOW_LIST);
    const offenders: string[] = [];
    for (const record of published) {
      for (const name of measurementOf(record).componentUses) {
        if (!allowed.has(name)) offenders.push(`${record.id}: <${name}>`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no MDX file writes its own <h1> — the page template owns it', () => {
    const offenders = published.filter((record) => measurementOf(record).hasTopLevelHeading);
    expect(offenders.map((record) => record.id)).toEqual([]);
  });

  it('a term is introduced at most once per article (§32: first appearance)', () => {
    const offenders: string[] = [];
    for (const record of published) {
      const source = readFileSync(mdxPathFor(record), 'utf8');
      const ids = [...source.matchAll(/<Term\s+id="([^"]+)"/gu)].map(([, id]) => id ?? '');
      const counts = new Map<string, number>();
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
      for (const [id, count] of counts) {
        if (count > 1) offenders.push(`${record.id}: <Term id="${id}"> x${count}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every <Term> in prose names a glossary entry that is also a declared relation', () => {
    const problems: string[] = [];
    for (const record of published) {
      const source = readFileSync(mdxPathFor(record), 'utf8');
      for (const [, id] of source.matchAll(/<Term\s+id="([^"]+)"/gu)) {
        if (id === undefined) continue;
        if (findContent(id)?.kind !== 'glossary') problems.push(`${record.id}: unknown ${id}`);
        else if (!record.relatedConcepts.includes(id)) {
          problems.push(`${record.id}: <Term id="${id}"> is not in relatedConcepts`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('every published lesson embeds a tool CTA in its prose (§35 mid-content)', () => {
    for (const record of published) {
      if (record.kind !== 'learn') continue;
      const source = readFileSync(mdxPathFor(record), 'utf8');
      expect(source, record.id).toMatch(/<ToolCTA\b/u);
    }
  });
});

/**
 * WHAT MAY LEAVE A `## 사람들이 자주 헷갈리는 부분` SECTION AS `FAQPage` MARKUP.
 *
 * `extractFaqItems` emits EVERY `###` under a FAQ heading, because it is a parser and cannot
 * know an author's intent. `learn/poker-actions` had put a recap — `### 다섯 가지 행동을
 * 한눈에`, five markdown bullets under it — inside that section, and it went straight into
 * the page's `FAQPage` script as a `Question` whose `name` was a noun phrase and whose
 * `acceptedAnswer.text` began `- 체크: 아무것도 걸지 않고 넘김`. Both halves are defects a
 * reviewer only finds by reading generated JSON-LD, which is why they survived seven work
 * packages. The section was the wrong home for the recap and it has been moved out; these
 * two rules are what stops the next author from putting one back.
 *
 * Unlike `faq.test.ts`, which constructs its fixtures (ruling 26), this quantifies over the
 * REAL articles — because what is being checked is a property of the prose, not of the
 * parser, and it belongs beside the other rules an MDX author has to satisfy.
 *
 * ### Rule 1 — a question ends with a question mark
 *
 * Korean does not require one: `이 표가 무엇을 재는지 살펴봅시다` is a question in intent with
 * no `?` at all. So this is a HOUSE CONVENTION rather than a grammar claim, and it is chosen
 * over the grammatical alternative deliberately. Testing for a Korean interrogative ending
 * means enumerating them (`-나요`, `-가요`, `-까`, `-죠`, `-니`, …), an open set whose every
 * omission silently readmits the exact defect this exists to catch. This rule's only false
 * positive is a real question missing one keystroke, and the repair — adding the mark —
 * makes the emitted `Question.name` better rather than worse. Every one of the site's FAQ
 * questions already satisfies it.
 *
 * ### Rule 2 — an answer carries no block markdown
 *
 * `stripInlineMarkdown` normalises links, code, bold and italic; it does NOT strip list
 * markers or heading marks, and it is not going to become a markdown parser. So a bullet or
 * a numbered step inside an answer reaches `acceptedAnswer.text` as literal `- ` / `1. `
 * that a reader sees in a rich result. This half is language-independent and it is the half
 * that actually detected the defect: a recap can be given a question mark, but it cannot
 * stop being a list.
 */
describe('FAQ sections — what may be emitted as FAQPage markup', () => {
  const faqPages = ALL_CONTENT.filter((record) => record.status === 'PUBLISHED')
    .map((record) => ({
      record,
      items: extractFaqItems(readFileSync(mdxPathFor(record), 'utf8')),
    }))
    .filter(({ items }) => items.length > 0);

  it('there are FAQ sections to check, or the two rules below are vacuous', () => {
    expect(faqPages.length).toBeGreaterThan(0);
  });

  it('every emitted question is written as a question', () => {
    const offenders: string[] = [];
    for (const { record, items } of faqPages) {
      for (const { question } of items) {
        if (!question.endsWith('?')) offenders.push(`${record.id}: ### ${question}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no emitted answer ships markdown list or heading syntax into the markup', () => {
    const BLOCK_MARKDOWN = /(?:^|\s)(?:[-*+]\s|\d+\.\s|#{1,6}\s|>\s)/u;
    const offenders: string[] = [];
    for (const { record, items } of faqPages) {
      for (const { question, answer } of items) {
        if (BLOCK_MARKDOWN.test(answer)) offenders.push(`${record.id}: ${question}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('contextual headings (§76)', () => {
  it('every relation has its own heading and none of them is a generic "관련 글"', () => {
    const headings = RELATION_KINDS.map((relation) => RELATION_HEADING[relation]);
    expect(new Set(headings).size).toBe(RELATION_KINDS.length);
    for (const heading of headings) {
      expect(heading.trim().length).toBeGreaterThan(0);
      expect(heading).not.toBe('관련 글');
    }
  });

  /**
   * The site may never tell a reader what to do at the table.
   *
   * 3BetTilt has no verified strategy dataset. It states what a hand *is* — its rank, equity,
   * combination count, whether it appears in the `학습용 기본 레인지` under stated conditions —
   * and it stops there. Every tool and lesson is careful about this: `/tools/pot-odds` heads a
   * whole section "이 숫자만 보고 콜하면 되나요?" and answers 아닙니다, and `learn/pot-odds` says
   * "이 사이트가 대신 판단해주지 않습니다."
   *
   * `glossary/pot-odds.mdx` did not. It said the minimum equity was a basis on which
   * "콜을 ... 폴드를 고려해 볼 수 있는" — advice, on the one page a reader reaches when they look
   * the term UP, contradicting both the tool and the lesson it links to. An independent review
   * found it; a full read of that same page by the orchestrator had passed it, because a page
   * whose every NUMBER is correct reads as correct.
   *
   * So this is a rule, not a spot fix. It looks for a recommendation attached to a table action
   * and requires that the sentence also carry a refusal marker — because the legitimate use of
   * these verbs on this site is always to deny them ("항상 레이즈해야 한다거나 ... 뜻은 아닙니다").
   * A sentence that recommends an action without denying it is the defect.
   */
  const TABLE_ACTION = '(?:콜|폴드|레이즈|베팅|체크|올인)';
  const RECOMMENDATION = new RegExp(
    `${TABLE_ACTION}(?:을|를|하|해)?\\s*(?:하세요|해야 합니다|하는 것이 좋|고려해 볼 수 있|추천|권장|해야 한다|하면 됩니다|하십시오)`,
  );
  /** The shapes this site uses to refuse a claim rather than make it. */
  const REFUSAL_MARKERS = [
    '아닙니다',
    '아니',
    '않습니다',
    '않는',
    '없습니다',
    '뜻은',
    '정해 주지',
    '정해주지',
    '대신 판단',
    '범위 밖',
  ];

  it('never tells the reader what action to take at the table', () => {
    const advice: string[] = [];
    for (const record of ALL_CONTENT) {
      if (record.status !== 'PUBLISHED') continue;
      const prose = readFileSync(mdxPathFor(record), 'utf8').replace(/<[^>]+>/g, '');
      for (const raw of prose.split(/(?<=[다요]\.)\s+|\n\n/)) {
        const sentence = raw.split(/\s+/).join(' ').trim();
        const match = RECOMMENDATION.exec(sentence);
        if (match === null) continue;
        if (REFUSAL_MARKERS.some((marker) => sentence.includes(marker))) continue;
        advice.push(`${record.id}: «${match[0]}» in "${sentence.slice(0, 120)}"`);
      }
    }
    expect(advice).toEqual([]);
  });
});
