/**
 * Layout (a): a Search Guide — and every non-story content type. Contract AG/AP.
 *
 * Order: breadcrumb · ArticleHero (category, H1, deck) · ArticleMeta (content type, level,
 * read time) · hero visual (breakout) · prerequisites · table of contents (when the article
 * has `MIN_TOC_HEADINGS` sections) · the MDX body in the reading column with figures and
 * tables breaking out · the shared footer (contextual relations, tool band, prev/next).
 *
 * The QuickAnswer is authored in the MDX (`<QuickAnswer>` is allow-listed): an answer
 * almost always carries a number, and a number has to come from `<Fact>`, which only the
 * prose can hold. The template therefore does not render a second one from the registry.
 * FAQ: the prose already renders its own questions; `FAQPage` JSON-LD is emitted only when
 * `faq.ts` finds them — the page does not add a second FAQ block.
 */
import type { ArticleComponent } from '../../content/blog/index.js';
import { BLOG_CONTENT_TYPE_LABEL } from '../../content/graph.js';
import type { BlogRecord } from '../../content/types.js';
import type { BreadcrumbItem } from '../../lib/seo/index.js';
import { TOPIC_LABEL } from '../../features/content/index.js';
import { ArticleHero } from '../ArticleHero.js';
import { ArticleMeta } from '../ArticleMeta.js';
import { Breadcrumbs } from '../Breadcrumbs.js';
import { RelatedContent } from '../RelatedContent.js';
import { Section } from '../Section.js';
import { EditorialVisual } from '../visual/EditorialVisual.js';
import { visualOf } from '../../content/visuals.js';
import { TableOfContents, type TocHeading } from '../TableOfContents.js';
import { MIN_TOC_HEADINGS } from './articleHeadings.js';
import {
  ARTICLE_BREAKOUT,
  BREAKOUT,
  BlogArticleShell,
  mdxComponentsFor,
  HERO_TITLE_BREAK,
} from './BlogArticleShell.js';
import { BlogArticleFooter } from './BlogArticleFooter.js';

export interface GuideArticleLayoutProps {
  readonly record: BlogRecord;
  readonly trail: readonly BreadcrumbItem[];
  readonly headings: readonly TocHeading[];
  readonly Content: ArticleComponent;
}

export function GuideArticleLayout({ record, trail, headings, Content }: GuideArticleLayoutProps) {
  const typeLabel = BLOG_CONTENT_TYPE_LABEL[record.contentType];
  return (
    <>
      <Section width="breakout" padded="none" className="pt-10 sm:pt-14">
        <BlogArticleShell>
          <Breadcrumbs className="mb-8" trail={trail} />
          <ArticleHero
            className={HERO_TITLE_BREAK}
            category={typeLabel}
            title={record.title}
            deck={record.description}
            meta={
              <ArticleMeta
                category={TOPIC_LABEL[record.topic]}
                level={record.level}
                readMinutes={record.readMinutes}
              />
            }
          />
          {/* The featured visual (`content/visuals.ts`): the article's theme picture at 16:9,
              spanning the band — `ThemeArt` until the file exists. Decorative: the title is above. */}
          <EditorialVisual
            className={`mt-10 ${BREAKOUT}`}
            visual={visualOf(record)}
            aspect="16/9"
            scrim="soft"
            priority
            sizes="(min-width: 1024px) 960px, 100vw"
          />
          <RelatedContent
            className="mt-10"
            record={record}
            only={['prerequisites']}
            headingAs="h2"
          />
          {headings.length >= MIN_TOC_HEADINGS ? (
            <TableOfContents className="mt-10" headings={headings} numbered collapsible />
          ) : null}
        </BlogArticleShell>
      </Section>

      <Section width="breakout" padded="none" className="pb-section lg:pb-section-lg">
        <article
          data-numbered
          className={`editorial-body mt-6 ${ARTICLE_BREAKOUT} grid grid-cols-[1fr_min(var(--container-reading),100%)_1fr] [&>*]:col-start-2 [&>*]:min-w-0 [&>p:first-child]:text-xl [&>p:first-child]:leading-[1.75] [&>p:first-child]:text-text-100`}
        >
          <Content components={mdxComponentsFor()} />
        </article>
        <BlogArticleShell className="mt-16">
          <BlogArticleFooter
            record={record}
            title="여기까지 읽었다면"
            description="이 글에 나온 말, 직접 눌러볼 도구, 그리고 이어서 읽으면 좋은 글입니다."
          />
        </BlogArticleShell>
      </Section>
    </>
  );
}
