/**
 * The minimum meaningful content threshold (build spec §40), expressed as a MEASUREMENT of
 * the authored file rather than as a judgement about it.
 *
 * §40's rule is that a page padded out with generated text to 100-200 characters must not be
 * indexed. The failure that rule guards against — thin, near-duplicate pages published at
 * volume because a route existed — cannot be prevented by asking each author to be honest
 * about their own work. So `indexable` is a claim, and `content.test.ts` checks the claim
 * against these numbers the same way `src/lib/routes.test.ts` checks `available` against the
 * filesystem: a record may only say `indexable: true` if its MDX file actually clears the
 * bar for its kind.
 *
 * ## What is measured, and why these things
 *
 * Four quantities, each chosen because a thin page fails it and a real page passes it
 * without trying:
 *
 * - `proseCharacters` — visible Korean prose with all markup, code and JSX removed. The
 *   direct answer to §40's "100-200자" failure mode. Counting non-whitespace characters
 *   (not words) is the right unit for Korean, which does not space-delimit meaning the way
 *   English does.
 * - `sectionCount` — `##` headings. A page with one undifferentiated blob of text has not
 *   been structured for a reader; the lesson template (§27) is a list of named sections.
 * - `componentUses` — how many allow-listed components the prose embeds. 3BetTilt's stated
 *   differentiator (§28) is that the tool is INSIDE the article. A page with no visual and
 *   no interaction is exactly the article this site exists not to write.
 * - the record's own graph edges — a page that leads nowhere is a dead end (§35).
 *
 * ## Why the numbers are what they are
 *
 * They are floors, not targets, set an order of magnitude above §40's stated failure mode
 * (200 characters) and below what an actually-written piece of that kind lands at, so the
 * gate catches padding without becoming a word count anyone writes to. Each kind gets its
 * own floor because a glossary term is legitimately short and a lesson is not.
 */

import type { ContentKind, ContentRecord } from './types.js';

export interface ContentMeasurement {
  /** Non-whitespace characters of visible prose, markup and embedded JSX removed. */
  readonly proseCharacters: number;
  /** `##` headings — the named sections of the piece. */
  readonly sectionCount: number;
  /** Every capitalised JSX component name used, in source order, with repeats. */
  readonly componentUses: readonly string[];
  /** `true` when the file contains an ESM `import`/`export` statement — see `measure`. */
  readonly hasEsmStatement: boolean;
  /** `true` when the file contains a level-1 `#` heading (the page template owns the h1). */
  readonly hasTopLevelHeading: boolean;
}

const FENCED_CODE = /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[^\n]*$/gmu;

/**
 * Removes JSX elements (their tags, their attributes and any `{...}` expression inside those
 * attributes) while KEEPING the text between an opening and closing tag, because that text is
 * prose the reader sees — `<Callout>` wraps real paragraphs.
 *
 * Hand-scanned rather than regexed because attribute values legitimately contain `>` inside
 * a `{...}` expression or a quoted string, which a `/<[^>]*>/` regex would cut in the wrong
 * place and silently under- or over-count the prose it is guarding.
 */
function stripJsxTags(source: string): {
  readonly text: string;
  readonly names: readonly string[];
} {
  const names: string[] = [];
  let out = '';
  let i = 0;
  while (i < source.length) {
    const char = source[i] ?? '';
    const next = source[i + 1] ?? '';
    const startsTag = char === '<' && (/[A-Za-z]/u.test(next) || next === '/');
    if (!startsTag) {
      out += char;
      i += 1;
      continue;
    }

    // Capture the element name for the allow-list check before consuming the tag.
    const nameMatch = /^<\/?\s*([A-Za-z][\w.]*)/u.exec(source.slice(i, i + 64));
    if (nameMatch?.[1] !== undefined) names.push(nameMatch[1]);

    let depth = 0;
    let quote: string | null = null;
    i += 1;
    while (i < source.length) {
      const c = source[i] ?? '';
      if (quote !== null) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'" || c === '`') {
        quote = c;
      } else if (c === '{') {
        depth += 1;
      } else if (c === '}') {
        depth -= 1;
      } else if (c === '>' && depth <= 0) {
        i += 1;
        break;
      }
      i += 1;
    }
  }
  return { text: out, names };
}

/** Markdown decoration that is syntax rather than words. Link TEXT is kept; the URL is not. */
function stripMarkdown(source: string): string {
  return source
    .replace(/\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gmu, '')
    .replace(/^\s{0,3}>\s?/gmu, '')
    .replace(/^\s{0,3}([-*+]|\d+\.)\s+/gmu, '')
    .replace(/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/gmu, '')
    .replace(/[*_`~|]/gu, '');
}

