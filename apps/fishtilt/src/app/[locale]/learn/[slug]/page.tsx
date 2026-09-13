/**
 * `/learn/[slug]` — the lesson template (build spec §27, §35; Stage 3 contract AS).
 *
 * The template, not the article, guarantees the links. Every lesson gets, in this order:
 *
 *   1. the header — "레슨 N / 15", the category (a link back to that category's section on
 *      the hub), title, level, reading time, and the `prerequisites` as one inline line:
 *      §35's EARLY conceptual link, where a reader who is lost can leave before wasting
 *      five minutes;
 *   2. the prose, which carries the learning objectives (`<LessonGoals>`), the mid-content
 *      tool CTA, the inline glossary terms, the quick summary (`<LessonSummary>`) and the
 *      mini quiz (those live in MDX because their placement is a writing decision);
 *   3. the related-content block — glossary terms, tools, hands, editorial next lessons and
 *      the articles that read well beside it, under the D-S3-16 labels;
 *   4. previous/next by curriculum ORDER, and on the last lesson the roadmap's honest end
 *      (`LessonNav`) — never a fabricated neighbour.
 *
 * An author therefore cannot ship a lesson that dead-ends, and `content.test.ts` checks the
 * data behind 1 and 3 rather than trusting that the template was used.
 *
 * ## Static, and static on purpose
 *
 * `generateStaticParams` enumerates the published lessons and `dynamicParams = false` makes
 * every other slug a 404 instead of an on-demand render. The whole site is prerendered HTML;
 * the only client JavaScript on this page is the chart and the quiz, which are their own
 * islands (§48).
 *
 * ## `indexable` reaches the crawler here
 *
 * `robots.index` is the record's own `indexable` flag, which `threshold.ts` and
 * `content.test.ts` refuse to let a thin page set (§40). The whole `<head>` comes from
 * `contentMetadata(record)` (`src/lib/seo/metadata.ts`), so the canonical, the Open Graph
 * block and that robots directive are all derived from the same record — this template states
 * none of them itself.
 *
 * ## Structured data (build spec §35)
 *
 * Three blocks, each tied to something visible on this page: `BreadcrumbList` from the trail
 * the `<nav>` above renders, `Article` because a lesson is one, and `FAQPage` ONLY when the
 * lesson's own MDX carries a real question list — `src/lib/seo/faq.ts` reads the source and
 * returns nothing when it does not, so a lesson without a FAQ emits no FAQ markup.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation.js';
import { Breadcrumbs } from '../../../../components/Breadcrumbs.js';
import { LessonHeader } from '../../../../components/learn/LessonHeader.js';
import { LessonNav } from '../../../../components/learn/LessonNav.js';
import { RelatedContent } from '../../../../components/RelatedContent.js';
import { TableOfContents } from '../../../../components/TableOfContents.js';
import { MIN_TOC_HEADINGS } from '../../../../components/blog/articleHeadings.js';
import { readArticleHeadings } from '../../../../components/blog/articleSource.js';
import { EditorialVisual } from '../../../../components/visual/EditorialVisual.js';
import { visualOf } from '../../../../content/visuals.js';
import {
  contentBySlug,
  contentMeta,
  hrefOfContent,
  PUBLISHED_LESSONS,
  relationsOf,
} from '../../../../content/graph.js';
import { lessonComponent } from '../../../../content/learn/index.js';
import {
  categoryOfLesson,
  LEARN_HUB_ANCHORS,
  LESSON_COUNT,
  neighboursOf,
} from '../../../../content/registry/learn/categories.js';
import {
  articleJsonLd,
  contentBreadcrumbs,
  contentMetadata,
  faqPageJsonLd,
  JsonLd,
} from '../../../../lib/seo/index.js';
import { readFaqItems } from '../../../../lib/seo/faqSource.js';
import { routeById } from '../../../../lib/routes.js';

export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return PUBLISHED_LESSONS.map((lesson) => ({ slug: lesson.slug }));
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ readonly slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lesson = contentBySlug('learn', slug);
  if (lesson === undefined) return {};
  return contentMetadata(lesson);
}

export default async function LessonPage({
  params,
}: {
  readonly params: Promise<{ readonly slug: string }>;
}) {
  const { slug } = await params;
  const lesson = contentBySlug('learn', slug);
  const Content = lessonComponent(slug);
  if (lesson === undefined || lesson.status !== 'PUBLISHED' || Content === undefined) notFound();
  // Narrows the record for `articleJsonLd`, which accepts only the two kinds that really
  // are articles. `contentBySlug` is keyed by kind already, so this cannot fire.
  if (lesson.kind !== 'learn') notFound();

  const trail = contentBreadcrumbs(lesson);
  const faq = faqPageJsonLd(readFaqItems('learn', lesson.slug));
  const category = categoryOfLesson(lesson);
  const hub = routeById('learn').path;
  const practice = routeById('practice');
  const { prev, next } = neighboursOf(lesson);
  const prerequisites = relationsOf(lesson, ['prerequisites']).flatMap((r) => r.links);
  const headings = readArticleHeadings('learn', lesson.slug);

  return (
    <main className="mx-auto max-w-reading px-6 py-16">
      <Breadcrumbs className="mb-8" trail={trail} />
      <JsonLd blocks={[articleJsonLd(lesson), faq]} />

      <LessonHeader
        order={lesson.order}
        total={LESSON_COUNT}
        title={lesson.title}
        level={lesson.level}
        readMinutes={lesson.readMinutes}
        category={{
          label: category.label,
          href: `${hub}#${LEARN_HUB_ANCHORS.category(category.id)}`,
        }}
        prerequisites={prerequisites}
      />

      {/*
        The whole page shares one column width (`max-w-reading` on `<main>`), which at this
        body size is roughly 39 Korean characters per line — Korean has no inter-word spacing
        to rest the eye on, so the comfortable measure is shorter than it would be in Latin
        text. The article does NOT set a narrower width of its own: a prose column visibly
        narrower than the blocks above and below it reads as a mistake.

        Figures are the exception, and they go the other way: from `lg` up a top-level
        `<figure>` (a captioned `Figure`/`EditorialImage`) breaks out of the reading column
        by 7rem a side — 46rem + 14rem = the 60rem breakout token (D-S3-10) — so a diagram
        or a table gets the width it needs while the text keeps its measure. Anything else
        that wants the same treatment sets `data-breakout` on its root.

        The first paragraph is the lead (§27's "한 줄 답"), drawn one step larger and in the
        brighter ink so the answer is legible before the reader has decided to read on.
      */}
      {/* The category's shared picture (`LEARN_CATEGORY_THEME`), breaking out of the reading
          column by the same 7rem a side a figure does. Decorative: the header names the lesson. */}
      <EditorialVisual
        className="mt-10 lg:-mx-28 lg:w-auto"
        visual={visualOf(lesson)}
        aspect="21/9"
        scrim="soft"
        priority
        sizes="(min-width: 1024px) 960px, 100vw"
      />

      {headings.length >= MIN_TOC_HEADINGS ? (
        <TableOfContents className="mt-10" headings={headings} numbered collapsible />
      ) : null}

      <article
        data-numbered
        className="editorial-body mt-12 [&>p:first-child]:text-xl [&>p:first-child]:leading-[1.75] [&>p:first-child]:text-text-100 [&>figure]:lg:-mx-28 [&>[data-breakout]]:lg:-mx-28"
      >
        <Content />
      </article>

      {/* The next step first (B-M4): after the prose, the one action the roadmap wants
          is the next lesson, so it is the first and largest thing in the tail; the
          related groups follow it, set at the group size (`dense`). */}
      <LessonNav
        className="mt-14"
        prev={
          prev === undefined
            ? undefined
            : { href: hrefOfContent(prev), title: prev.title, meta: contentMeta(prev) }
        }
        next={
          next === undefined
            ? undefined
            : {
                href: hrefOfContent(next),
                title: next.title,
                meta: contentMeta(next),
                visual: visualOf(next),
              }
        }
        end={{
          practiceHref: practice.available ? practice.path : null,
          topicsHref: `${hub}#${LEARN_HUB_ANCHORS.topics}`,
        }}
      />
      <RelatedContent
        className="mt-16"
        dense
        record={lesson}
        only={['nextLessons', 'relatedTools', 'relatedConcepts', 'relatedHands', 'relatedArticles']}
        labels={{
          nextLessons: '더 배우기',
          relatedTools: '직접 확인하기',
          relatedConcepts: '같이 알아둘 용어',
          relatedHands: '비슷한 핸드',
          relatedArticles: '이런 이야기도 있어요',
        }}
      />
    </main>
  );
}
