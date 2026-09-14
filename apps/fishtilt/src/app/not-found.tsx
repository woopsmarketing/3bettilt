/**
 * The site's 404 page — the one route a visitor reaches by accident.
 *
 * WHY THIS FILE EXISTS AT ALL. Without it Next ships its own built-in `NotFound`, and the
 * independent Stage-2 review found what that costs. The built-in renders an English string
 * (`404: This page could not be found.`) inside a `<title>` element of its own, INSIDE the
 * root layout — so the prerendered `_not-found.html` carried TWO `<title>` tags. The first
 * one wins in every browser and every link unfurler, and the first one is the root layout's
 * fallback (the home page's own title). A Korean visitor who mistyped a URL got a page that
 * looked like a bug, and anything that read the document was told this was the homepage.
 * The built-in also renders no `<main>`, so the site's one landmark-less page was the page
 * where a screen-reader user most needs to find the way out.
 *
 * WHAT IT DOES INSTEAD. It is a real page in Korean with the site's own chrome (the root
 * layout's header and footer still wrap it), one `<main>` landmark, and — the actual job of
 * a 404 — a way out. All four content templates call `notFound()` on an unknown slug
 * (`/learn`, `/blog`, `/glossary`, `/hands`), so a stale link or a mistyped hand key lands
 * here; the fastest recovery for each of those is the hub it fell out of, which is why the
 * destinations below are the hubs rather than a generic "go home". Stage 3 adds the second
 * fastest recovery: a search box that submits straight to `/search?q=…` as a plain GET form,
 * which works with JavaScript off and needs no client component on a page that is
 * prerendered once.
 *
 * Every destination is resolved through the route registry, never written as a literal
 * path — the same gate the header, the homepage and every hub already apply, so a route
 * that is renamed or turned off cannot leave this page pointing into another 404.
 *
 * The metadata is hand-written rather than built by `pageMetadata`, for two reasons. There
 * is no canonical: this document has no address of its own, and emitting one would be the
 * "404 claims to be a real page" bug in a subtler form. And `index: false` here is not the
 * usual policy call — a 404 already answers with HTTP 404, and the `noindex` is belt and
 * braces for the case where something renders this body at a 200.
 */
import type { Metadata } from 'next';
import { HomeCallToAction } from '../components/HomeCallToAction.js';
import { formatTitle } from '../lib/seo/index.js';
import { routeById } from '../lib/routes.js';
import { SEARCH_QUERY_PARAM } from '../features/search/index.js';

export const metadata: Metadata = {
  title: formatTitle('페이지를 찾을 수 없습니다'),
  description:
    '요청하신 주소에 해당하는 페이지가 없습니다. 학습·도구·용어 목록에서 다시 찾아보세요.',
  robots: { index: false, follow: true },
  /*
   * `null`, not "omitted". Metadata MERGES with the root layout's, and the root layout sets
   * a canonical (and an `openGraph.url`) of the site root because its own fallback describes
   * the homepage. Leaving these out therefore does not leave them empty — it inherits them,
   * and the first build of this page proved it: `_not-found.html` came out carrying
   * `<link rel="canonical" href="<origin>/ko">`. That is the same defect this
   * file was written to remove, just moved from the `<title>` into the `<link>`: a 404
   * telling every crawler it is the front door. A 404 has no address of its own, so it
   * emits no canonical and no Open Graph card at all.
   */
  alternates: null,
  openGraph: null,
  twitter: null,
};

/**
 * Where a lost visitor is most likely to have been going, in the order the site itself
 * teaches: read first, then the flagship table, then the calculators, then practice, then
 * look a word up. `description` is written for someone who does not yet know what the
 * destination is — this page cannot assume the reader has seen the nav.
 */
export const NOT_FOUND_DESTINATIONS: readonly {
  readonly routeId: string;
  readonly description: string;
}[] = [
  { routeId: 'learn', description: '규칙과 기본기를 순서대로 읽는 학습 코스입니다.' },
  { routeId: 'range', description: '13×13 표에서 어떤 시작 핸드를 여는지 눌러보며 확인합니다.' },
  { routeId: 'tools', description: '승률·팟 오즈·아웃을 직접 계산해보는 무료 도구 모음입니다.' },
  { routeId: 'practice', description: '읽은 내용을 문제로 확인하는 퀴즈입니다.' },
  { routeId: 'glossary', description: '모르는 포커 용어를 한국어 설명으로 찾아봅니다.' },
  { routeId: 'blog', description: '자주 막히는 상황을 하나씩 풀어 쓴 글입니다.' },
  { routeId: 'hands', description: '169개 시작 패를 하나씩 따로 설명한 페이지입니다.' },
];

const SEARCH_INPUT_ID = 'not-found-search';

export default function NotFound() {
  const home = routeById('home');
  const search = routeById('search');

  return (
    <main className="mx-auto max-w-grid px-6 py-16 lg:py-24">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-7">
          <p
            aria-hidden="true"
            className="tabular font-mono text-[5rem] leading-none font-semibold tracking-tight text-brand-500 sm:text-[7rem]"
          >
            404
          </p>
          <h1 className="prose-ko mt-4 text-article-h1 font-semibold text-text-100">
            찾으시는 페이지가 없습니다
          </h1>
          <p className="prose-ko mt-4 max-w-lead text-lg text-text-300">
            주소가 잘못 입력되었거나, 그 사이 주소가 바뀐 페이지입니다. 검색해보거나, 아래에서
            원하시는 곳으로 바로 갈 수 있습니다.
          </p>

          {search.available ? (
            <form
              role="search"
              aria-label="사이트 검색"
              action={search.path}
              method="get"
              className="mt-8 flex max-w-lead flex-col gap-2 sm:flex-row"
            >
              <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
                검색어
              </label>
              <input
                id={SEARCH_INPUT_ID}
                name={SEARCH_QUERY_PARAM}
                type="search"
                placeholder="예: 팟 오즈, 3벳, AKs"
                autoComplete="off"
                className="h-12 w-full min-w-0 sm:flex-1 rounded-md border border-line-500 bg-ground-800 px-4 text-base text-text-100 outline-none placeholder:text-text-300 focus-visible:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              />
              <button
                type="submit"
                className="inline-flex h-12 shrink-0 cursor-pointer items-center justify-center rounded-md bg-brand-600 px-5 font-medium text-ink-on-brand outline-none transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                검색
              </button>
            </form>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <HomeCallToAction
              href={home.available ? home.path : null}
              label="홈으로 가기"
              variant="secondary"
            />
          </div>
        </div>

        <nav aria-label="많이 찾는 곳" className="lg:col-span-5">
          <p className="text-xs font-semibold tracking-[0.08em] text-text-300">많이 찾는 곳</p>
          <ul className="mt-3 divide-y divide-line-500 border-y border-line-500">
            {NOT_FOUND_DESTINATIONS.map((destination) => {
              const route = routeById(destination.routeId);
              if (!route.available) return null;
              return (
                <li key={route.id}>
                  <a
                    href={route.path}
                    className="group flex items-center justify-between gap-4 py-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  >
                    <span className="min-w-0">
                      <span className="block text-base font-semibold text-text-100 group-hover:text-brand-500">
                        {route.label}
                      </span>
                      <span className="prose-ko mt-0.5 block text-sm text-text-300">
                        {destination.description}
                      </span>
                    </span>
                    <span aria-hidden="true" className="shrink-0 text-brand-500">
                      →
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </main>
  );
}
