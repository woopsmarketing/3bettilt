/**
 * The blog hub's building blocks (WP-S3-06, contract AG). Every list here is one of the
 * layouts the design rules ask for INSTEAD of a card grid: featured + secondary list,
 * divided rows, a numbered data strip, a plain typographic list, a compact index.
 *
 * The honesty gate is the same everywhere: an article links only when `hrefOfContent`
 * gives a path; a `PLANNED` one is visible text with a 준비 중 badge and no anchor
 * (`ArticleTitle` is the one place that branch is written).
 */
import { hrefOfContent } from '../../content/graph.js';
import type { BlogRecord } from '../../content/types.js';
import { TOPIC_LABEL } from '../../features/content/index.js';
import { HAND_STORY_DISCLOSURE } from '../../content/stories/types.js';
import { EditorialImage } from '../EditorialImage.js';
import { SectionHeading } from '../SectionHeading.js';
import { SplitLayout } from '../SplitLayout.js';
import {
  HUB_SECTION_DESCRIPTION,
  hubMeta,
  type HubNavEntry,
  type HubSection,
} from './blogHubModel.js';
import type { BlogContentType } from '../../content/types.js';
import { BLOG_CONTENT_TYPE_LABEL } from '../../content/graph.js';

const LINK =
  'outline-none hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

const BADGE =
  'inline-block rounded-full border border-line-500 px-1.5 py-0.5 align-middle text-[10px] font-medium text-text-300';

/** A title that is a link when the article exists and text + 준비 중 when it does not. */
function ArticleTitle({
  article,
  className = '',
}: {
  readonly article: BlogRecord;
  readonly className?: string;
}) {
  const href = hrefOfContent(article);
  if (href === null) {
    return (
      <span className={`prose-ko ${className}`}>
        {article.title} <span className={BADGE}>준비 중</span>
      </span>
    );
  }
  return (
    <span className={`prose-ko ${className}`}>
      {/* WP-S3-17: the visible line box is unchanged; the anchor's own box is padded to a 44px
          touch target (py-3 balanced by -my-3), so the row keeps its rhythm on a phone. */}
      <a href={href} className={`inline-block py-3 -my-3 ${LINK}`}>
        {article.title}
      </a>
    </span>
  );
}

/* ------------------------------------------------------------------------------------- */
/* Category nav                                                                            */
/* ------------------------------------------------------------------------------------- */

