/**
 * `/og/<kind>/<slug>.png` — the social card of one published content page (`lib/og`).
 *
 * Fully static: `generateStaticParams` lists every published learn/blog/glossary/hands page,
 * `dynamicParams = false` 404s anything else, and `force-static` renders each PNG once at
 * build. The page's `og:image` points here (`seo/metadata.ts`); pages that are not content
 * (home, hubs, tools) keep the shared `/og.png`.
 */
import { contentBySlug, publishedOfKind } from '../../../../content/graph.js';
import type { ContentKind } from '../../../../content/types.js';
import { OG_CARD_KINDS, slugOfOgFile } from '../../../../lib/og/ogCard.js';
import { renderContentOg } from '../../../../lib/og/renderOg.js';

/** A route handler, not a page: `notFound()` would pull the app-router runtime in. */
const NOT_FOUND = (): Response => new Response('Not found', { status: 404 });

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams(): { kind: string; file: string }[] {
  return OG_CARD_KINDS.flatMap((kind) =>
    publishedOfKind(kind).map((record) => ({ kind, file: `${record.slug}.png` })),
  );
}

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<{ readonly kind: string; readonly file: string }> },
): Promise<Response> {
  const { kind, file } = await params;
  const slug = slugOfOgFile(file);
  if (slug === null || !(OG_CARD_KINDS as readonly string[]).includes(kind)) return NOT_FOUND();
  const record = contentBySlug(kind as ContentKind, slug);
  if (record === undefined || record.status !== 'PUBLISHED') return NOT_FOUND();
  return renderContentOg(record);
}
