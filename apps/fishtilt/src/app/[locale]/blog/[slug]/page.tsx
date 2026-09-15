/**
 * `/blog/[slug]` — the article template (WP-S3-06).
 *
 * One route, one common shell, two layouts. The record decides: a `HandStoryRecord`
 * (`isHandStory` — `contentType: 'hand-story'` AND a `hand`) renders `StoryArticleLayout`,
 * which draws the hand from data; every other content type renders `GuideArticleLayout`.
 * Both end in the same footer (D-S3-16 relation labels, tool band, prev/next within the
 * content type) so the two templates read as one publication.
 *
 * The static-generation contract is unchanged from `/learn/[slug]`: `dynamicParams = false`
 * + `generateStaticParams` over `PUBLISHED` records only, so an unlisted slug 404s.
 * `generateMetadata` still derives the whole `<head>` from the record — with one addition,
 * a blog record's optional `seoTitle` for the `<title>`/OG title while the `<h1>` stays
 * `title` (`graph.ts` `seoTitleOf`).
 *
 * JSON-LD: `Article` (with the content type as `articleSection`) + the breadcrumb's
 * `BreadcrumbList`; `FAQPage` only where the prose really has a question list. No author,
 * no date — the records carry neither.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation.js';
import { GuideArticleLayout } from '../../../../components/blog/GuideArticleLayout.js';
import { StoryArticleLayout } from '../../../../components/blog/StoryArticleLayout.js';
import { readArticleHeadings } from '../../../../components/blog/articleSource.js';
import { resolveAsset } from '../../../../components/visual/assetSource.js';
import { blogComponent } from '../../../../content/blog/index.js';
import { contentBySlug, isHandStory, publishedOfKind } from '../../../../content/graph.js';
import { visualOf } from '../../../../content/visuals.js';
import {
  articleJsonLd,
  contentBreadcrumbs,
  contentMetadata,
  faqPageJsonLd,
  JsonLd,
} from '../../../../lib/seo/index.js';
import { readFaqItems } from '../../../../lib/seo/faqSource.js';

export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return publishedOfKind('blog').map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ readonly slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = contentBySlug('blog', slug);
  if (article === undefined) return {};
  return contentMetadata(article);
}

export default async function BlogArticlePage({
  params,
}: {
  readonly params: Promise<{ readonly slug: string }>;
}) {
  const { slug } = await params;
  const article = contentBySlug('blog', slug);
  const Content = blogComponent(slug);
  if (article === undefined || article.status !== 'PUBLISHED' || Content === undefined) {
    notFound();
  }
  // Narrows the record for `articleJsonLd`. `contentBySlug` is keyed by kind already, so
  // this cannot fire.
  if (article.kind !== 'blog') notFound();

  const trail = contentBreadcrumbs(article);
  const faq = faqPageJsonLd(readFaqItems('blog', article.slug));

  return (
    // The column lives inside the layouts (`BlogArticleShell`: the reading track of a
    // three-track grid inside a `breakout` band), not on `<main>` — `<main>` is a stack of
    // bands now. See `theme-tokens.test.ts` for the token check that moved with it.
    <main data-content-type={article.contentType}>
      <JsonLd blocks={[articleJsonLd(article, resolveAsset(visualOf(article))), faq]} />
      {isHandStory(article) ? (
        <StoryArticleLayout record={article} trail={trail} Content={Content} />
      ) : (
        <GuideArticleLayout
          record={article}
          trail={trail}
          headings={readArticleHeadings('blog', article.slug)}
          Content={Content}
        />
      )}
    </main>
  );
}
