/**
 * A static tripwire for FishTilt's layering
 * (`docs/reports/FISHTILT_00_AUDIT_AND_PLAN.md` §3 and §5.2).
 *
 * ESLint's `no-restricted-imports` blocks cover the same ground, and this is deliberately
 * a SECOND, independent guard: it runs in `pnpm test`, it does not depend on the lint
 * config staying correct, and — the reason the same pattern already exists in
 * `packages/strategy-core/tests/layering.test.ts` — it reads the source as TEXT rather
 * than importing it, so an `import type` line cannot slip past. A type-only import is
 * exactly how a forbidden dependency arrives first.
 *
 * What it protects: `learn-core` explains the game to a beginner. It reads `shared` and,
 * read-only, `strategy-core`. It must never reach the poker engine, persistence, the
 * opponent-modelling layers, the empty `gto-core` placeholder, or React.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

/** Specifiers that must not appear anywhere in this package, bare or as a subpath. */
const FORBIDDEN = [
  'react',
  'react-dom',
  'next',
  '@gto-self/db',
  '@gto-self/poker-core',
  '@gto-self/gto-core',
  '@gto-self/player-core',
  '@gto-self/analysis-core',
  '@gto-self/adaptive-core',
  '@gto-self/coinpoker-parser',
  'solver-lab',
] as const;

/** The complete set of workspace packages this one is allowed to name. */
const ALLOWED_WORKSPACE = ['@gto-self/shared', '@gto-self/strategy-core'] as const;

function sourceFiles(dir: string): readonly string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(path));
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) found.push(path);
  }
  return found;
}

/** Every module specifier a file names, including type-only and dynamic forms. */
const SPECIFIER =
  /(?:\bfrom\s*|(?:^|[;{}\s])import\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/gu;

function specifiersOf(path: string): readonly string[] {
  const text = readFileSync(path, 'utf8');
  return [...text.matchAll(SPECIFIER)].map(([, specifier]) => specifier ?? '');
}

/** `@gto-self/db` and `@gto-self/db/client.js` are the same violation. */
const names = (specifier: string, forbidden: string): boolean =>
  specifier === forbidden || specifier.startsWith(`${forbidden}/`);

describe('learn-core layering', () => {
  it('has sources to check', () => {
    expect(sourceFiles(SRC).length).toBeGreaterThan(0);
  });

  it('never names a forbidden package', () => {
    const violations: string[] = [];
    for (const file of sourceFiles(SRC)) {
      for (const specifier of specifiersOf(file)) {
        for (const forbidden of FORBIDDEN) {
          if (names(specifier, forbidden)) violations.push(`${file}: ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('names no workspace package outside its allowed set', () => {
    const unexpected: string[] = [];
    for (const file of sourceFiles(SRC)) {
      for (const specifier of specifiersOf(file)) {
        if (!specifier.startsWith('@gto-self/')) continue;
        if (ALLOWED_WORKSPACE.some((allowed) => names(specifier, allowed))) continue;
        unexpected.push(`${file}: ${specifier}`);
      }
    }
    expect(unexpected).toEqual([]);
  });
});