/** Pure. Deterministic. Knows nothing about the filesystem — the caller supplies the text. */
export function measureContent(source: string): ContentMeasurement {
  const withoutCode = source.replace(FENCED_CODE, '');
  const { text, names } = stripJsxTags(withoutCode);
  const prose = stripMarkdown(text);

  return {
    proseCharacters: prose.replace(/\s+/gu, '').length,
    sectionCount: (withoutCode.match(/^\s{0,3}##\s+\S/gmu) ?? []).length,
    componentUses: names.filter((name) => /^[A-Z]/u.test(name)),
    hasEsmStatement: /^\s*(import|export)\s/mu.test(withoutCode),
    hasTopLevelHeading: /^\s{0,3}#\s+\S/mu.test(withoutCode),
  };
}

export interface ContentThreshold {
  readonly minProseCharacters: number;
  readonly minSections: number;
  /** Distinct allow-listed components the prose must embed (§28). */
  readonly minComponents: number;
  /** Route ids in `relatedTools` (§35's mid-content tool CTA). */
  readonly minTools: number;
  /** `nextLessons` + `relatedArticles` (§35's next step). */
  readonly minNextSteps: number;
  /** `relatedConcepts` — the contextual glossary links of §35. */
  readonly minConcepts: number;
}

/**
 * Floors per kind. See the module doc for how they were chosen; they are deliberately blunt
 * numbers, not tuned ones.
 */
export const MINIMUM_CONTENT: Readonly<Record<ContentKind, ContentThreshold>> = {
  // A lesson is the site's main unit and the template in §27 has eight named sections; a
  // real one lands well past 2000 characters, so 1500 catches padding without policing
  // length.
  learn: {
    minProseCharacters: 1500,
    minSections: 4,
    minComponents: 2,
    minTools: 1,
    minNextSteps: 1,
    minConcepts: 2,
  },
  // A blog answer is a single question answered well — shorter than a lesson by design.
  blog: {
    minProseCharacters: 900,
    minSections: 3,
    minComponents: 1,
    minTools: 1,
    minNextSteps: 1,
    minConcepts: 1,
  },
  // A term legitimately needs only a definition, an easy explanation and an example (§31).
  // Still five times §40's failure threshold, and it must lead somewhere.
  glossary: {
    minProseCharacters: 400,
    minSections: 2,
    minComponents: 0,
    minTools: 1,
    minNextSteps: 0,
    minConcepts: 1,
  },
  // 169 hand pages exist as routes; only authored ones are indexed (audit §4). A hand page
  // that is just its combo count and a chart position is precisely the thin page §40 bans.
  hands: {
    minProseCharacters: 600,
    minSections: 3,
    minComponents: 1,
    minTools: 1,
    minNextSteps: 0,
    minConcepts: 1,
  },
};

/**
 * Every reason this piece must NOT be marked `indexable`. Empty means it clears the bar.
 *
 * Returns reasons rather than a boolean so a failing test names the specific shortfall — an
 * author who is told "poker-range: 섹션 3개 < 4개" can fix it; one told `false` cannot.
 */
export function unmetIndexRequirements(
  record: ContentRecord,
  measurement: ContentMeasurement,
): readonly string[] {
  const threshold = MINIMUM_CONTENT[record.kind];
  const unmet: string[] = [];

  if (record.status !== 'PUBLISHED') {
    unmet.push('아직 발행되지 않은 글입니다 (status: PLANNED)');
  }
  if (measurement.proseCharacters < threshold.minProseCharacters) {
    unmet.push(`본문 ${measurement.proseCharacters}자 < 최소 ${threshold.minProseCharacters}자`);
  }
  if (measurement.sectionCount < threshold.minSections) {
    unmet.push(`섹션 ${measurement.sectionCount}개 < 최소 ${threshold.minSections}개`);
  }
  const distinctComponents = new Set(measurement.componentUses).size;
  if (distinctComponents < threshold.minComponents) {
    unmet.push(`삽입된 구성요소 ${distinctComponents}종 < 최소 ${threshold.minComponents}종`);
  }
  if (record.relatedTools.length < threshold.minTools) {
    unmet.push(`연결된 도구 ${record.relatedTools.length}개 < 최소 ${threshold.minTools}개`);
  }
  const nextSteps = record.nextLessons.length + record.relatedArticles.length;
  if (nextSteps < threshold.minNextSteps) {
    unmet.push(`다음 단계 ${nextSteps}개 < 최소 ${threshold.minNextSteps}개`);
  }
  if (record.relatedConcepts.length < threshold.minConcepts) {
    unmet.push(`연결된 용어 ${record.relatedConcepts.length}개 < 최소 ${threshold.minConcepts}개`);
  }

  return unmet;
}

/**
 * Characters of Korean prose a beginner gets through in a minute, for the "약 N분" estimate
 * on the hub and the lesson header (§26).
 *
 * This is a UI convenience, not a poker figure — it is not covered by
 * `POKER_EDUCATIONAL_DATA_AUDIT.md`, which classifies numbers about the GAME. It is still
 * derived rather than guessed: the input is the piece's own measured length, and the rate is
 * set deliberately BELOW a typical adult Korean silent-reading pace because this material is
 * read while looking at a chart and pressing things, not skimmed. The label always says
 * "약" so it never reads as a promise.
 */
export const READING_CHARACTERS_PER_MINUTE = 400;

/** Minutes, rounded up, floored at 2 so nothing claims to be a one-minute read. */
export function estimateReadMinutes(proseCharacters: number): number {
  return Math.max(2, Math.ceil(proseCharacters / READING_CHARACTERS_PER_MINUTE));
}
