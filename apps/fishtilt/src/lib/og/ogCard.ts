/**
 * Per-page social cards — the pure half: which content gets one, where it lives, and the
 * words on it. The raster is drawn by `renderOg.tsx` at build time and served by
 * `app/og/[kind]/[file]/route.tsx` as a static PNG.
 *
 * The card shares its SOURCE with the page's featured visual (`content/visuals.ts`): the same
 * picture when the file exists, the same theme when it does not. Unlike the page, the card
 * DOES render the category and title onto the image — a social preview is a picture — in the
 * page's own words: the `<h1>` title and the label the page already shows. Canonical, `og:url`
 * and `og:title` are untouched; only `og:image` points here.
 */
import { BLOG_CONTENT_TYPE_LABEL } from '../../content/graph.js';
import { categoryOfTermOrNull } from '../../content/registry/glossary/categories.js';
import { categoryOfLessonOrNull } from '../../content/registry/learn/categories.js';
import type { AnyContentRecord, ContentKind } from '../../content/types.js';

export const OG_CARD_WIDTH = 1200;
export const OG_CARD_HEIGHT = 630;

/** Root-relative URL of a record's card, e.g. `/og/blog/aks-vs-ako.png`. */
export function ogCardPath(record: Pick<AnyContentRecord, 'kind' | 'slug'>): string {
  return `/og/${record.kind}/${record.slug}.png`;
}

/** The small label above the title — the same words the page's eyebrow uses. */
export function ogCardCategory(record: AnyContentRecord): string {
  switch (record.kind) {
    case 'blog':
      return BLOG_CONTENT_TYPE_LABEL[record.contentType];
    case 'learn': {
      const category = categoryOfLessonOrNull(record);
      return category === null ? '배우기' : `배우기 · ${category.label}`;
    }
    case 'glossary': {
      const category = categoryOfTermOrNull(record);
      return category === null ? '포커 용어' : `포커 용어 · ${category.label}`;
    }
    case 'hands':
      return '시작 핸드';
  }
}

/**
 * `og:image:alt` for a record's card: what the picture IS — a card carrying the page's
 * category label and its title — rather than the `<title>` pasted again. Both strings are
 * drawn onto the image by `renderOg.tsx`, so the description is literally true.
 */
export function ogCardAlt(record: AnyContentRecord): string {
  return `${ogCardCategory(record)} 소개 이미지 — ${record.title}`;
}

export const OG_CARD_KINDS: readonly ContentKind[] = ['learn', 'blog', 'glossary', 'hands'];

/** `aks-vs-ako.png` → `aks-vs-ako`; anything else → `null`. */
export function slugOfOgFile(file: string): string | null {
  const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.png$/u.exec(file);
  return match?.[1] ?? null;
}
