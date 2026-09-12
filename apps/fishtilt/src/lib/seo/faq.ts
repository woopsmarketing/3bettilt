/**
 * FAQ extraction — the honest half of `FAQPage` structured data.
 *
 * ## Why this reads the article's own source instead of taking a list from anywhere else
 *
 * `FAQPage` markup is only legal, and only useful, when the questions and answers it
 * declares are **actually visible on the page**. Every other way of producing that list
 * drifts: a hand-written table in the SEO layer is wrong the first time an author edits a
 * heading, a field on the content record is a claim nobody checks, and a generated
 * snapshot is stale the moment content moves — and content in this repository is written
 * by other agents, in other files, after this one shipped.
 *
 * So the list is re-derived from the MDX the page renders, on every build. If an author
 * deletes a question, it leaves the markup on the same build. If an author writes a
 * section that is not a Q&A at all, nothing is emitted. The markup cannot claim something
 * the page does not say, because it is reading the page.
 *
 * ## What counts as a FAQ, exactly
 *
 * A `##` section whose heading names one (`사람들이 자주 헷갈리는 부분`,
 * `자주 헷갈리는 부분`, `자주 묻는 것`), containing at least
 * `MIN_FAQ_ITEMS` `###` sub-headings each followed by prose. That shape is a genuine FAQ:
 * a reader sees a list of questions with answers under them.
 *
 * It deliberately excludes two shapes that also live under that heading in this
 * repository, and neither gets FAQ markup:
 *
 * - the same `##` heading followed by ordinary paragraphs with no `###` questions (most
 *   blog articles) — a discussion of common confusions, not a question list;
 * - a `<Callout title="자주 묻는 것 — …">` (some hand pages) — one aside, not a FAQ.
 *
 * ## Why a pair containing a component is dropped rather than approximated
 *
 * Several answers embed `<Fact>`, whose visible text is a number COMPUTED at build time,
 * or `<Term>`, which wraps prose in a popover. Reading the source gives the call, not the
 * rendered text, so any answer containing a component would go into the markup differing
 * from what the reader sees — which is exactly the thing this module exists to prevent.
 * Such a pair is dropped. Dropping one leaves the remaining items true, which is all
 * `FAQPage` requires; approximating one would not.
 */

/** A section with fewer than this many questions is an aside, not a FAQ. */
export const MIN_FAQ_ITEMS = 2;

/** Headings that introduce a question list. Matched on the heading text, not the file. */
const FAQ_HEADING = /자주\s*헷갈리|자주\s*묻는|자주\s*하는\s*질문/u;

const FENCE = /^\s*(```|~~~)/u;

export interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

/** `true` when a line carries JSX we cannot render to text here. See the module doc. */
function containsComponent(text: string): boolean {
  return /<\/?[A-Za-z][A-Za-z0-9]*[\s/>]/u.test(text);
}

/**
 * Removes the inline markdown syntax that would otherwise appear literally in the markup
 * (`**`, `_`, backticks, link brackets). Kept small on purpose — it is a normaliser for
 * the prose this repository actually writes, not a markdown parser.
 */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/`([^`]*)`/gu, '$1')
    .replace(/\*\*([^*]+)\*\*/gu, '$1')
    .replace(/(?<![A-Za-z0-9])_([^_]+)_(?![A-Za-z0-9])/gu, '$1')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * Every visible question/answer pair in the source's FAQ section, in document order.
 * `[]` when the file has no FAQ section, when the section holds no `###` questions, or
 * when fewer than `MIN_FAQ_ITEMS` pairs survive — in all three cases the correct
 * behaviour is to emit no `FAQPage` markup at all.
 */
export function extractFaqItems(source: string): readonly FaqItem[] {
  const items: FaqItem[] = [];
  let inFaqSection = false;
  let inFence = false;
  let question: string | null = null;
  let answerLines: string[] = [];
  let dropCurrent = false;

  const flush = (): void => {
    if (question !== null && !dropCurrent && answerLines.length > 0) {
      const answer = answerLines.join('\n\n');
      if (answer !== '') items.push({ question, answer });
    }
    question = null;
    answerLines = [];
    dropCurrent = false;
  };

  for (const raw of source.split('\n')) {
    if (FENCE.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const h2 = /^##\s+(.*)$/u.exec(raw);
    if (h2 !== null) {
      flush();
      inFaqSection = FAQ_HEADING.test(h2[1] ?? '');
      continue;
    }
    if (/^#\s+/u.test(raw)) {
      flush();
      inFaqSection = false;
      continue;
    }
    if (!inFaqSection) continue;

    const h3 = /^###\s+(.*)$/u.exec(raw);
    if (h3 !== null) {
      flush();
      const text = (h3[1] ?? '').trim();
      question = stripInlineMarkdown(text);
      dropCurrent = containsComponent(text) || question === '';
      continue;
    }

    if (question === null) continue; // prose before the first question — not an answer
    const line = raw.trim();
    if (line === '') continue;
    if (containsComponent(line)) {
      dropCurrent = true;
      continue;
    }
    const cleaned = stripInlineMarkdown(line);
    if (cleaned !== '') answerLines.push(cleaned);
  }
  flush();

  return items.length >= MIN_FAQ_ITEMS ? items : [];
}
