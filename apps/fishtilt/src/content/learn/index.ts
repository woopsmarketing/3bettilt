/**
 * Slug -> compiled MDX component, for `/learn/[slug]`.
 *
 * ## Why a static map rather than a dynamic import
 *
 * `import('../../content/learn/' + slug + '.mdx')` would be shorter and is the wrong shape
 * for a site whose entire premise is that every page prerenders to static HTML: a specifier
 * the bundler cannot see is a specifier it cannot prerender. Naming each file makes the
 * import graph complete at build time and turns a slug that has no file into a TYPE error
 * here rather than a 500 at request time.
 *
 * ## Why this module is separate from `registry/`
 *
 * Nothing that imports the registry can be allowed to pull an `.mdx` file in with it: the
 * graph tests run under Vitest, which has no MDX pipeline. Keeping the compiled prose behind
 * this barrel — imported by the route and by nothing else — is what lets `graph.ts`,
 * `threshold.ts` and every content test stay plain TypeScript.
 *
 * ## Why this is a directory of per-batch files, not one `lessons.ts`
 *
 * WP-G2 split the single `LESSON_MDX` map (which used to live at `content/lessons.ts`) into
 * one file per authoring batch — `h1.ts`, `h2.ts`, `h3.ts`, plus `published.ts` for lesson
 * 06, which no batch owns — for exactly the reason `registry/learn/index.ts` was split:
 * three lesson agents writing the SAME map file would have to run serially. A batch adds a
 * line to its own file per lesson it writes, alongside flipping that record's `status` to
 * `PUBLISHED` in the matching registry file. `content.test.ts` checks the two agree with
 * what is on disk.
 */
import type { LessonComponent } from './published.js';
import { LEARN_H1_MDX } from './h1.js';
import { LEARN_H2_MDX } from './h2.js';
import { LEARN_H3_MDX } from './h3.js';
import { LEARN_PUBLISHED_MDX } from './published.js';

export type { LessonComponent } from './published.js';

export const LESSON_MDX: Readonly<Record<string, LessonComponent>> = {
  ...LEARN_PUBLISHED_MDX,
  ...LEARN_H1_MDX,
  ...LEARN_H2_MDX,
  ...LEARN_H3_MDX,
};

/** `undefined` for a slug with no prose yet — the route treats that as a 404. */
export function lessonComponent(slug: string): LessonComponent | undefined {
  return LESSON_MDX[slug];
}
