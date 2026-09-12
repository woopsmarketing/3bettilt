/**
 * Ambient type for `*.mdx` imports.
 *
 * `@types/mdx` ships exactly this declaration, but `apps/fishtilt/tsconfig.json` pins
 * `"types": ["node"]`, which switches OFF automatic inclusion of every other `@types/*`
 * package. Importing `mdx/types` by name still resolves (that is an explicit module
 * specifier); the package's GLOBAL declaration does not, so without this file every
 * `import Lesson from '../../content/learn/x.mdx'` is `TS2307`.
 *
 * Written out rather than pulled in with `/// <reference types="mdx" />` so the app states
 * the shape it depends on instead of inheriting whatever a transitive types package happens
 * to declare, and so this file stays a SCRIPT: a `declare module '*.mdx'` wildcard is only
 * legal at the top level of a non-module file, which is why the two types below are written
 * as inline `import(...)` types rather than as top-level imports.
 */
/* eslint-disable @typescript-eslint/consistent-type-imports --
 * The repo prefers top-level `import type`, and this is the one file where that is
 * impossible: a top-level import would make this a MODULE, and `declare module '*.mdx'` is
 * only legal at the top level of a script. Inline `import(...)` types are the sanctioned way
 * to reference a type from a global declaration file. */
declare module '*.mdx' {
  const MDXContent: (props: import('mdx/types').MDXProps) => import('react').ReactElement | null;
  export default MDXContent;
}
