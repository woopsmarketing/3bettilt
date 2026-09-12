import { expect, test, type APIRequestContext } from '@playwright/test';
import { DEFAULT_LOCALE, HREFLANG } from '../../src/lib/locale.js';
import { koPath } from './helpers.js';

/*
 * SEO, checked against what the server actually sends (WP-N).
 *
 * Everything here is a RULE quantified over the whole sitemap, not a spot check on a page
 * someone picked. `docs/FISHTILT_STATE.md` rulings 26 and 56 are two views of the same
 * failure: a spec pinned to one lesson, one unbuilt tool or one sentence stops testing its
 * rule the moment that particular thing changes, while still looking green. So this file
 * names no slug, no lesson title and no article, and derives even the site's origin from
 * the sitemap rather than hard-coding it — `NEXT_PUBLIC_SITE_URL` is an environment
 * setting and every assertion below must hold whatever it is set to.
 *
 * The sitemap is the entry point on purpose: it is the site's own claim about which pages
 * deserve a search result, and each test is a way of holding that claim to account.
 */

const CANONICAL = /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/u;
const ROBOTS_META = /<meta[^>]+name="robots"[^>]+content="([^"]+)"/u;
const DESCRIPTION_META = /<meta[^>]+name="description"[^>]+content="([^"]*)"/u;
const TITLE = /<title[^>]*>([^<]*)<\/title>/u;
const LD_JSON = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gu;
const ANCHOR_HREF = /<a\b[^>]*?\shref="([^"]*)"/gu;

/**
 * The only types this site can substantiate. Anything else is schema spam (§35).
 *
 * WP-7a added four, WP-S3-16 one more, and the list stays CLOSED — a type that is not here
 * still fails. `WebSite`
 * and `Organization` are the site's own identity, declared on `/` only; `CollectionPage` is
 * what each of the six hubs is; `DefinedTermSet` is `/glossary`'s list, nested inside its
 * `CollectionPage` (so it is not a top-level `@type`, but it is named here beside the others
 * because `nestedTypes` below holds the closed set for what may appear INSIDE a block).
 */
const ALLOWED_TYPES = new Set([
  'BreadcrumbList',
  'Article',
  'FAQPage',
  'WebApplication',
  'WebSite',
  'Organization',
  'CollectionPage',
  // WP-S3-11/16: a glossary term page states its own entry as a top-level block, pointing
  // back at the hub's nested `DefinedTermSet`.
  'DefinedTerm',
]);

/** Types that may appear nested inside a block above, and nowhere on their own. */
const ALLOWED_NESTED_TYPES = new Set([
  'ListItem',
  'Question',
  'Answer',
  'WebPage',
  'Organization',
  'Offer',
  'ItemList',
  'DefinedTerm',
  'DefinedTermSet',
  'WebSite',
]);

interface Sitemap {
  readonly origin: string;
  readonly paths: readonly string[];
}

interface Fetched {
  readonly path: string;
  readonly html: string;
}

/** Read live, per test — no shared mutable state and no worker-scope fixture juggling. */
async function readSitemap(request: APIRequestContext): Promise<Sitemap> {
  const response = await request.get('/sitemap.xml');
  expect(response.status()).toBe(200);
  const locs = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/gu)].map(
    (match) => match[1] ?? '',
  );
  expect(locs.length).toBeGreaterThan(0);
  return {
    origin: new URL(locs[0] ?? '').origin,
    paths: locs.map((loc) => new URL(loc).pathname),
  };
}

/** The canonical URL for a path — the root has no trailing slash. */
function canonicalFor(origin: string, path: string): string {
  return path === '/' ? origin : origin + path;
}

function jsonLdBlocks(html: string): Record<string, unknown>[] {
  return [...html.matchAll(LD_JSON)].map(
    (match) => JSON.parse(match[1] ?? '') as Record<string, unknown>,
  );
}

async function fetchAll(
  request: APIRequestContext,
  paths: readonly string[],
): Promise<readonly Fetched[]> {
  const out: Fetched[] = [];
  for (const path of paths) {
    const response = await request.get(path);
    expect(response.status(), `${path} did not return 200`).toBe(200);
    out.push({ path, html: await response.text() });
  }
  return out;
}

const CONTENT_PATH_PREFIXES = ['/learn', '/blog', '/glossary', '/hands'].map(
  (sitePath) => `${koPath(sitePath)}/`,
);

