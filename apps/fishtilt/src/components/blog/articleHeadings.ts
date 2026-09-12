/**
 * Headings for the article table of contents — the pure half.
 *
 * The MDX pipeline assigns no `id` to headings (no rehype plugin is registered, and
 * `next.config.ts` is not this WP's to change), so the blog template binds its own `h2` at
 * render time (`BlogArticleShell.tsx`) and derives the id from the heading's text. The
 * `TableOfContents` links are built from the SAME function applied to the `##` lines of the
 * MDX source (`articleSource.ts`), so the two cannot disagree as long as an article never
 * repeats an h2 — which `page.test.tsx` checks over every published article.
 */
import { isValidElement, type ReactNode } from 'react';
import type { TocHeading } from '../TableOfContents.js';

/** How many `##` sections an article needs before a table of contents earns its place. */
export const MIN_TOC_HEADINGS = 3;

/**
 * `"카드로 나란히 보면"` → `"카드로-나란히-보면"`. Korean letters are valid in an HTML id and
 * in a fragment, so the text is kept rather than romanised; only punctuation goes.
 */
export function headingId(text: string): string {
  const cleaned = text
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/gu, '-')
    .toLowerCase();
  return cleaned.length > 0 ? `h-${cleaned}` : 'h-section';
}

/** The visible text of a heading's React children — strings, nested elements' children. */
export function textOf(children: ReactNode): string {
  if (children === null || children === undefined || typeof children === 'boolean') return '';
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(textOf).join('');
  if (isValidElement<{ readonly children?: ReactNode }>(children)) {
    return textOf(children.props.children);
  }
  return '';
}

/** Inline markdown and JSX stripped from one heading line of MDX source. */
export function headingTextOfSource(line: string): string {
  return line
    .replace(/<[^>]+\/>/gu, '')
    .replace(/<\/?[A-Za-z][^>]*>/gu, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/`([^`]*)`/gu, '$1')
    .replace(/\*\*([^*]+)\*\*/gu, '$1')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** The `##` headings of an MDX source, in order, with the ids the rendered `h2`s carry. */
export function extractHeadings(source: string): readonly TocHeading[] {
  const headings: TocHeading[] = [];
  let inFence = false;
  for (const raw of source.split('\n')) {
    if (/^```/u.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^##\s+(.+)$/u.exec(raw);
    if (match === null) continue;
    const text = headingTextOfSource(match[1] ?? '');
    if (text.length === 0) continue;
    headings.push({ id: headingId(text), text, level: 2 });
  }
  return headings;
}

/** Duplicate h2 texts — the one case where the TOC and the rendered ids could diverge. */
export function duplicateHeadings(source: string): readonly string[] {
  const seen = new Map<string, number>();
  for (const heading of extractHeadings(source)) {
    seen.set(heading.id, (seen.get(heading.id) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, count]) => count > 1).map(([id]) => id);
}
