/**
 * @vitest-environment node
 *
 * Node, not the project's happy-dom default: this file reads the app's source off disk,
 * and under happy-dom `import.meta.url` is an `http:` URL that `fileURLToPath` rejects.
 * Nothing here touches the DOM.
 */
/**
 * A static tripwire for the 3BetTilt app's layering
 * (`docs/reports/FISHTILT_00_AUDIT_AND_PLAN.md` §3 and §5.6).
 *
 * Same reasoning as `packages/learn-core/tests/layering.test.ts`: an independent second
 * guard that reads source as TEXT, so a type-only import cannot slip past, and that keeps
 * running even if the ESLint config drifts.
 *
 * The ban that matters most here is `@gto-self/db`. `apps/web` is allowed to reach it from
 * `src/server/` because that app has a database; 3BetTilt does not have one at all — no
 * login, no session, no stored hand (build spec §50) — so there is no directory here from
 * which importing it would be correct. The others keep the public site free of the poker
 * engine, opponent modelling, solved-data placeholders and hand-history parsing.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

const FORBIDDEN = [
  '@gto-self/db',
  '@gto-self/poker-core',
  '@gto-self/gto-core',
  '@gto-self/player-core',
  '@gto-self/analysis-core',
  '@gto-self/adaptive-core',
  '@gto-self/coinpoker-parser',
  'solver-lab',
] as const;

/** The complete set of workspace packages the app is allowed to name. */
const ALLOWED_WORKSPACE = [
  '@gto-self/shared',
  '@gto-self/strategy-core',
  '@gto-self/learn-core',
] as const;

function sourceFiles(dir: string): readonly string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(path));
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) found.push(path);
  }
  return found;
}

const SPECIFIER =
  /(?:\bfrom\s*|(?:^|[;{}\s])import\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/gu;

function specifiersOf(path: string): readonly string[] {
  const text = readFileSync(path, 'utf8');
  return [...text.matchAll(SPECIFIER)].map(([, specifier]) => specifier ?? '');
}

const names = (specifier: string, forbidden: string): boolean =>
  specifier === forbidden || specifier.startsWith(`${forbidden}/`);

describe('3BetTilt app layering', () => {
  it('has sources to check', () => {
    expect(sourceFiles(SRC).length).toBeGreaterThan(0);
  });

  it('never names a forbidden package — @gto-self/db above all', () => {
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
