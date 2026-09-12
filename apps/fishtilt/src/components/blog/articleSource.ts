/**
 * The filesystem half of the article headings — reads an article's MDX source at build
 * time, the same way `lib/seo/faqSource.ts` reads it for `FAQPage`. Server only: imports
 * `node:fs`, so it is never re-exported from a component barrel and only the route
 * template imports it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContentKind } from '../../content/types.js';
import { resolveContentRoot } from '../../lib/seo/faqSource.js';
import type { TocHeading } from '../TableOfContents.js';
import { extractHeadings } from './articleHeadings.js';

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** `[]` when the file cannot be read — a missing TOC is not an error, a broken build is. */
export function readArticleHeadings(kind: ContentKind, slug: string): readonly TocHeading[] {
  if (!SAFE_SLUG.test(slug)) return [];
  const root = resolveContentRoot();
  if (root === null) return [];
  try {
    return extractHeadings(readFileSync(join(root, kind, `${slug}.mdx`), 'utf8'));
  } catch {
    return [];
  }
}
