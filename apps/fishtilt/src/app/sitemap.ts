/**
 * `/sitemap.xml` (Next App Router file convention).
 *
 * Deliberately three lines: everything that decides WHAT is listed lives in
 * `src/lib/seo/sitemapEntries.ts` as a pure function over the route registry and the
 * content registry, so it can be tested without a build and cannot drift from the
 * `robots` meta tag each page emits — both read `src/lib/seo/policy.ts`.
 *
 * Static, like the rest of the site: the registries are compile-time data, so Next
 * prerenders this to a file at build time.
 */
import type { MetadataRoute } from 'next';
import { sitemapEntries, SITE_ORIGIN, SITE_ORIGIN_IS_DEFAULT } from '../lib/seo/index.js';

export const dynamic = 'force-static';

/*
 * The one line a build log gets about the origin (D-S3-05). The sitemap is prerendered
 * exactly once per build and is the artifact that carries the origin off this machine, so
 * this is where saying which origin was used is worth something — and it is `info`, not a
 * warning: the production default is the correct origin for a production build, and a
 * preview that wants another sets `NEXT_PUBLIC_SITE_URL`. A configured value that cannot
 * be used throws in `src/lib/seo/site.ts` before this runs.
 */
if (SITE_ORIGIN_IS_DEFAULT) {
  // eslint-disable-next-line no-console -- D-S3-05: one informational line in the build log.
  console.info(
    `[fishtilt] NEXT_PUBLIC_SITE_URL is not set — using production origin default ${SITE_ORIGIN}`,
  );
}

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries().map((entry) => ({
    url: entry.url,
    alternates: { languages: { ...entry.alternates.languages } },
  }));
}
