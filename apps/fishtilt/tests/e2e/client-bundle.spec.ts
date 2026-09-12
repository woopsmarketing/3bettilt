import { expect, test, type Page } from '@playwright/test';
import { koPath } from './helpers.js';

/*
 * The client-JavaScript budget (WP-O3).
 *
 * WP-O3 found 288KB of `zod` — the whole library plus its full locale set — in the client
 * bundle of every article, tool, quiz and home page. Nothing imported it: it arrived through
 * `@gto-self/poker-core`'s barrel (`export * from './serialization.js'`), which
 * `@gto-self/strategy-core`'s adapter seam re-exports, and Turbopack kept it because no
 * package in that chain declared itself side-effect free. Declaring it removed the whole
 * 288KB (`docs/reports/WP_O3_PERFORMANCE.md` §9).
 *
 * That regression was invisible: the build printed no size column, every test passed, and
 * the page looked identical. So these are RULES, not a snapshot of today's numbers.
 *
 *   1. No client chunk may contain a schema-validation library. `zod` has no job in a
 *      browser on this site — every number 3BetTilt shows is computed, not parsed — so its
 *      presence always means a server-only dependency has leaked back through a barrel.
 *   2. Each class of route stays under a ceiling generously above what it ships today, so
 *      normal drift is free and another library-sized arrival is not.
 *
 * Bytes are DECODED bytes of every `.js` a route actually loads (transfer size depends on
 * the host's compression, which is not this app's to promise). The polyfill bundle is
 * excluded by the browser itself — a modern engine never requests it — so these are the
 * numbers a real visitor's browser parses.
 */

/** Decoded bytes of every `.js` the given route loads, and the URLs they came from. */
async function clientJavaScript(page: Page, route: string) {
  const bodies = new Map<string, Buffer>();
  const settled: Promise<void>[] = [];
  page.on('response', (response) => {
    const url = response.url();
    if (!url.endsWith('.js')) return;
    settled.push(
      response
        .body()
        .then((body) => {
          bodies.set(url, body);
        })
        .catch(() => undefined),
    );
  });
  await page.goto(route, { waitUntil: 'networkidle' });
  await Promise.all(settled);
  let bytes = 0;
  for (const body of bodies.values()) bytes += body.length;
  return { bytes, bodies };
}

/*
 * Ceilings, in KB of decoded JavaScript. Each is comfortably above the measured figure at
 * the time of writing (in brackets) — enough that refactoring, a new component or a bigger
 * article costs nothing, and not enough to hide another library arriving by accident.
 */
const BUDGET_KB: readonly (readonly [string, number, string])[] = [
  [koPath('/about'), 560, 'a page with no interactive island at all [448KB]'],
  [koPath('/learn/holdem-basics'), 660, 'a lesson: prose plus the MDX widget islands [532KB]'],
  [koPath('/blog/aks-vs-ako'), 660, 'a blog article [532KB]'],
  [koPath('/glossary/position'), 660, 'a glossary term [532KB]'],
  [koPath('/hands/aks'), 660, 'a hand page [532KB]'],
  [koPath('/tools/range'), 670, 'the Range Explorer, the heaviest tool [542KB]'],
  [koPath('/tools/equity'), 690, 'the equity calculator, engine on both the page and its worker [552KB]'],
  [koPath('/search'), 650, 'the search index, shipped whole to this one route [521KB]'],
  [koPath('/practice/range-quiz'), 750, 'a quiz: the matrix, the quiz engine and the range data [607KB]'],
];

test.describe('client JavaScript budget', () => {
  for (const [route, budgetKb, why] of BUDGET_KB) {
    test(`${route} stays under ${budgetKb}KB of client JS — ${why}`, async ({ page }) => {
      const { bytes } = await clientJavaScript(page, route);
      expect(bytes).toBeGreaterThan(0);
      expect(bytes / 1024).toBeLessThan(budgetKb);
    });
  }

  test('no client chunk ships a schema-validation library', async ({ page }) => {
    // One article page and one tool page: between them they load every shared chunk that
    // the barrel chain could have dragged `zod` into.
    for (const route of [koPath('/learn/holdem-basics'), koPath('/tools/equity')]) {
      const { bodies } = await clientJavaScript(page, route);
      for (const [url, body] of bodies) {
        const source = body.toString('utf8');
        expect(source, `${url} (loaded by ${route}) contains zod`).not.toContain('$ZodError');
        expect(source, `${url} (loaded by ${route}) contains zod`).not.toContain('toJSONSchema');
      }
    }
  });
});
