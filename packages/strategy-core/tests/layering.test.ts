/**
 * A STATIC tripwire for `prompt` §39 / ADR-0061: the strategy engine must not learn about
 * players.
 *
 * This exists because the behavioural acceptance test
 * (`apps/web/src/server/analysis-strategy-unaffected.test.ts`) cannot fail while
 * `computeStrategy`'s signature holds — it is a pure function of its arguments, so
 * "strategy is unchanged by an analysis run" is structurally guaranteed rather than
 * observed (review R1/M1). That test still pins the behaviour, and it should; but the
 * property it names could only ever break by someone WIRING player data in, and this file
 * is the check that fails when they do.
 *
 * It reads the source as TEXT and never imports it. An import-graph check that loads the
 * modules would pass happily on a `import type` line, and a type-only import is exactly how
 * a player-model parameter would arrive first.
 *
 * ESLint's `no-restricted-imports` layering rules cover the same ground and were confirmed
 * to fire; this is deliberately a SECOND, independent guard that runs in `pnpm test` and
 * does not depend on the lint config staying correct.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PACKAGES_DIR = fileURLToPath(new URL('../..', import.meta.url));

/**
 * The packages whose sources may not know about players. `strategy-core` is §39's subject;
 * `gto-core` is held to the same rule by `CLAUDE.md`'s layering section ("`gto-core` must not
 * import `player-core` — player statistics must never influence baseline solution data").
 */
const GUARDED = ['strategy-core', 'gto-core'] as const;

/** Package names that must not appear in any specifier, as themselves or as a subpath. */
const FORBIDDEN = ['@gto-self/player-core', '@gto-self/analysis-core', '@gto-self/db'] as const;

/** Every `.ts` file under a directory, recursively. */
function sourceFiles(dir: string): readonly string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(path));
    else if (entry.name.endsWith('.ts')) found.push(path);
  }
  return found;
}

/**
 * Every module specifier one file names: `from '…'` (import AND re-export, value and
 * type-only alike), a bare side-effect `import '…'`, and a dynamic `import('…')`.
 */
const SPECIFIER =
  /(?:\bfrom\s*|(?:^|[;{}\s])import\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/gu;

function specifiersIn(source: string): readonly string[] {
  const found: string[] = [];
  for (const match of source.matchAll(SPECIFIER)) {
    if (match[1] !== undefined) found.push(match[1]);
  }
  return found;
}

/** `@gto-self/db` and `@gto-self/db/anything`, but never `@gto-self/dbx`. */
const references = (specifier: string, pkg: string): boolean =>
  specifier === pkg || specifier.startsWith(`${pkg}/`);

describe.each(GUARDED)('%s must not reference player data', (pkg) => {
  const root = join(PACKAGES_DIR, pkg);

  it('names no forbidden package in any source specifier', () => {
    const offences: string[] = [];
    const files = sourceFiles(join(root, 'src'));
    // A guard over an empty file list would pass vacuously — the failure mode this whole
    // file exists to avoid.
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const specifier of specifiersIn(source)) {
        for (const forbidden of FORBIDDEN) {
          if (references(specifier, forbidden)) {
            offences.push(`${file.slice(PACKAGES_DIR.length)}: ${specifier}`);
          }
        }
      }
    }
    expect(offences).toEqual([]);
  });

  it('declares no forbidden package as a dependency', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      readonly dependencies?: Readonly<Record<string, string>>;
      readonly devDependencies?: Readonly<Record<string, string>>;
      readonly peerDependencies?: Readonly<Record<string, string>>;
    };
    const declared = [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
    ];
    expect(declared.filter((name) => FORBIDDEN.some((f) => references(name, f)))).toEqual([]);
  });
});

describe('the specifier scanner itself', () => {
  // Without this the suite above could pass because the regex stopped matching, not because
  // the imports are absent.
  it('finds the forms a forbidden import could arrive in', () => {
    const sample = [
      `import { a } from '@gto-self/player-core';`,
      `import type { B } from "@gto-self/analysis-core";`,
      `export * from '@gto-self/db';`,
      `export { c } from '@gto-self/db/repositories/hands.js';`,
      `import '@gto-self/player-core';`,
      `const d = await import('@gto-self/analysis-core');`,
      `import { keep } from './local.js';`,
    ].join('\n');
    expect(specifiersIn(sample)).toEqual([
      '@gto-self/player-core',
      '@gto-self/analysis-core',
      '@gto-self/db',
      '@gto-self/db/repositories/hands.js',
      '@gto-self/player-core',
      '@gto-self/analysis-core',
      './local.js',
    ]);
  });

  it('does not mistake a longer package name for a forbidden one', () => {
    expect(references('@gto-self/dbx', '@gto-self/db')).toBe(false);
    expect(references('@gto-self/db/client.js', '@gto-self/db')).toBe(true);
  });
});
