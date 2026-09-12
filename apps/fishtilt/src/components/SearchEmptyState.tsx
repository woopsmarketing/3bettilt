/**
 * `SearchEmptyState` — the honest fallback `SearchClient` renders whenever it has nothing
 * else to show: either nothing has been typed yet, or a query genuinely matched nothing.
 *
 * Deliberately does NOT fabricate a "did you mean" suggestion and does NOT silently widen
 * the query to force a result — this feature's honesty rule for a miss is to say so plainly
 * and point at (a) example queries a reader can start from with one tap and (b) the section
 * hubs a visitor can browse instead. The examples are `SEARCH_SUGGESTED_QUERIES` — real
 * queries, linked as `/search?q=…` through `buildSearchUrl`, so they work with JavaScript
 * off and land on the same page with the box filled. Every hub link comes from `routeById`
 * — never a literal path — so this component cannot invent a URL the registry lacks.
 */
import { routeById } from '../lib/routes.js';
import {
  buildSearchUrl,
  SEARCH_HUB_ROUTE_IDS,
  SEARCH_SUGGESTED_QUERIES,
  SEARCH_TIPS,
} from '../features/search/index.js';

export interface SearchEmptyStateProps {
  /** `''` means "nothing typed yet" — a different, friendlier heading than a real miss. */
  readonly query: string;
  readonly className?: string;
}

const CHIP =
  'inline-flex min-h-11 items-center rounded-md border border-line-500 bg-panel-700 px-3.5 text-sm ' +
  'font-medium text-text-100 outline-none transition-colors hover:border-brand-500 hover:bg-panel-600 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

export function SearchEmptyState({ query, className = '' }: SearchEmptyStateProps) {
  const hasQuery = query !== '';

  return (
    <div className={className} data-search-empty={hasQuery ? 'miss' : 'idle'}>
      <p className="prose-ko text-lg font-semibold text-text-100">
        {hasQuery ? `"${query}"에 대한 결과를 찾지 못했습니다` : '무엇을 찾고 계신가요?'}
      </p>
      <p className="prose-ko mt-2 max-w-lead text-sm text-text-300">
        {hasQuery
          ? '다른 표기로 다시 적어보거나, 아래 예시와 둘러보기에서 시작해보세요.'
          : '용어, 도구 이름, 시작 패(예: AKs)로 검색해보세요. 아래 예시를 눌러 바로 시작할 수도 있습니다.'}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <p className="text-xs font-semibold tracking-[0.06em] text-text-300">
            이런 검색어로 시작해보세요
          </p>
          <ul aria-label="검색 예시" className="mt-3 flex flex-wrap gap-2">
            {SEARCH_SUGGESTED_QUERIES.map((example) => (
              <li key={example}>
                <a href={buildSearchUrl(example)} className={CHIP}>
                  {example}
                </a>
              </li>
            ))}
          </ul>

          <p className="mt-8 text-xs font-semibold tracking-[0.06em] text-text-300">둘러보기</p>
          {/* Named so a screen reader announces these as a browse group rather than a bare list
              of links, and so a test can address them without colliding with the header and
              footer nav, which link the same hubs by the same labels. */}
          <ul aria-label="둘러보기" className="mt-3 flex flex-wrap gap-2">
            {SEARCH_HUB_ROUTE_IDS.map((id) => {
              const route = routeById(id);
              return (
                <li key={id}>
                  <a href={route.path} className={CHIP}>
                    {route.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>

        <aside aria-label="검색 팁" className="rounded-lg bg-ground-800 p-5 lg:col-span-5">
          <p className="text-xs font-semibold tracking-[0.06em] text-text-300">검색 팁</p>
          <ul className="mt-3 space-y-2">
            {SEARCH_TIPS.map((tip) => (
              <li key={tip} className="prose-ko flex gap-2 text-sm leading-[1.7] text-text-300">
                <span aria-hidden="true" className="mt-[0.1em] text-brand-500">
                  ·
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
