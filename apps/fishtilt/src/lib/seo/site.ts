/**
 * The site's identity as SEO needs it: one origin, one name, one social card.
 *
 * ## The origin (Stage 3, D-S3-05)
 *
 * A canonical URL, a sitemap entry and an `og:url` are all ABSOLUTE by specification. The
 * site's production origin is `https://3bettilt.com` and that is the default: a build with
 * nothing configured produces the URLs the live site will carry. `NEXT_PUBLIC_SITE_URL`
 * overrides it for a preview or a local e2e run.
 *
 * The override is an ORIGIN, not a URL. A value that carries a path — `…/ko` is the likely
 * mistake, because the Korean home is `/ko` — would either be silently truncated (and then
 * the variable lies) or produce `/ko/ko/…` everywhere. So it throws, here, at module load:
 * the build fails with the reason rather than shipping wrong canonicals.
 *
 * `sitemap.ts` prints one informational line when the variable is unset, so a build log
 * says which origin it used. Every test asserts the RULE (absolute, same origin throughout,
 * no query string) rather than the literal host.
 */
import { DEFAULT_LOCALE, OPEN_GRAPH_LOCALE } from '../locale.js';

/** The Latin wordmark, exactly as `SiteHeader`/`SiteFooter` render it. */
export const SITE_NAME = '3BetTilt';

/**
 * The home page's search title (without the brand suffix) and meta description. Here rather
 * than in `app/[locale]/page.tsx` because the root layout carries the same pair as the
 * site-level fallback, and a layout must not import a page module.
 */
export const HOME_SEO_TITLE = '텍사스 홀덤 배우기 | 홀덤 족보·핸드레인지·승률 계산기';
export const HOME_SEO_DESCRIPTION =
  '텍사스 홀덤을 규칙과 족보부터 핸드레인지·확률까지 쉬운 한국어로 배웁니다. 13×13 핸드레인지 표와 승률·팟오즈·아웃츠 계산기를 직접 눌러보는 무료 학습 사이트입니다.';

/** Before the brand at the end of every `<title>`: `… - 3BetTilt` (`metadata.ts` `formatTitle`). */
export const TITLE_BRAND_SEPARATOR = ' - ';

/** Between a title's search phrase and its qualifier: `홀덤 팟오즈 계산기 | 무료 포커 계산기`. */
export const TITLE_QUALIFIER_SEPARATOR = ' | ';

/**
 * The search phrase of a title — everything before the qualifier. What structured data names
 * a page, a tool or a term set: `WebApplication.name` is `홀덤 팟오즈 계산기`, not the whole
 * search-result line.
 */
export function titleHead(title: string): string {
  return title.split(TITLE_QUALIFIER_SEPARATOR, 1)[0] ?? title;
}

/** The default locale's Open Graph tag (`<html lang>` in `src/app/layout.tsx` is the same
 *  locale). A page's own `og:locale` comes from its path — see `metadata.ts`. */
export const SITE_LOCALE = OPEN_GRAPH_LOCALE[DEFAULT_LOCALE];

/** Where the site is deployed. The default origin of every absolute URL (D-S3-05). */
export const PRODUCTION_ORIGIN = 'https://3bettilt.com';

/**
 * Normalises a configured origin: keeps scheme + host (+ port) and drops a lone trailing
 * slash, so `absoluteUrl` can concatenate without ever producing a double slash. Returns
 * `null` for an unset or blank value (the caller falls back to `PRODUCTION_ORIGIN`).
 *
 * THROWS for a value that is set but is not a bare http(s) origin — a typo, a `ftp:`
 * scheme, or a path/query/fragment (`https://3bettilt.com/ko`). A configured value that
 * cannot be used as written must not be quietly repaired into something else.
 */
export function normaliseOrigin(value: string | undefined): string | null {
  if (value === undefined || value.trim() === '') return null;
  const trimmed = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`NEXT_PUBLIC_SITE_URL is not a URL: "${trimmed}"`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`NEXT_PUBLIC_SITE_URL must be an http(s) origin, got: "${trimmed}"`);
  }
  const origin = `${parsed.protocol}//${parsed.host}`;
  if (trimmed !== origin && trimmed !== `${origin}/`) {
    throw new Error(
      `NEXT_PUBLIC_SITE_URL must be a bare origin with no path, query or fragment — ` +
        `got "${trimmed}". The locale prefix is added by the app; set "${origin}".`,
    );
  }
  return origin;
}

/** The origin every absolute URL on this site is built from. No trailing slash. */
export const SITE_ORIGIN: string =
  normaliseOrigin(process.env.NEXT_PUBLIC_SITE_URL) ?? PRODUCTION_ORIGIN;

/** `true` when `NEXT_PUBLIC_SITE_URL` is unset and the production default is in use. */
export const SITE_ORIGIN_IS_DEFAULT: boolean =
  normaliseOrigin(process.env.NEXT_PUBLIC_SITE_URL) === null;

/**
 * `'/learn/pot-odds'` -> `'https://…/learn/pot-odds'`. Rejects anything that is not a
 * root-relative path, because every caller has one and a silently-accepted absolute URL
 * would produce a canonical pointing at another origin.
 */
export function absoluteUrl(path: string, origin: string = SITE_ORIGIN): string {
  if (!path.startsWith('/')) {
    throw new Error(`absoluteUrl expects a root-relative path, got: ${path}`);
  }
  return path === '/' ? origin : `${origin}${path}`;
}

/**
 * The shared social card: `apps/fishtilt/public/og.png`, 1200x630.
 *
 * Static, not generated per page. `next/og`'s `ImageResponse` does not resolve under this
 * app's `nodenext` module resolution (the same constraint `RouteNavItem.tsx` documents for
 * `next/link` — verified: `TS2307: Cannot find module 'next/og'`), and a per-page card
 * would additionally need an embedded Korean face, which this repository does not carry.
 * So the card is the wordmark and the 13x13 motif, in the site's own palette, with no text
 * that could go stale — the page's real title and description travel as `og:title` and
 * `og:description` beside it.
 */
export const OG_IMAGE_PATH = '/og.png';
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
/** Describes the picture, not the page: the wordmark beside a partly filled 13×13 grid. */
export const OG_IMAGE_ALT = '3BetTilt 워드마크와 붉은 칸이 채워진 13×13 핸드 격자';