function isContentPath(path: string): boolean {
  return CONTENT_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * The page's own `<main>`, without the site header and footer.
 *
 * Every link assertion below is scoped to this. The header and the footer link `/tools/range`
 * and every other hub on EVERY page, so a document-wide anchor scan sees a hub's own card and
 * the chrome's copy of it as two renderings of the same list. What is being checked is what
 * the PAGE renders, which is exactly what `<main>` holds.
 */
function mainOf(html: string): string {
  const main = /<main\b[^>]*>([\s\S]*)<\/main>/u.exec(html)?.[1];
  expect(main, 'the page renders no <main>').toBeDefined();
  return main ?? '';
}

/** Every `href` the page's own `<main>` renders, in document order. */
function anchorHrefs(html: string): string[] {
  return [...mainOf(html).matchAll(ANCHOR_HREF)].map((match) => match[1] ?? '');
}

/**
 * Every `<link rel="alternate" hreflang="…" href="…">` in the whole document (`<head>`, not
 * `<main>` — `anchorHrefs` above is deliberately scoped to the page's own content, but
 * hreflang is document metadata). Matched tag-first, then attribute-by-attribute, so neither
 * attribute order nor `hreflang` vs `hrefLang` casing can hide a missing or malformed link.
 */
function hreflangLinks(html: string): { hreflang: string; href: string }[] {
  const out: { hreflang: string; href: string }[] = [];
  for (const [tag] of html.matchAll(/<link\b[^>]*>/giu)) {
    if (!/\srel="alternate"/iu.test(tag)) continue;
    const hreflang = /\shreflang="([^"]+)"/iu.exec(tag)?.[1];
    const href = /\shref="([^"]+)"/iu.exec(tag)?.[1];
    if (hreflang !== undefined && href !== undefined) out.push({ hreflang, href });
  }
  return out;
}

/** Every `@type` string anywhere inside a block, however deeply nested. */
function typesIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(typesIn);
  if (value === null || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  const own = typeof record['@type'] === 'string' ? [record['@type']] : [];
  return [
    ...own,
    ...Object.entries(record).flatMap(([key, child]) => (key === '@type' ? [] : typesIn(child))),
  ];
}

/** Every absolute URL anywhere inside a block. */
function urlsIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(urlsIn);
  if (typeof value === 'string') return /^https?:\/\//u.test(value) ? [value] : [];
  if (value === null || typeof value !== 'object') return [];
  return Object.values(value as Record<string, unknown>).flatMap(urlsIn);
}

/**
 * The rows a `CollectionPage` declares, whichever of the two list types carries them: an
 * `ItemList` on five hubs, a `DefinedTermSet` on `/glossary`.
 */
function collectionRows(block: Record<string, unknown>): { name: string; url: string }[] {
  const main = (block['mainEntity'] ?? {}) as Record<string, unknown>;
  return (
    (main['itemListElement'] ?? main['hasDefinedTerm'] ?? []) as {
      name: string;
      url: string;
    }[]
  ).map((row) => ({ name: row.name, url: row.url }));
}

/** `koPath('/learn/pot-odds')` -> `koPath('/learn')`. The hub a content page is listed on. */
function hubOf(path: string): string {
  const site = path.slice(koPath('/').length);
  return koPath(`/${site.split('/')[1] ?? ''}`);
}

