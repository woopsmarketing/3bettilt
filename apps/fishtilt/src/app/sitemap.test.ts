/**
 * @vitest-environment node
 *
 * Node, not happy-dom, for the reason `theme-tokens.test.ts` gives: this file resolves paths
 * off `import.meta.url`, which happy-dom makes an `http:` URL that `fileURLToPath` rejects.
 *
 * ---------------------------------------------------------------------------------------
 *
 * `src/lib/seo/site.ts` falls back to the production origin when `NEXT_PUBLIC_SITE_URL` is
 * unset (D-S3-05) and exports `SITE_ORIGIN_IS_DEFAULT` so the build log can say which origin
 * it used. Stage 2's version of this flag (`SITE_ORIGIN_IS_PLACEHOLDER`) was found exported
 * and read by nobody; these tests pin the connection rather than the wording of the notice.
 * A future WP is free to move the notice or rephrase it; it is not free to leave the flag
 * dangling again.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('..', import.meta.url));

/** Every shipped (non-test) `.ts`/`.tsx` under `src/`, as [path relative to `src/`, source]. */
const SOURCES: readonly (readonly [string, string])[] = (function walk(
  dir: string,
  prefix: string,
): (readonly [string, string])[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) return walk(join(dir, entry.name), rel);
    if (!/\.tsx?$/u.test(entry.name) || entry.name.includes('.test.')) return [];
    return [[rel, readFileSync(join(dir, entry.name), 'utf8')] as const];
  });
})(SRC_DIR, '');

/** Where the flag is DECLARED and re-exported. A mention in either is not a use of it. */
const DECLARATION_SITES = new Set(['lib/seo/site.ts', 'lib/seo/index.ts']);

describe('the default-origin flag is wired to something', () => {
  it('is read somewhere outside its own module and the barrel', () => {
    /*
     * Imports AND comments stripped first, because naming the flag is not reading it and both
     * of those name it without using it. Two earlier versions of this test proved the point:
     * deleting the whole warning block from `sitemap.ts` left the guard green first because
     * the import survived, and then again because the comment that EXPLAINS the warning
     * survived — a test kept passing by the prose describing the code it was checking for.
     */
    const readers = SOURCES.filter(([rel, source]) => {
      if (DECLARATION_SITES.has(rel)) return false;
      const body = source
        .replace(/\/\*[\s\S]*?\*\//gu, '')
        .replace(/^\s*\/\/.*$/gmu, '')
        .replace(/^\s*import[\s\S]*?;\s*$/gmu, '');
      return body.includes('SITE_ORIGIN_IS_DEFAULT');
    }).map(([rel]) => rel);

    expect(
      readers,
      'SITE_ORIGIN_IS_DEFAULT exists so that a build with NEXT_PUBLIC_SITE_URL unset says\n' +
        'so. Exported and unread, it is a safety valve wired to nothing — which is how the\n' +
        'Stage-2 review found its predecessor. Consume it somewhere, or delete it.',
    ).not.toEqual([]);
  });

  it('says so from the sitemap, which is built once and carries the origin off this machine', () => {
    /*
     * WHY THIS ROUTE AND NOT A MODULE-SCOPE NOTICE IN `site.ts`: `site.ts` is imported by
     * every page, so a notice there fires on every render and in every unit test, which is
     * how a notice becomes noise nobody reads. `sitemap.ts` is prerendered exactly once per
     * build — and the sitemap is the artifact that actually hands the origin to a search
     * engine. One `console.info` line (D-S3-05): the production default is the right origin
     * for a production build, so this is information, not a warning storm.
     */
    const sitemap = SOURCES.find(([rel]) => rel === 'app/sitemap.ts');
    expect(sitemap, 'src/app/sitemap.ts is gone').toBeDefined();
    const source = sitemap?.[1] ?? '';

    expect(source).toContain('SITE_ORIGIN_IS_DEFAULT');
    expect(source, 'the notice has to reach a human, so it goes to the build log').toMatch(
      /console\.info/u,
    );
    expect(source, 'a default that is correct for production is not a warning').not.toMatch(
      /console\.(warn|error)/u,
    );
    expect(
      source,
      'name the variable in the message — a warning that does not say what to set is a\n' +
        'warning the reader has to go and research',
    ).toContain('NEXT_PUBLIC_SITE_URL');
  });

  it('does not throw when the variable is unset — the default IS the production origin', () => {
    /*
     * D-S3-05: an unset variable means the production origin, which is correct. What throws
     * is a variable that is SET to something unusable (a path, a non-http scheme), and that
     * happens in `site.ts` at module load, not here.
     */
    const source = SOURCES.find(([rel]) => rel === 'app/sitemap.ts')?.[1] ?? '';
    const guardBlock = source.slice(source.indexOf('SITE_ORIGIN_IS_DEFAULT'));
    expect(guardBlock).not.toMatch(/\bthrow\b|process\.exit/u);
  });
});