export function BlogCategoryNav({ entries }: { readonly entries: readonly HubNavEntry[] }) {
  return (
    <nav aria-label="콘텐츠 타입" className="border-y border-line-500">
      <ul className="flex flex-wrap gap-x-5 gap-y-1 sm:gap-x-8">
        {entries.map((entry) => (
          <li
            key={entry.type}
            data-type={entry.type}
            className="flex items-center gap-2 py-1.5 text-sm"
          >
            {entry.href !== null ? (
              <a
                href={entry.href}
                className={`inline-flex min-h-11 items-center font-medium text-text-100 ${LINK}`}
              >
                {entry.label}
                <span className="tabular ml-1.5 font-mono text-xs text-text-300">
                  {entry.count}
                </span>
              </a>
            ) : (
              <span className="inline-flex min-h-11 items-center gap-2 text-text-300">
                {entry.label}
                <span className={BADGE}>준비 중</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ------------------------------------------------------------------------------------- */
/* Featured + secondary                                                                    */
/* ------------------------------------------------------------------------------------- */

export function BlogFeatured({
  featured,
  secondary,
}: {
  readonly featured: BlogRecord;
  readonly secondary: readonly BlogRecord[];
}) {
  const isStory = featured.contentType === 'hand-story';
  const primary = (
    <article data-featured={featured.id} className="min-w-0">
      <EditorialImage
        alt=""
        decorative
        aspect="16/9"
        sizes="(min-width: 1024px) 720px, 100vw"
        fallback={{ kind: featured.kind, topic: featured.topic, variant: featured.id }}
      />
      <p className="mt-6 text-sm font-medium tracking-[0.06em] text-brand-500">
        이 글부터 · {BLOG_CONTENT_TYPE_LABEL[featured.contentType]}
      </p>
      <h2 className="mt-2 text-h2 font-semibold text-text-100">
        <ArticleTitle article={featured} />
      </h2>
      <p className="mt-3 max-w-lead prose-ko text-prose text-text-300">{featured.description}</p>
      <p className="mt-3 text-sm text-text-300">
        {hubMeta(featured, { type: false })}
        {isStory ? ` · ${HAND_STORY_DISCLOSURE}` : ''}
      </p>
    </article>
  );

  const list = (
    <div className="min-w-0 lg:border-l lg:border-line-500 lg:pl-10">
      <p className="text-sm font-semibold tracking-[0.06em] text-text-300">이어서 읽기</p>
      <ol className="mt-2 divide-y divide-line-500">
        {secondary.map((article, index) => (
          <li key={article.id} className="py-5">
            <span className="tabular block font-mono text-xs text-text-300">
              {String(index + 1).padStart(2, '0')} · {BLOG_CONTENT_TYPE_LABEL[article.contentType]}
            </span>
            <ArticleTitle article={article} className="mt-1.5 block font-semibold text-text-100" />
            <span className="mt-1.5 block prose-ko text-sm text-text-300">
              {article.description}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );

  return (
    <section aria-label="이 글부터">
      {secondary.length > 0 ? (
        <SplitLayout ratio="7/5" primary={primary} secondary={list} />
      ) : (
        primary
      )}
    </section>
  );
}

/* ------------------------------------------------------------------------------------- */
/* Section layouts                                                                        */
/* ------------------------------------------------------------------------------------- */

/** Divided rows in two columns from `lg`: title, description, small print. Search guides. */
function HubRows({ articles }: { readonly articles: readonly BlogRecord[] }) {
  return (
    <ol className="mt-8 grid gap-x-12 lg:grid-cols-2">
      {articles.map((article) => (
        <li key={article.id} className="border-t border-line-500 py-5">
          <span className="block text-xs text-text-300">
            {TOPIC_LABEL[article.topic]}
            {article.readMinutes !== null ? ` · 약 ${article.readMinutes}분` : ''}
          </span>
          <ArticleTitle
            article={article}
            className="mt-1.5 block text-lg font-semibold text-text-100"
          />
          <span className="mt-1.5 block prose-ko text-sm text-text-300">{article.description}</span>
        </li>
      ))}
    </ol>
  );
}

/** A numbered strip in mono: index · title · topic · time. Data & probability. */
function HubDataStrip({ articles }: { readonly articles: readonly BlogRecord[] }) {
  return (
    <ol className="mt-8 divide-y divide-line-500 border-y border-line-500">
      {articles.map((article, index) => (
        <li
          key={article.id}
          className="grid items-baseline gap-x-4 gap-y-1 py-4 sm:grid-cols-[3rem_1fr_auto]"
        >
          <span className="tabular font-mono text-sm text-brand-500">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="min-w-0">
            <ArticleTitle article={article} className="block font-semibold text-text-100" />
            <span className="mt-1 block prose-ko text-sm text-text-300">{article.description}</span>
          </span>
          <span className="tabular font-mono text-xs text-text-300">
            {TOPIC_LABEL[article.topic]}
            {article.readMinutes !== null ? ` · ${article.readMinutes}분` : ''}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Large titles, one column, no boxes. Concepts & culture. */
function HubTitles({ articles }: { readonly articles: readonly BlogRecord[] }) {
  return (
    <ol className="mt-8 space-y-8 border-l-2 border-brand-600 pl-6">
      {articles.map((article) => (
        <li key={article.id}>
          <ArticleTitle
            article={article}
            className="block text-xl font-semibold text-text-100 sm:text-2xl"
          />
          <span className="mt-2 block max-w-lead prose-ko text-text-300">
            {article.description}
          </span>
          <span className="mt-2 block text-xs text-text-300">
            {hubMeta(article, { type: false })}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Stories: picture on top, deck under the title, the disclosure on every one. */
function HubStories({ articles }: { readonly articles: readonly BlogRecord[] }) {
  return (
    <ol className="mt-8 grid gap-x-10 gap-y-12 sm:grid-cols-2">
      {articles.map((article) => (
        <li key={article.id} className="min-w-0">
          <EditorialImage
            alt=""
            decorative
            aspect="3/2"
            sizes="(min-width: 640px) 50vw, 100vw"
            fallback={{ kind: article.kind, topic: article.topic, variant: article.id }}
          />
          <ArticleTitle
            article={article}
            className="mt-5 block text-xl font-semibold text-text-100"
          />
          <span className="mt-2 block prose-ko text-sm text-text-300">{article.description}</span>
          <span className="mt-2 block text-xs text-text-300">
            {hubMeta(article, { type: false })} · {HAND_STORY_DISCLOSURE}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function BlogHubSection({ section }: { readonly section: HubSection }) {
  const headingId = `${section.anchor}-heading`;
  return (
    <div id={section.anchor} data-section={section.type} className="scroll-mt-24">
      <SectionHeading
        title={section.label}
        description={`${section.description} ${section.articles.length}편.`}
      />
      <span className="sr-only" id={headingId}>
        {section.label}
      </span>
      {section.layout === 'stories' ? <HubStories articles={section.articles} /> : null}
      {section.layout === 'rows' ? <HubRows articles={section.articles} /> : null}
      {section.layout === 'data' ? <HubDataStrip articles={section.articles} /> : null}
      {section.layout === 'titles' ? <HubTitles articles={section.articles} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------------------------- */
/* Coming soon + index                                                                     */
/* ------------------------------------------------------------------------------------- */

export function BlogComingSoon({ types }: { readonly types: readonly BlogContentType[] }) {
  if (types.length === 0) return null;
  return (
    <section aria-label="준비 중인 시리즈" id="coming-soon" className="scroll-mt-24">
      <SectionHeading
        title="준비 중인 시리즈"
        description="아직 글이 없는 콘텐츠 타입입니다. 자리는 마련해 두었고, 글이 실리면 위 목차에 링크가 생깁니다."
      />
      <dl className="mt-6 grid gap-x-12 gap-y-6 sm:grid-cols-2">
        {types.map((type) => (
          <div key={type} data-type={type}>
            <dt className="flex items-center gap-2 font-semibold text-text-100">
              {BLOG_CONTENT_TYPE_LABEL[type]}
              <span className={BADGE}>준비 중</span>
            </dt>
            <dd className="mt-1.5 prose-ko text-sm text-text-300">
              {HUB_SECTION_DESCRIPTION[type]}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * The 전체 글 index — the region `tests/e2e/blog.spec.ts` reads: every `<li>` in it is
 * exactly one of "a link" or "a 준비 중 badge", and the count sentence matches.
 */
export function BlogIndex({
  articles,
  total,
  published,
}: {
  readonly articles: readonly BlogRecord[];
  readonly total: number;
  readonly published: number;
}) {
  return (
    <section aria-label="전체 글" id="all" className="scroll-mt-24">
      <SectionHeading
        title="전체 글"
        description={`전체 ${total}편 중 ${published}편을 읽을 수 있습니다. 콘텐츠 타입 순서로 늘어놓았고, 순서는 순위가 아닙니다.`}
      />
      <ol className="mt-6 columns-1 gap-x-10 sm:columns-2 lg:columns-3">
        {articles.map((article) => (
          <li
            key={article.id}
            data-type={article.contentType}
            className="break-inside-avoid border-t border-line-500 py-3"
          >
            <ArticleTitle
              article={article}
              className="block text-[0.9375rem] font-medium text-text-100"
            />
            <span className="mt-0.5 block text-xs text-text-300">{hubMeta(article)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
