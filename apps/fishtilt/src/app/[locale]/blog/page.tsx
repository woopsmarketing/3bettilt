/**
 * `/blog` — the editorial hub (WP-S3-06, contracts AF/AG, D-S3-19).
 *
 * The blog has two engines: search content (guides that answer a query completely) and
 * editorial content (hand stories, the pillar). This page is a magazine front for both:
 * hero · content-type nav (anchors, not routes) · a featured article with a secondary
 * list · one section per content type, each with its own layout · a compact index of
 * everything. `blogHubModel.ts` decides all of it as data; this file only renders.
 *
 * ## What the page does not claim
 *
 * No date on any record (ruling 105) and no analytics, so no 최신·인기 order anywhere. The
 * one editorial slot is a deterministic pick labelled "이 글부터"; section order is the
 * declared type order; article order inside a section is registry order, and the index
 * says so. A content type with nothing written is named under 준비 중 rather than padded
 * with a stand-in — with zero stories today the featured slot features a search guide.
 *
 * ## The e2e contract this page keeps
 *
 * `tests/e2e/blog.spec.ts` reads the region named `전체 글` and asserts every `<li>` in it is
 * exactly one of "a link" or "a 준비 중 badge", then cross-checks the count sentence. The
 * `ItemList` has the same members, published rows only, in the order the page first renders
 * them (featured, 이어서 읽기, then the sections) — see `hubListedItems`.
 */
import type { Metadata } from 'next';
import {
  collectionPageJsonLd,
  itemListJsonLd,
  JsonLd,
  pageMetadata,
  routeBreadcrumbs,
} from '../../../lib/seo/index.js';
import { Breadcrumbs } from '../../../components/Breadcrumbs.js';
import { EditorialHero } from '../../../components/EditorialHero.js';
import { Section } from '../../../components/Section.js';
import {
  BlogCategoryNav,
  BlogComingSoon,
  BlogFeatured,
  BlogHubSection,
  BlogIndex,
} from '../../../components/blog/BlogHubSections.js';
import { HERO_TITLE_BREAK } from '../../../components/blog/BlogArticleShell.js';
import { buildBlogHub, hubListedItems } from '../../../components/blog/blogHubModel.js';
import { blogRecords } from '../../../content/graph.js';
import { routeById } from '../../../lib/routes.js';

/** One statement of this hub's identity — canonical, `<title>`/OG, and the `CollectionPage`'s
 *  `name`/`description` all read it. */
const SEO = {
  path: routeById('blog').path,
  title: '포커 이야기와 검색 가이드',
  description:
    '한 판을 따라가는 핸드 스토리와, 검색창에 치는 질문에 끝까지 답하는 가이드. 숫자는 모두 계산된 값입니다.',
} as const;

export const metadata: Metadata = pageMetadata({ ...SEO, index: true });

export default function BlogIndexPage() {
  const hub = buildBlogHub(blogRecords());

  return (
    <main>
      <JsonLd
        blocks={[collectionPageJsonLd({ ...SEO, mainEntity: itemListJsonLd(hubListedItems(hub)) })]}
      />

      <Section width="shell" padded="none" className="pt-10 sm:pt-14">
        <Breadcrumbs className="mb-8" trail={routeBreadcrumbs('blog')} />
        {/* VA-08's fallback is a single-column typographic hero: no visual slot until the
            asset exists, so the hero stays honest and the type carries the opening. */}
        <EditorialHero
          className={HERO_TITLE_BREAK}
          eyebrow="블로그"
          title="포커 이야기와 검색 가이드"
          lead="한 판을 처음부터 끝까지 따라가는 핸드 스토리, 그리고 궁금한 것 하나에 끝까지 답하는 검색 가이드. 어느 쪽이든 숫자는 이 사이트가 직접 계산한 값만 씁니다."
          facts={[
            { label: '전체 글', value: `${hub.total}편` },
            { label: '핸드 스토리', value: hub.storyCount > 0 ? `${hub.storyCount}편` : '준비 중' },
            { label: '콘텐츠 타입', value: `${hub.nav.length}` },
          ]}
        />
        <BlogCategoryNav entries={hub.nav} />
      </Section>

      {hub.featured !== null ? (
        <Section width="shell" padded="section">
          <BlogFeatured featured={hub.featured} secondary={hub.secondary} />
        </Section>
      ) : null}

      {hub.sections.map((section, index) => (
        <Section
          key={section.type}
          width={section.layout === 'titles' ? 'breakout' : 'shell'}
          tone={section.layout === 'data' ? 'recessed' : 'ground'}
          divider={index === 0 && section.layout !== 'data' ? 'top' : 'none'}
          padded="section"
        >
          <BlogHubSection section={section} />
        </Section>
      ))}

      {hub.comingSoon.length > 0 ? (
        <Section width="shell" tone="panel" padded="compact">
          <BlogComingSoon types={hub.comingSoon} />
        </Section>
      ) : null}

      <Section width="shell" divider="top" padded="section">
        <BlogIndex articles={hub.index} total={hub.total} published={hub.published} />
      </Section>
    </main>
  );
}
