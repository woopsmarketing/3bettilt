import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '../components/SiteHeader.js';
import { SiteFooter } from '../components/SiteFooter.js';
import { DEFAULT_LOCALE } from '../lib/locale.js';
import { routeById } from '../lib/routes.js';
import { pageMetadata, SITE_ORIGIN } from '../lib/seo/index.js';

/**
 * Site-level metadata.
 *
 * `metadataBase` is the one place Next needs an absolute origin: it is what resolves any
 * relative URL in an Open Graph or canonical field, and without it Next falls back to
 * `localhost` with a build warning. Every builder in `src/lib/seo/` emits absolute URLs
 * already, so this is belt-and-braces — but it is also what makes a page that forgets a
 * canonical produce a wrong-but-well-formed one rather than a `localhost` one.
 *
 * The rest is the fallback every route overrides with its own (`src/lib/seo/metadata.ts`).
 *
 * CORRECTED BY WP-7a. This block used to say it surfaced on `/`, "which has no `metadata`
 * export of its own". That was true when WP-N wrote it and false by the time WP-3 shipped:
 * `src/app/page.tsx` exports its own `pageMetadata({ path: '/', … })`, which wins. So NO route
 * renders these strings today — every one of the 18 static routes and all four content
 * templates set their own. What is left here is `metadataBase` (which is not a fallback: Next
 * needs it whether or not a page sets a canonical) plus a title and description that exist so
 * that a route added tomorrow without a `metadata` export emits the site's own name and a real
 * sentence rather than Next's defaults. They are kept identical to the homepage's title, so
 * the fallback and the front door cannot describe two different sites.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  ...pageMetadata({
    path: routeById('home').path,
    title: '무료 홀덤 학습',
    description:
      '텍사스 홀덤을 처음부터 쉬운 한국어로. 13×13 핸드레인지 표, 승률·팟 오즈·아웃 계산기를 직접 눌러보며 배우는 무료 학습 사이트입니다.',
    index: true,
  }),
};

/**
 * The no-flash theme script.
 *
 * This runs synchronously in `<head>`, before the browser paints anything, and is the only
 * reason a reader who chose light does not see a black page first. It cannot be a React
 * effect: an effect runs after the first paint, which is the flash.
 *
 * It only ever stamps an EXPLICIT choice. With nothing stored it leaves `data-theme` off the
 * element entirely, which is what hands the decision to `prefers-color-scheme` in
 * `globals.css` — so a visitor who never touched the toggle (and a visitor with JavaScript
 * disabled, for whom this never runs) still gets their OS preference.
 *
 * `try/catch` because `localStorage` is not merely empty but THROWS in some privacy modes and
 * inside some embedded webviews. A throw here would abort the whole inline script; catching it
 * and doing nothing leaves the default theme, which is the correct failure.
 *
 * The value name is duplicated as a literal because this string is serialised into HTML and
 * cannot import `THEME_STORAGE_KEY` from `ThemeToggle`; `ThemeToggle.test.tsx` asserts the two
 * agree.
 */
const NO_FLASH_THEME_SCRIPT = `try{var t=localStorage.getItem('fishtilt-theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // The audience is Korean and so is the whole site: `lang` drives font selection, line
  // breaking and hyphenation in the browser (ADR-0053). It is the default locale constant,
  // not a literal — the same value `src/app/[locale]/layout.tsx` prerenders every page under
  // (D-S3-01). This root layout has no `params`, so with one locale the default IS the page's
  // locale; a second locale would move `<html lang>` into the `[locale]` layout.
  //
  // `suppressHydrationWarning` on `<html>`: the script above mutates this element's
  // attributes before React hydrates, so the server's `<html>` and the browser's differ by
  // design. The suppression is one element deep and does not reach any child.
  return (
    <html lang={DEFAULT_LOCALE} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col antialiased">
        {/*
         * The skip link (WCAG 2.4.1). The Stage-2 review measured the cost of not having one:
         * the first Tab stop on every page was the wordmark, and a keyboard-only visitor who
         * does not use a screen reader had to walk six nav links, search, the theme toggle and
         * the hamburger before reaching the article — on every page, every time. A screen
         * reader user could already jump by landmark (every page has exactly one `<main>`,
         * which is ARIA11, a sufficient technique for 2.4.1); this is the half of that
         * audience the landmark does nothing for.
         *
         * It is the first focusable thing in the document, which is the whole point, and it is
         * clipped away until it takes focus. `sr-only` alone would leave a link nobody can see
         * while tabbing to it, so `focus:not-sr-only` brings it back into the page wearing the
         * same brand fill and the same 44px minimum as the site's primary buttons.
         *
         * EVERY paint utility here is behind `focus:`, including the fill. Unfocused, this
         * element is clipped to nothing, so its colours are unobservable — and a resting
         * `bg-brand-600` made it answer to `a.bg-brand-600`, which is how the existing
         * primary-button contrast tests find the hero CTA. A keyboard affordance that shadows
         * the page's main call to action in the test suite is a real cost for a fill nobody
         * can see.
         *
         * The target is the wrapper rather than `<main>` itself, because `<main>` belongs to
         * each page and this file cannot reach it. `tabIndex={-1}` is what makes the jump
         * actually move focus: without it the browser scrolls to the element and leaves focus
         * on the link, so the next Tab returns to the header — the bug that makes a skip link
         * look like it works and do nothing.
         */}
        <a
          href="#main-content"
          className="sr-only rounded-md font-medium focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:bg-brand-600 focus:px-5 focus:py-2.5 focus:text-ink-on-brand focus:outline-2 focus:outline-offset-2 focus:outline-brand-500"
        >
          본문으로 건너뛰기
        </a>
        <SiteHeader />
        <div id="main-content" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
