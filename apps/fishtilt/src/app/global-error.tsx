'use client';

/**
 * The last-resort error boundary — what a visitor sees when the ROOT LAYOUT itself throws.
 *
 * This is the only component in the app that replaces `layout.tsx` rather than rendering
 * inside it, which is why it renders its own `<html>` and `<body>`: at this point there is
 * no header, no footer, and no root document to inherit. If `lang="ko"` is not written
 * here it does not exist anywhere, and neither does a title.
 *
 * WHAT THIS FILE DOES AND DOES NOT REACH — measured, not assumed. The Stage-2 review found
 * `.next/server/app/_global-error.html` shipping with no `lang` and an English title, and
 * adding this file does NOT change that document. `_global-error.html` is the render of a
 * SYNTHETIC route Next generates for itself, and that route is hard-wired to Next's own
 * component: `next/dist/esm/build/route-discovery.js` maps the `/_global-error` entry to
 * `require.resolve('next/dist/client/components/builtin/app-error')`, and no file under
 * `app/` is consulted. So that one build artifact stays Next's English shell until Next
 * makes it overridable; it is a framework limit, recorded as such rather than left as an
 * open project defect.
 *
 * What this file IS is the app's actual global error boundary, which is the path a visitor
 * takes. Every route's bundle carries it — verified by grep on the build: `app/page.js`,
 * `app/learn/page.js` and `app/about/page.js` each reference this module's chunk, and
 * `about.html` ships the client chunk containing this component's Korean strings. A root
 * layout that throws on a real page therefore renders THIS, in Korean, with a language.
 *
 * DELIBERATELY SELF-CONTAINED — no imports from `src/`, no `globals.css`, no design tokens.
 * Every other page in the app is free to reach for the shared components; this one is not,
 * and the reason is the failure it handles. This boundary catches a throw from the root
 * layout, which means the shared module graph and the stylesheet are among the suspects. A
 * fallback that depends on the thing that just failed is not a fallback. So the colours are
 * an inline `<style>` (a media query needs one, and it ships inside this document rather
 * than as a separate request that could also fail), and the one link is a literal `/`, the
 * same literal the wordmark in `SiteHeader` uses — the site root is not a registry entry
 * that can be renamed out from under it.
 *
 * The colours and the font stack below are the site's OWN token values, copied literally
 * because this document cannot read `globals.css` to ask for them — the same duplication
 * the no-flash script in `layout.tsx` makes for the same reason. `global-error.test.tsx`
 * asserts every one of them still equals its token, so the copy cannot silently drift into
 * a different-looking site. It cannot honour a STORED theme choice (the script that reads
 * `localStorage` lives in the layout that just failed), so it follows the OS preference,
 * which is the correct fallback.
 */
const STYLE = `
:root { color-scheme: dark light; }
body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem;
  background: #090a0d;
  color: #f5f6f7;
  font-family: ui-sans-serif, system-ui, -apple-system, 'Apple SD Gothic Neo', 'Segoe UI',
    'Malgun Gothic', Roboto, 'Helvetica Neue', sans-serif;
  line-height: 1.8;
  -webkit-font-smoothing: antialiased;
}
main { max-width: 34rem; }
h1 { font-size: 1.5rem; line-height: 1.5; margin: 0 0 0.75rem; letter-spacing: -0.01em; }
p { margin: 0 0 1.5rem; color: #9aa1ac; }
code {
  font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono',
    monospace;
  font-size: 0.875em;
}
.actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem;
  padding: 0.625rem 1.25rem;
  border-radius: 0.375rem;
  border: 1px solid transparent;
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
}
.primary { background: #d71e36; color: #ffffff; }
.secondary { background: transparent; border-color: #616c7a; color: inherit; }
.digest { font-size: 0.875rem; color: #9aa1ac; margin: 2.5rem 0 0; }
@media (prefers-color-scheme: light) {
  body { background: #f2f4f7; color: #10141a; }
  p { color: #566070; }
  .primary { background: #a01230; }
  .secondary { border-color: #808a96; }
  .digest { color: #566070; }
}
`;

export default function GlobalError({
  error,
  reset,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}) {
  return (
    <html lang="ko">
      <head>
        <title>문제가 생겼습니다 - 3BetTilt</title>
        <meta name="robots" content="noindex, follow" />
        <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      </head>
      <body>
        <main>
          <h1>페이지를 불러오지 못했습니다</h1>
          <p>
            사이트에 일시적인 문제가 생겼습니다. 잠시 후 다시 시도해주시고, 계속 같은 화면이 나오면
            홈에서 다시 들어와 주세요.
          </p>
          <div className="actions">
            <button type="button" className="button primary" onClick={reset}>
              다시 시도
            </button>
            {/* The bare root, on purpose: this file may import nothing (it exists to survive
                a broken module graph — see its test), and `/` is the one redirect the site
                keeps, to the default locale's home (D-S3-03). */}
            <a className="button secondary" href="/">
              홈으로 가기
            </a>
          </div>
          {error?.digest === undefined ? null : (
            <p className="digest">
              문의하실 때 이 코드를 함께 알려주세요: <code>{error?.digest}</code>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
