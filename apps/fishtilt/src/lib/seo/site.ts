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

/** The Latin wordmark, exactly as `SiteHeader`/`SiteFooter` render it. */
export const SITE_NAME = '3BetTilt';

/** BCP 47 tag matching `<html lang>` in `src/app/layout.tsx`. */
export const SITE_LOCALE = 'ko_KR';

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
export const OG_IMAGE_ALT = '3BetTilt';
