/**
 * A STATIC tripwire for the WP-J design contract §1: the composition layer must stay a
 * composition layer.
 *
 * `adaptive-core` is the one package allowed to hold `strategy-core` and `player-core` at
 * the same time. That privilege is exactly why its OTHER bans need a guard that does not
 * depend on the lint config staying correct: the moment this package can reach `poker-core`
 * or `@gto-self/db`, the invariant it exists to protect — `computeStrategy(state, heroSeat)`
 * is byte-identical whatever the player data is — stops being structural, because ADAPTIVE
 * could recompute the baseline instead of receiving it as a finished value. `analysis-core`
 * is banned for ADR-0061's reason: learned-model numbers arrive as the neutral
 * `AdaptiveStatObservation[]` DTO, built in `apps/web/src/server/`, and no event-log or
 * persistence knowledge belongs in here.
 *
 * This file is a deliberate copy of `packages/strategy-core/tests/layering.test.ts`,
 * retargeted. It reads the source as TEXT and never imports it. An import-graph check that
 * loaded the modules would pass happily on an `import type` line, and a type-only import is
 * exactly how a forbidden dependency would arrive first.
 *
 * ESLint's `no-restricted-imports` layering rules cover the same ground and were confirmed
 * to fire; this is deliberately a SECOND, independent guard that runs in `pnpm test`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PACKAGES_DIR = fileURLToPath(new URL('../..', import.meta.url));

/** The package this file guards. */
const GUARDED = ['adaptive-core'] as const;

/**
 * Package names that must not appear in any specifier, as themselves or as a subpath.
 *
 * `@gto-self/strategy-core` and `@gto-self/player-core` are deliberately ABSENT: importing
 * both is this package's entire job.
 */
const FORBIDDEN = [
  '@gto-self/db',
  '@gto-self/analysis-core',
  '@gto-self/poker-core',
  '@gto-self/gto-core',
  '@gto-self/coinpoker-parser',
  'solver-lab',
  'react',
  // `react-dom` is named separately because `references` matches a package and its subpaths
  // only, never a sibling that merely shares a prefix. That narrowness is deliberate — it is
  // what keeps `next-safe-action` from tripping the `next` ban (pinned below) — so a real
  // sibling package has to be listed rather than inferred (review R1, NIT 13).
  'react-dom',
  'next',
] as const;

/**
 * Every `.ts` file the package compiles: `src/**`, `tests/**`, and root-level `*.ts`, matching
 * `tsconfig.json`'s own `include`.
 */
function compiledFiles(root: string): readonly string[] {
  const rootLevel = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => join(root, entry.name));
  const all = [
    ...sourceFiles(join(root, 'src')),
    ...sourceFiles(join(root, 'tests')),
    ...rootLevel,
  ];
  // THIS file is the one exclusion, and it is not a loophole: the forbidden specifiers in it
  // are quoted SAMPLE TEXT for the scanner's own self-test, not imports. Excluding it by exact
  // path rather than by a pattern keeps the exemption to one named file — a second
  // `*.layering.test.ts` would still be scanned.
  return all.filter((file) => file !== fileURLToPath(import.meta.url));
}

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

describe.each(GUARDED)('%s must stay a composition layer', (pkg) => {
  const root = join(PACKAGES_DIR, pkg);

  it('names no forbidden package in any source specifier', () => {
    const offences: string[] = [];
    // EVERY `.ts` the package compiles, not just `src/`. `tsconfig.json` also takes
    // `tests/**/*.ts` and root-level files, so scanning `src/` alone left the guard's own
    // directory unguarded — a forbidden import in a test file would have been invisible here
    // (review R1, NIT 12). ESLint covers them; this file is the second, independent guard, and
    // a second guard that checks less than the first is not one.
    const files = compiledFiles(root);
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

  it('still imports the two packages it is supposed to compose', () => {
    // Without this the suite above could be satisfied by a package that imports nothing at
    // all, which is not a composition layer — it is an empty one.
    const specifiers = sourceFiles(join(root, 'src')).flatMap((file) =>
      specifiersIn(readFileSync(file, 'utf8')),
    );
    expect(specifiers).toContain('@gto-self/strategy-core');
    expect(specifiers).toContain('@gto-self/player-core');
  });
});

describe('the specifier scanner itself', () => {
  // Without this the suite above could pass because the regex stopped matching, not because
  // the imports are absent.
  it('finds the forms a forbidden import could arrive in', () => {
    const sample = [
      `import { a } from '@gto-self/poker-core';`,
      `import type { B } from "@gto-self/analysis-core";`,
      `export * from '@gto-self/db';`,
      `export { c } from '@gto-self/db/repositories/hands.js';`,
      `import '@gto-self/gto-core';`,
      `const d = await import('@gto-self/analysis-core');`,
      `import { keep } from './local.js';`,
    ].join('\n');
    expect(specifiersIn(sample)).toEqual([
      '@gto-self/poker-core',
      '@gto-self/analysis-core',
      '@gto-self/db',
      '@gto-self/db/repositories/hands.js',
      '@gto-self/gto-core',
      '@gto-self/analysis-core',
      './local.js',
    ]);
  });

  it('does not mistake a longer package name for a forbidden one', () => {
    expect(references('@gto-self/dbx', '@gto-self/db')).toBe(false);
    expect(references('@gto-self/db/client.js', '@gto-self/db')).toBe(true);
    // The React ban must not swallow the two packages this layer is built to compose.
    expect(references('@gto-self/strategy-core', 'react')).toBe(false);
    expect(references('next-safe-action', 'next')).toBe(false);
    expect(references('next/navigation', 'next')).toBe(true);
  });
});