test.describe('SEO foundation', () => {
  test('robots.txt allows crawling and points at the sitemap', async ({ request }) => {
    const { origin } = await readSitemap(request);
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body.toLowerCase()).toContain('user-agent: *');
    expect(body.toLowerCase()).toContain('allow: /');
    // Nothing is blocked from crawling: `noindex` is what keeps a page out of an index, and
    // a crawler that is blocked from fetching a page never reads it (see `src/app/robots.ts`).
    expect(body.toLowerCase()).not.toContain('disallow:');
    expect(body).toContain(`${origin}/sitemap.xml`);

    // The sitemap line itself must point at THIS origin, not merely a well-formed one —
    // `NEXT_PUBLIC_SITE_URL` is a single switch, and a stale host here would send crawlers to
    // the wrong deployment while everything else in this file still passed.
    const sitemapLine = body.split(/\r?\n/u).find((line) => /^sitemap:/iu.test(line.trim()));
    expect(sitemapLine, 'robots.txt has no Sitemap: line').toBeDefined();
    const sitemapHref = (sitemapLine ?? '').replace(/^sitemap:/iu, '').trim();
    expect(new URL(sitemapHref).host).toBe(new URL(origin).host);
  });

  test('every sitemap URL is an absolute canonical URL on one origin', async ({ request }) => {
    const { origin, paths } = await readSitemap(request);
    for (const path of paths) {
      const url = new URL(canonicalFor(origin, path));
      expect(url.origin).toBe(origin);
      expect(url.search).toBe('');
      expect(url.hash).toBe('');
      expect(path === '/' || !path.endsWith('/')).toBe(true);
    }
    expect(new Set(paths).size).toBe(paths.length);
  });

  test('every sitemap URL resolves to a real page', async ({ request }) => {
    const { paths } = await readSitemap(request);
    for (const path of paths) {
      const response = await request.get(path);
      expect(response.status(), `${path} is in the sitemap but did not return 200`).toBe(200);
    }
  });

  test('every sitemap page names itself as canonical and is indexable', async ({ request }) => {
    const { origin, paths } = await readSitemap(request);
    for (const { path, html } of await fetchAll(request, paths)) {
      expect(CANONICAL.exec(html)?.[1], `${path} has the wrong canonical`).toBe(
        canonicalFor(origin, path),
      );
      expect(
        ROBOTS_META.exec(html)?.[1] ?? '',
        `${path} is in the sitemap but tells crawlers not to index it`,
      ).not.toContain('noindex');
    }
  });

  test('every sitemap page has a distinct title and a real description', async ({ request }) => {
    const { paths } = await readSitemap(request);
    const seen = new Map<string, string>();
    for (const { path, html } of await fetchAll(request, paths)) {
      const title = TITLE.exec(html)?.[1] ?? '';
      expect(title, `${path} has no title`).not.toBe('');
      expect(title, `${path} does not carry the site name`).toContain('3BetTilt');

      const description = DESCRIPTION_META.exec(html)?.[1] ?? '';
      expect(description.length, `${path} has no meta description`).toBeGreaterThan(20);

      const clash = seen.get(title);
      expect(clash, `${path} and ${String(clash)} share the title "${title}"`).toBeUndefined();
      seen.set(title, path);
    }
  });

  test('every sitemap page carries an absolute Open Graph block', async ({ request }) => {
    const { origin, paths } = await readSitemap(request);
    for (const { path, html } of await fetchAll(request, paths)) {
      expect(html, `${path} has no og:title`).toContain('property="og:title"');
      expect(html, `${path} has no og:image`).toContain(`${origin}/og.png`);
      expect(html, `${path} has no og:url`).toContain(`content="${canonicalFor(origin, path)}"`);
    }
  });

  test('the Open Graph image is a real image', async ({ request }) => {
    const response = await request.get('/og.png');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
  });

  test('the search page is noindex and is not in the sitemap — §33', async ({ request }) => {
    const { paths } = await readSitemap(request);
    expect(paths).not.toContain(koPath('/search'));
    const html = await (await request.get(koPath('/search'))).text();
    expect(ROBOTS_META.exec(html)?.[1] ?? '').toContain('noindex');
  });

  test('tool filter state canonicalises to the stable tool URL — §34', async ({ request }) => {
    const { origin } = await readSitemap(request);
    const cases = [
      [koPath('/tools/range?hero=BTN&stack=100&spot=RFI'), koPath('/tools/range')],
      [koPath('/tools/range?hero=UTG'), koPath('/tools/range')],
      [koPath('/tools/starting-hand?top=15'), koPath('/tools/starting-hand')],
      [koPath('/search?q=%ED%8C%9F'), koPath('/search')],
    ] as const;
    for (const [requested, canonical] of cases) {
      const html = await (await request.get(requested)).text();
      expect(CANONICAL.exec(html)?.[1], `${requested} canonicalised wrongly`).toBe(
        canonicalFor(origin, canonical),
      );
    }
  });

  test('every JSON-LD block parses and declares a type this site can substantiate', async ({
    request,
  }) => {
    const { paths } = await readSitemap(request);
    for (const { path, html } of await fetchAll(request, paths)) {
      for (const block of jsonLdBlocks(html)) {
        const type = String(block['@type']);
        expect(ALLOWED_TYPES.has(type), `${path} emits an unexpected @type: ${type}`).toBe(true);
        expect(block['@context']).toBe('https://schema.org');
        // The list stays closed all the way down, not only at the top level: a nested type
        // nobody vetted is the same schema spam one level in.
        for (const nested of typesIn(block)) {
          expect(
            ALLOWED_TYPES.has(nested) || ALLOWED_NESTED_TYPES.has(nested),
            `${path} emits an unexpected nested @type: ${nested}`,
          ).toBe(true);
        }
      }
    }
  });

  /*
   * WP-7a broadened this from "every content page" to EVERY indexed page but the home page.
   * The 18 static routes had no breadcrumb and therefore no `BreadcrumbList`; they do now, and
   * the same rule holds for both kinds. `/` is the deliberate exception: at the root the trail
   * would be a single crumb pointing at the page you are on, so `routeBreadcrumbs('home')`
   * returns nothing and `Breadcrumbs` renders nothing.
   */
  test('every indexed page but the root shows the breadcrumb trail its BreadcrumbList declares', async ({
    request,
  }) => {
    const { origin, paths } = await readSitemap(request);
    const crumbed = paths.filter((path) => path !== koPath('/'));
    expect(crumbed.length).toBeGreaterThan(0);
    // Both kinds of page are in this set, or the broadening proved nothing.
    expect(crumbed.some(isContentPath)).toBe(true);
    expect(crumbed.some((path) => !isContentPath(path))).toBe(true);

    for (const { path, html } of await fetchAll(request, crumbed)) {
      expect(html, `${path} renders no breadcrumb nav`).toContain('aria-label="현재 위치"');

      const trail = jsonLdBlocks(html).find((block) => block['@type'] === 'BreadcrumbList');
      expect(trail, `${path} has no BreadcrumbList`).toBeDefined();
      const items = (trail?.['itemListElement'] ?? []) as {
        position: number;
        name: string;
        item: string;
      }[];
      expect(items.map((item) => item.position)).toEqual(items.map((_, index) => index + 1));
      expect(items.at(0)?.item).toBe(canonicalFor(origin, koPath('/')));
      expect(items.at(-1)?.item).toBe(canonicalFor(origin, path));
      // Every crumb but the last is a link the page actually renders — a trail that names a
      // step it does not offer is the ordinary form of breadcrumb spam.
      const hrefs = new Set(anchorHrefs(html));
      for (const item of items.slice(0, -1)) {
        const crumbPath = new URL(item.item).pathname || '/';
        expect(
          hrefs.has(crumbPath),
          `${path} declares a crumb it does not link: ${crumbPath}`,
        ).toBe(true);
      }
    }
  });

  test('the root declares the site once, and no other page declares it at all', async ({
    request,
  }) => {
    const { origin, paths } = await readSitemap(request);
    expect(paths).toContain(koPath('/'));
    for (const { path, html } of await fetchAll(request, paths)) {
      const blocks = jsonLdBlocks(html);
      const count = (type: string): number =>
        blocks.filter((block) => block['@type'] === type).length;
      const expected = path === koPath('/') ? 1 : 0;
      expect(count('WebSite'), `${path}: WebSite`).toBe(expected);
      expect(count('Organization'), `${path}: Organization`).toBe(expected);

      if (path === koPath('/')) {
        const site = blocks.find((block) => block['@type'] === 'WebSite');
        expect(site?.['url']).toBe(canonicalFor(origin, koPath('/')));
        // `/search` parses `?q=` in the browser; there is no endpoint a query template could
        // reach, so the site must not advertise one.
        expect(JSON.stringify(blocks)).not.toContain('potentialAction');
        expect(JSON.stringify(blocks)).not.toContain('SearchAction');
        // …and no breadcrumb at the root.
        expect(count('BreadcrumbList')).toBe(0);
      }
    }
  });

  test('CollectionPage appears on hubs, never on a leaf, and always describes its own URL', async ({
    request,
  }) => {
    const { origin, paths } = await readSitemap(request);
    let hubs = 0;
    for (const { path, html } of await fetchAll(request, paths)) {
      const block = jsonLdBlocks(html).find((entry) => entry['@type'] === 'CollectionPage');
      if (isContentPath(path)) {
        expect(block, `${path} is one document, not a collection`).toBeUndefined();
        continue;
      }
      if (block === undefined) continue;
      hubs += 1;
      expect(block['url'], `${path} collects, but names another page`).toBe(
        canonicalFor(origin, path),
      );
      expect(collectionRows(block).length, `${path} collects nothing`).toBeGreaterThan(0);
    }
    expect(hubs, 'no hub emits a CollectionPage at all').toBeGreaterThan(0);
  });

  test('every CollectionPage row is a link that page renders, in the order it renders them', async ({
    request,
  }) => {
    const { origin, paths } = await readSitemap(request);
    const indexed = new Set(paths);

    for (const { path, html } of await fetchAll(request, paths)) {
      const block = jsonLdBlocks(html).find((entry) => entry['@type'] === 'CollectionPage');
      if (block === undefined) continue;

      const declared = collectionRows(block).map((row) => {
        const url = new URL(row.url);
        expect(url.origin, `${path} lists a foreign origin`).toBe(origin);
        expect(url.search, `${path} lists a filtered URL`).toBe('');
        expect(row.name.length, `${path} lists a nameless row`).toBeGreaterThan(0);
        return url.pathname;
      });

      expect(new Set(declared).size, `${path} lists the same URL twice`).toBe(declared.length);
      for (const row of declared) {
        expect(indexed.has(row), `${path} lists ${row}, which is not an indexed page`).toBe(true);
      }

      // Filtered rather than compared wholesale: `/tools` also renders a lesson link per tool,
      // which is a way onward and not part of what the hub collects. What must hold is that
      // every declared row IS a link on the page, in the declared order — by FIRST occurrence:
      // `/learn` renders its fifteen lessons twice (the roadmap, then the category browse),
      // and the `ItemList` serialises the list once, in the order the reader first meets it
      // (the same first-occurrence rule `hubCollectionPage.test.tsx` pins; WP-S3-16).
      const wanted = new Set(declared);
      const onPage = [...new Set(anchorHrefs(html).filter((href) => wanted.has(href)))];
      expect(
        onPage,
        `${path} declares a list its own markup does not render in that order`,
      ).toEqual(declared);
    }
  });

  test('every indexed content page is listed on its own hub', async ({ request }) => {
    /*
     * The inverse of the test above, and the one that catches a hub quietly dropping a record.
     * Derived rather than counted: whatever `/learn`, `/blog`, `/glossary` and `/hands` hold
     * next month, every `/learn/*` in the sitemap must appear on `/learn`.
     */
    const { paths } = await readSitemap(request);
    const contentPaths = paths.filter(isContentPath);
    expect(contentPaths.length).toBeGreaterThan(0);

    const listedByHub = new Map<string, Set<string>>();
    for (const hub of new Set(contentPaths.map(hubOf))) {
      const html = await (await request.get(hub)).text();
      const block = jsonLdBlocks(html).find((entry) => entry['@type'] === 'CollectionPage');
      expect(block, `${hub} lists content pages but publishes no CollectionPage`).toBeDefined();
      listedByHub.set(
        hub,
        new Set(
          collectionRows(block as Record<string, unknown>).map((row) => new URL(row.url).pathname),
        ),
      );
    }

    for (const path of contentPaths) {
      expect(
        listedByHub.get(hubOf(path))?.has(path),
        `${path} is indexed but ${hubOf(path)} does not list it`,
      ).toBe(true);
    }
  });

  test('every absolute URL in every block is on the sitemap origin', async ({ request }) => {
    /*
     * The one assertion that makes `NEXT_PUBLIC_SITE_URL` a single switch. Nothing here knows
     * the host: the origin is read from the sitemap, and every canonical, `og:url`, breadcrumb
     * item, `ItemList` row and `WebSite`/`Organization` URL must agree with it. A literal host
     * left anywhere in the source fails this whatever the variable is set to.
     */
    const { origin, paths } = await readSitemap(request);
    for (const { path, html } of await fetchAll(request, paths)) {
      for (const block of jsonLdBlocks(html)) {
        for (const url of urlsIn(block)) {
          if (url.startsWith('https://schema.org')) continue;
          expect(new URL(url).origin, `${path} names a foreign origin: ${url}`).toBe(origin);
        }
      }
    }
  });

  test('the sitemap lists documents only — not an icon, a card or a feed', async ({ request }) => {
    /*
     * `src/app/icon.svg` and `src/app/apple-icon.png` are Next file-convention assets, so they
     * are real routes (`/icon.svg`, `/apple-icon.png`) even though nothing is in `public/` but
     * `og.png`. They are not documents and must never be advertised as pages — checked against
     * the served sitemap rather than inferred from where the files live.
     */
    const { paths } = await readSitemap(request);
    for (const path of paths) {
      expect(path, `${path} is an asset, not a document`).not.toMatch(
        /\.(?:svg|png|jpe?g|webp|ico|xml|txt|json|js|css)$/iu,
      );
    }
    for (const asset of [
      '/icon.svg',
      '/apple-icon.png',
      '/og.png',
      '/sitemap.xml',
      '/robots.txt',
    ]) {
      expect(paths, `${asset} must not be in the sitemap`).not.toContain(asset);
      // …and it is genuinely there, or the exclusion is proving nothing.
      expect((await request.get(asset)).status(), `${asset} should exist`).toBe(200);
    }
  });

  test('Article markup appears on articles and nowhere else', async ({ request }) => {
    const { paths } = await readSitemap(request);
    for (const { path, html } of await fetchAll(request, paths)) {
      const hasArticle = jsonLdBlocks(html).some((block) => block['@type'] === 'Article');
      const isArticleRoute =
        path.startsWith(`${koPath('/learn')}/`) || path.startsWith(`${koPath('/blog')}/`);
      expect(hasArticle, `${path}: Article markup does not match the page kind`).toBe(
        isArticleRoute,
      );
    }
  });

  test('WebApplication markup appears on tool pages and nowhere else', async ({ request }) => {
    const { paths } = await readSitemap(request);
    for (const { path, html } of await fetchAll(request, paths)) {
      const hasApp = jsonLdBlocks(html).some((block) => block['@type'] === 'WebApplication');
      // A tool page is a page UNDER `/tools`; the hub itself is a list, not an application.
      expect(hasApp, `${path}: WebApplication markup does not match the page kind`).toBe(
        path.startsWith(`${koPath('/tools')}/`),
      );
    }
  });

  test('every FAQPage question is a question the page actually shows', async ({
    request,
    page,
  }) => {
    const { paths } = await readSitemap(request);
    const withFaq: { path: string; questions: string[] }[] = [];
    for (const { path, html } of await fetchAll(request, paths)) {
      const faq = jsonLdBlocks(html).find((block) => block['@type'] === 'FAQPage');
      if (faq === undefined) continue;
      const entries = (faq['mainEntity'] ?? []) as { name: string }[];
      expect(
        entries.length,
        `${path} declares a FAQPage with fewer than two questions`,
      ).toBeGreaterThan(1);
      withFaq.push({ path, questions: entries.map((entry) => entry.name) });
    }

    for (const { path, questions } of withFaq) {
      await page.goto(path);
      for (const question of questions) {
        await expect(
          page.getByRole('heading', { level: 3, name: question }),
          `${path} declares a FAQ question it does not show: ${question}`,
        ).toBeVisible();
      }
    }
  });

  test('a page that renders a FAQ section publishes exactly that section', async ({
    request,
    page,
  }) => {
    /*
     * The other direction from the test above, for the pipeline that CAN be checked both ways.
     * `FaqSection` renders plain text with nothing to drop, so a visible FAQ region and the
     * `FAQPage` block must match exactly — questions, answers and order.
     *
     * The MDX pipeline is deliberately not held to this: `faq.ts` drops a Q&A pair whose answer
     * embeds a component, because the rendered text of one is a build-time computation the
     * source does not contain. A lesson WP-7b writes with `<Fact>` in every answer is behaving
     * correctly when it publishes nothing, so asserting "visible FAQ ⇒ FAQPage" over MDX would
     * be a test that fails on correct content.
     */
    const { paths } = await readSitemap(request);
    const withRegion = (await fetchAll(request, paths)).filter(({ html }) =>
      html.includes('aria-label="자주 묻는 질문"'),
    );
    expect(withRegion.length, 'no page renders a FaqSection at all').toBeGreaterThan(0);

    for (const { path, html } of withRegion) {
      const faq = jsonLdBlocks(html).find((block) => block['@type'] === 'FAQPage');
      expect(faq, `${path} shows a FAQ section but publishes no FAQPage`).toBeDefined();
      const entries = (faq?.['mainEntity'] ?? []) as {
        name: string;
        acceptedAnswer: { text: string };
      }[];

      await page.goto(path);
      const region = page.getByRole('region', { name: '자주 묻는 질문' });
      const shown = await region.getByRole('heading', { level: 3 }).allInnerTexts();
      expect(
        entries.map((entry) => entry.name),
        `${path} publishes questions that are not the ones it shows`,
      ).toEqual(shown);
      for (const entry of entries) {
        await expect(
          region.getByText(entry.acceptedAnswer.text, { exact: true }),
          `${path} publishes an answer it does not show`,
        ).toBeVisible();
      }
    }
  });

  test('no page advertises a rating, a review or a date it does not have', async ({ request }) => {
    const { paths } = await readSitemap(request);
    for (const { path, html } of await fetchAll(request, paths)) {
      for (const block of jsonLdBlocks(html)) {
        const serialised = JSON.stringify(block);
        expect(serialised, `${path} claims a rating`).not.toContain('aggregateRating');
        expect(serialised, `${path} claims a review`).not.toContain('"review"');
        expect(serialised, `${path} claims a publication date`).not.toContain('datePublished');
      }
    }
  });

  test('every sitemap page emits hreflang ko-KR and x-default pointing at its own canonical', async ({
    request,
  }) => {
    /*
     * Stage 3 (D-S3-06). One locale today, but a crawler still needs the standing declaration
     * that this document's Korean edition IS the canonical URL — both `hreflang="ko-KR"` and
     * the `x-default` fallback point at the same place, because there is no other edition to
     * fall back to. `/search` is the one indexed-adjacent page this rule does not reach: it is
     * `noindex` and not in the sitemap (the test above), so it must advertise no alternate at
     * all rather than a lone ko-KR/x-default pair a crawler would have no reason to trust.
     */
    const { origin, paths } = await readSitemap(request);
    for (const { path, html } of await fetchAll(request, paths)) {
      const canonical = canonicalFor(origin, path);
      const links = hreflangLinks(html);
      const ko = links.find((link) => link.hreflang === HREFLANG[DEFAULT_LOCALE]);
      const xDefault = links.find((link) => link.hreflang === 'x-default');
      expect(
        ko?.href,
        `${path} has no hreflang="${HREFLANG[DEFAULT_LOCALE]}" link pointing at its canonical`,
      ).toBe(canonical);
      expect(
        xDefault?.href,
        `${path} has no hreflang="x-default" link pointing at its canonical`,
      ).toBe(canonical);
    }

    const searchHtml = await (await request.get(koPath('/search'))).text();
    expect(hreflangLinks(searchHtml), 'the noindex search page must emit no hreflang link').toEqual(
      [],
    );
  });

  /* ------------------------------------------------------------- WP-S3-16 additions */

  /**
   * The sitemap paths grouped by route family — `/ko/learn/*`, `/ko/tools/*`, the hubs, the
   * root — so a rule can be shown to hold on a representative of EVERY family rather than
   * on the pages that happen to be first. Derived from the sitemap, never listed.
   */
  function familyOf(path: string): string {
    const site = path.slice(koPath('/').length);
    const [, section = '', leaf] = site.split('/');
    if (site === '') return 'home';
    return leaf === undefined ? `${section}-hub` : section;
  }

  test('one representative of every route family passes the head checks', async ({ request }) => {
    const { origin, paths } = await readSitemap(request);
    const sample = new Map<string, string>();
    for (const path of paths) if (!sample.has(familyOf(path))) sample.set(familyOf(path), path);
    // The site has content families, tool/practice families and hubs; a sample that found
    // fewer than eight families would mean the grouping broke, not that the site shrank.
    expect(sample.size).toBeGreaterThanOrEqual(8);

    for (const { path, html } of await fetchAll(request, [...sample.values()])) {
      const family = familyOf(path);
      expect(
        html.match(/<title[^>]*>/gu)?.length,
        `${family} (${path}) must have exactly one <title>`,
      ).toBe(1);
      expect(/<html[^>]*\slang="([^"]*)"/u.exec(html)?.[1], `${family}: <html lang>`).toBe(
        DEFAULT_LOCALE,
      );
      expect(CANONICAL.exec(html)?.[1], `${family}: canonical`).toBe(canonicalFor(origin, path));
      expect(html, `${family}: og:url`).toContain(
        `property="og:url" content="${canonicalFor(origin, path)}"`,
      );
      expect(() => jsonLdBlocks(html), `${family}: JSON-LD must parse`).not.toThrow();
      expect(jsonLdBlocks(html).length, `${family}: at least one JSON-LD block`).toBeGreaterThan(0);
    }
  });

  test('every sitemap page declares its language once and carries exactly one title', async ({
    request,
  }) => {
    const { paths } = await readSitemap(request);
    for (const { path, html } of await fetchAll(request, paths)) {
      expect(/<html[^>]*\slang="([^"]*)"/u.exec(html)?.[1], `${path}: <html lang>`).toBe(
        DEFAULT_LOCALE,
      );
      expect(html.match(/<title[^>]*>/gu)?.length, `${path}: <title> count`).toBe(1);
      expect(html.match(/<h1\b/gu)?.length, `${path}: <h1> count`).toBe(1);
    }
  });

  test('every sitemap page carries the full Open Graph set and a Twitter card', async ({
    request,
  }) => {
    /*
     * `og:title`/`og:url`/`og:image` are checked above; this is the rest of what a social
     * card needs to render without guessing: a type, the locale, the site name, the image's
     * declared size and a description — plus the Twitter card type, which is a separate
     * vocabulary and is not inferred from Open Graph by every client.
     */
    const { paths } = await readSitemap(request);
    const metaContent = (
      html: string,
      attr: 'property' | 'name',
      key: string,
    ): string | undefined =>
      new RegExp(`<meta[^>]+${attr}="${key}"[^>]+content="([^"]*)"`, 'u').exec(html)?.[1];
    for (const { path, html } of await fetchAll(request, paths)) {
      expect(['article', 'website'], `${path}: og:type`).toContain(
        metaContent(html, 'property', 'og:type'),
      );
      expect(metaContent(html, 'property', 'og:locale'), `${path}: og:locale`).toBe('ko_KR');
      expect(metaContent(html, 'property', 'og:site_name'), `${path}: og:site_name`).toBe(
        '3BetTilt',
      );
      expect(
        metaContent(html, 'property', 'og:description')?.length ?? 0,
        `${path}: og:description`,
      ).toBeGreaterThan(20);
      expect(metaContent(html, 'property', 'og:image:width'), `${path}: og:image:width`).toBe(
        '1200',
      );
      expect(metaContent(html, 'property', 'og:image:height'), `${path}: og:image:height`).toBe(
        '630',
      );
      expect(metaContent(html, 'name', 'twitter:card'), `${path}: twitter:card`).toBe(
        'summary_large_image',
      );
    }
  });

  test('every sitemap page has a distinct meta description', async ({ request }) => {
    const { paths } = await readSitemap(request);
    const seen = new Map<string, string>();
    for (const { path, html } of await fetchAll(request, paths)) {
      const description = DESCRIPTION_META.exec(html)?.[1] ?? '';
      const clash = seen.get(description);
      expect(clash, `${path} and ${String(clash)} share a meta description`).toBeUndefined();
      seen.set(description, path);
    }
  });

  test('a page that does not exist is noindex with no canonical and no hreflang', async ({
    request,
  }) => {
    for (const path of [koPath('/learn/no-such-lesson'), '/learn', '/xx/learn']) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);
      const html = await response.text();
      expect(ROBOTS_META.exec(html)?.[1] ?? '', `${path}: robots`).toContain('noindex');
      expect(CANONICAL.exec(html), `${path}: a 404 has no canonical`).toBeNull();
      expect(hreflangLinks(html), `${path}: a 404 has no hreflang`).toEqual([]);
      expect(/<html[^>]*\slang="([^"]*)"/u.exec(html)?.[1], `${path}: <html lang>`).toBe(
        DEFAULT_LOCALE,
      );
    }
  });

  test('every glossary page publishes one DefinedTerm in the schema.org context, and no other page does', async ({
    request,
  }) => {
    const { origin, paths } = await readSitemap(request);
    const glossaryPrefix = `${koPath('/glossary')}/`;
    let terms = 0;
    for (const { path, html } of await fetchAll(request, paths)) {
      const blocks = jsonLdBlocks(html).filter((block) => block['@type'] === 'DefinedTerm');
      if (!path.startsWith(glossaryPrefix)) {
        expect(blocks.length, `${path} is not a glossary term`).toBe(0);
        continue;
      }
      terms += 1;
      expect(blocks.length, `${path}: exactly one DefinedTerm`).toBe(1);
      const term = blocks[0] ?? {};
      expect(term['@context']).toBe('https://schema.org');
      expect(term['url']).toBe(canonicalFor(origin, path));
      const set = term['inDefinedTermSet'] as Record<string, unknown>;
      expect(set['url']).toBe(canonicalFor(origin, koPath('/glossary')));
    }
    expect(terms).toBeGreaterThan(0);
  });

  test('no public page carries an internal codename or a placeholder host', async ({ request }) => {
    /*
     * Public surface says 3BetTilt (D-S3-07). The internal package name survives only in
     * DOM ids and a storage key, all lower-case; the mixed-case brand spellings and the
     * placeholder hosts must be absent from every served document.
     */
    const { origin, paths } = await readSitemap(request);
    const banned = [/FishTilt/u, /FISHTILT/u, /fishtilt\.example/iu, /example\.com/iu];
    if (!/localhost/u.test(origin)) banned.push(/localhost/u);
    for (const { path, html } of await fetchAll(request, paths)) {
      for (const pattern of banned) {
        expect(html, `${path} contains ${String(pattern)}`).not.toMatch(pattern);
      }
    }
  });

  test('every indexed page but the root is linked from at least two other indexed pages’ own content', async ({
    request,
  }) => {
    /*
     * The crawl rule WP-S3-16 holds the site to: no critical orphans. "Own content" is the
     * page's `<main>` minus its breadcrumb trail — the header, footer and crumbs link every
     * hub from every page, so counting them would make every hub look richly linked while
     * saying nothing about whether any page actually sends a reader there. The root is
     * exempt because its links are the wordmark and the crumbs by design.
     */
    const { paths } = await readSitemap(request);
    const indexed = new Set(paths);
    const inbound = new Map<string, Set<string>>();
    for (const { path, html } of await fetchAll(request, paths)) {
      const own = mainOf(html).replace(
        /<nav\b[^>]*aria-label="현재 위치"[^>]*>[\s\S]*?<\/nav>/u,
        '',
      );
      for (const [, href] of own.matchAll(ANCHOR_HREF)) {
        const target = (href ?? '').split(/[?#]/u)[0] ?? '';
        if (target === path || !indexed.has(target)) continue;
        (inbound.get(target) ?? inbound.set(target, new Set()).get(target))?.add(path);
      }
    }
    const orphans = paths
      .filter((path) => path !== koPath('/'))
      .filter((path) => (inbound.get(path)?.size ?? 0) < 2);
    expect(orphans, 'indexed pages with fewer than two contextual inbound links').toEqual([]);
  });
});
