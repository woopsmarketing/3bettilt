'use client';

/**
 * The route-level error boundary — what a visitor sees when a page below the root layout
 * throws while rendering.
 *
 * Like `not-found.tsx`, this exists so the failure is in Korean and has a way out. Without
 * it the visitor gets Next's built-in English error screen; this one keeps the site's
 * header and footer (the boundary sits inside the root layout), so the nav is still there
 * and the page reads as this site having a bad moment rather than as a dead end. It is
 * drawn in the same shape as the 404 — a large monospace mark, a heading, one primary
 * action, the hubs — so the two accident pages read as one family.
 *
 * `'use client'` is not a choice: an error boundary has to run in the browser to catch a
 * client render, and `reset` is a function React hands us. The cost of that is that this
 * file cannot export `metadata` — a client module has no `metadata` export — so the tab
 * title falls back to the root layout's. That is acceptable here and NOT acceptable on
 * `not-found.tsx`, and the difference is worth stating: this boundary is never prerendered
 * to a file and never has a URL a crawler or an unfurler can fetch, so nothing outside the
 * browser tab ever reads its title. `_not-found.html` is a real build artifact.
 *
 * WHAT IS DELIBERATELY NOT HERE: no console logging and no "이미 보고되었습니다"-style
 * reassurance. This app has no error-reporting backend, and telling a reader their crash
 * was reported when nothing received it would be a fake implementation (CLAUDE.md rule 5).
 * `digest` is shown instead when React provides one — it is the only handle a reader could
 * actually quote to us, and in production it is the only part of the error React exposes
 * (the message is replaced by a generic string server-side, so there is nothing here that
 * could leak an internal detail into the page).
 */
import { HomeCallToAction } from '../components/HomeCallToAction.js';
import { routeById } from '../lib/routes.js';

const HUB_IDS = ['learn', 'range', 'tools', 'practice', 'glossary'] as const;

export default function RouteError({
  error,
  reset,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}) {
  const home = routeById('home');
  const hubs = HUB_IDS.map(routeById).filter((route) => route.available);

  return (
    <main className="mx-auto max-w-grid px-6 py-16 lg:py-24">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-7">
          <p
            aria-hidden="true"
            className="font-mono text-[3rem] leading-none font-semibold tracking-tight text-brand-500 sm:text-[4.5rem]"
          >
            오류
          </p>
          <h1 className="prose-ko mt-4 text-article-h1 font-semibold text-text-100">
            페이지를 여는 중 문제가 생겼습니다
          </h1>
          <p className="prose-ko mt-4 max-w-lead text-lg text-text-300">
            일시적인 문제일 수 있습니다. 다시 시도해보시고, 계속 같은 화면이 나오면 홈에서 다시
            들어와 주세요.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-md bg-brand-600 px-5 py-2.5 font-medium text-ink-on-brand outline-none transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              다시 시도
            </button>
            <HomeCallToAction
              href={home.available ? home.path : null}
              label="홈으로 가기"
              variant="secondary"
            />
          </div>

          {error?.digest === undefined ? null : (
            <p className="mt-10 text-sm text-text-300">
              문의하실 때 이 코드를 함께 알려주세요:{' '}
              <code className="font-mono text-text-100">{error?.digest}</code>
            </p>
          )}
        </div>

        <nav aria-label="많이 찾는 곳" className="lg:col-span-5">
          <p className="text-xs font-semibold tracking-[0.08em] text-text-300">많이 찾는 곳</p>
          <ul className="mt-3 divide-y divide-line-500 border-y border-line-500">
            {hubs.map((route) => (
              <li key={route.id}>
                <a
                  href={route.path}
                  className="flex min-h-12 items-center justify-between gap-4 py-2 text-base font-semibold text-text-100 outline-none hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                >
                  {route.label}
                  <span aria-hidden="true" className="text-brand-500">
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
