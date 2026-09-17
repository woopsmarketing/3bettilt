/**
 * `/search` — the site-wide search page (WP-K; Stage 3 redesign in WP-S3-15).
 *
 * This file stays a plain Server Component — no `searchParams` prop, no dynamic rendering —
 * the same reason `/tools/range`'s page does: it keeps this route's static, publicly-
 * cacheable shape. The one interactive island is `SearchClient` (`'use client'`); it reads
 * and writes the `?q=` query itself, client-side, after hydration — see that component's
 * module doc for why that is done there and not here. Client-side search over a build-time
 * index; no server route, so the site stays fully static-exportable.
 *
 * The page is two bands: a recessed hero that asks the question, then the search island in
 * the `breakout` column — wide enough for grouped results with headings, narrow enough that
 * a result row is still one glance.
 */
import type { Metadata } from 'next';
import { pageMetadata, routeBreadcrumbs } from '../../../lib/seo/index.js';
import { Breadcrumbs } from '../../../components/Breadcrumbs.js';
import { PageHero } from '../../../components/PageHero.js';
import { SearchClient } from '../../../components/SearchClient.js';
import { Section } from '../../../components/Section.js';
import { routeById } from '../../../lib/routes.js';

/*
 * WP-7a: THE TITLE AND THE H1 ARE DELIBERATELY DIFFERENT, and both stay as they are.
 *
 * This is the one route on the site that is `index: false` (build spec §33), so this title
 * will never be a search result — it is a browser tab and a bookmark, and a tab is labelled
 * with a noun. The `<h1>` is `무엇을 찾고 계신가요?` because the page's job on arrival is to
 * ask, not to label. There is no keyword to reconcile: WP-1 §2 assigns this route none,
 * precisely because it is not indexed.
 *
 * The breadcrumb below is UX only for the same reason — the `BreadcrumbList` on a `noindex`
 * page is not read by anyone, and the visible trail still tells a reader where they are.
 */
export const metadata: Metadata = pageMetadata({
  path: routeById('search').path,
  title: '검색',
  description:
    '배우기, 블로그, 포커 용어, 핸드, 도구까지 — 3BetTilt에 있는 모든 것을 한 번에 찾아보세요.',
  index: false,
});

export default function SearchPage() {
  return (
    <main>
      <Section
        width="breakout"
        tone="recessed"
        padded="compact"
        divider="bottom"
        aria-label="검색 소개"
      >
        <Breadcrumbs className="mb-6" trail={routeBreadcrumbs('search')} />
        <PageHero
          eyebrow="검색"
          title="무엇을 찾고 계신가요?"
          description="용어, 도구 이름, 시작 패(예: AKs)까지 — 3BetTilt에 있는 모든 것을 검색합니다. 3벳·쓰리벳·3bet처럼 표기가 달라도 같은 것을 찾아줍니다."
        />
      </Section>

      <Section width="breakout" padded="compact" aria-label="검색">
        <SearchClient />
      </Section>
    </main>
  );
}
