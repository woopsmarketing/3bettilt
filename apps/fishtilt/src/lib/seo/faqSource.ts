/**
 * The one impure half of FAQ extraction: reading the MDX file `extractFaqItems` parses.
 *
 * Split from `faq.ts` so the parsing rules stay a pure function testable against fixture
 * strings, per `docs/FISHTILT_STATE.md` ruling 26 — a test for "what counts as a FAQ" must
 * construct the shapes it asserts about, not go looking for a page that happens to have one
 * today.
 *
 * ## When this runs
 *
 * At BUILD time only. Every content route sets `dynamicParams = false` with
 * `generateStaticParams()`, so `pnpm build:fishtilt` prerenders all of them and nothing
 * reaches this at request time (`docs/FISHTILT_STATE.md` ruling 37 documents the same
 * property for MDX compilation).
 *
 * ## Locating `content/`
 *
 * `pnpm build:fishtilt` is `pnpm --filter @gto-self/fishtilt build`, which runs with the
 * package directory as `process.cwd()`, and so do `next dev`, `next start` and Vitest's
 * `fishtilt` project. `apps/fishtilt/content` is therefore `process.cwd()/content` in every
 * invocation this repository actually uses. The monorepo-root candidate is a cheap safety
 * net for an invocation nobody has written yet: a wrong root would not fail anything, it
 * would silently drop the FAQ markup from twenty pages, which is exactly the kind of
 * failure that is discovered months later in a search console.
 *
 * ## Failure is silence, never a guess
 *
 * A missing or unreadable file yields `[]`, which yields no `FAQPage` markup. The cost of
 * that is one page without one optional rich-result type; the cost of the alternative —
 * emitting a remembered or approximated list — is markup that claims content the page does
 * not show.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContentKind } from '../../content/types.js';
import { extractFaqItems, type FaqItem } from './faq.js';

/** Registry slugs are Latin lower-kebab (`types.ts`); anything else is not a slug. */
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/**
 * The directory holding `learn/`, `blog/`, `glossary/` and `hands/` MDX, or `null` when it
 * cannot be found from the current working directory. Exported so a test can assert that
 * the resolution works rather than discovering it silently did not.
 */
export function resolveContentRoot(cwd: string = process.cwd()): string | null {
  const candidates = [join(cwd, 'content'), join(cwd, 'apps', 'fishtilt', 'content')];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export function readFaqItems(kind: ContentKind, slug: string): readonly FaqItem[] {
  if (!SAFE_SLUG.test(slug)) return [];
  const root = resolveContentRoot();
  if (root === null) return [];
  try {
    return extractFaqItems(readFileSync(join(root, kind, `${slug}.mdx`), 'utf8'));
  } catch {
    return [];
  }
}
