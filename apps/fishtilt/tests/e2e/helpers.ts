import type { Page } from '@playwright/test';
import { DEFAULT_LOCALE, localePath } from '../../src/lib/locale.js';

/**
 * Next.js inlines the full RSC hydration payload as `<script>` text for hydration, which
 * duplicates every word of a page's rendered copy (`docs/FISHTILT_STATE.md` ruling 41,
 * found while fixing `hands.spec.ts`'s profitability-disclaimer test). `page.locator('body')`
 * and `Element.textContent` both walk into those `<script>` text nodes, so a whole-body text
 * assertion that does not strip them first is checking the payload as well as the visible
 * page: a "this phrase is absent" assertion is unreliable (it can false-fail on the payload's
 * copy of otherwise-legitimate content), and a "this phrase is present" assertion is weaker
 * than it looks (it can pass on the payload alone while the visible page renders nothing).
 *
 * Every e2e spec's whole-body checks go through this rather than `page.locator('body')`
 * directly, so there is exactly one place that knows to strip the payload.
 */
export async function visibleBodyText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    for (const script of Array.from(clone.querySelectorAll('script'))) {
      script.remove();
    }
    return clone.textContent ?? '';
  });
}

/**
 * The accessible name of a position control, matched by SHAPE rather than by restating the
 * Korean in every spec: `features/range/copy.ts`'s `positionAccessibleName` renders
 * `"언더더건(UTG) 자리"` — the gloss, the abbreviation in brackets (ADR-0053 keeps it), then
 * `자리`. A spec that asserted the bare `UTG` would be asserting the very gap
 * `docs/FISHTILT_STATE.md` ruling 65 closed.
 */
export function positionButtonName(position: string): RegExp {
  return new RegExp(`\\(${position}\\) 자리$`, 'u');
}

/**
 * The accessible name of one 13x13 matrix cell: the key it displays, a space, the spoken
 * reading, and then whatever membership wording the caller is looking for. Matched by shape
 * for the same reason as above — `AKs` alone is what the name used to be.
 */
export function matrixCellName(key: string, membership = ''): RegExp {
  return new RegExp(`^${key} .+${membership}`, 'u');
}

/**
 * Stage 3 (D-S3-01/02): every page lives under a locale segment, `/ko/...`. A spec never
 * spells that prefix — it states the SITE path it means (`'/learn/pot-odds'`) and this
 * turns it into the URL a visitor actually loads, through the same `localePath` the app
 * builds every href from. `page.goto(koPath('/'))` is `/ko`; the bare `/` is the one
 * redirect and is asserted once, in `locale.spec.ts`.
 *
 * `localePath` keeps a query string, so `koPath('/tools/range?hero=BTN')` is the deep link.
 */
export function koPath(sitePath: string): string {
  return localePath(DEFAULT_LOCALE, sitePath);
}

/**
 * A `toHaveURL` matcher for the localised form of a site path, anchored at the end and
 * tolerant of a query string when `allowQuery` is set. Anchoring on the full localised path
 * (rather than on the bare `/about$`) is what makes `/xx/about` fail rather than pass.
 */
export function koUrl(sitePath: string, allowQuery = false): RegExp {
  const escaped = koPath(sitePath).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(allowQuery ? `${escaped}(?:\\?.*)?$` : `${escaped}$`, 'u');
}
