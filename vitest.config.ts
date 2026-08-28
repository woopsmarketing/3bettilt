import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

const WORKSPACE_PACKAGES = [
  'shared',
  'poker-core',
  'gto-core',
  'player-core',
  'db',
  'coinpoker-parser',
] as const;

/**
 * Resolve `@gto-self/<pkg>` and `@gto-self/<pkg>/<subpath>` straight to TypeScript
 * source so tests never depend on a build step. Subpath rule must come first.
 */
export const workspaceAlias = WORKSPACE_PACKAGES.flatMap((name) => [
  {
    find: new RegExp(`^@gto-self/${name}/(.*)$`),
    replacement: `${root}packages/${name}/src/$1`,
  },
  {
    find: new RegExp(`^@gto-self/${name}$`),
    replacement: `${root}packages/${name}/src/index.ts`,
  },
]);

const nodeProject = (name: string) => ({
  resolve: { alias: workspaceAlias },
  test: {
    name,
    root: `${root}packages/${name}`,
    environment: 'node' as const,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});

export default defineConfig({
  resolve: { alias: workspaceAlias },
  test: {
    projects: [
      nodeProject('shared'),
      nodeProject('poker-core'),
      nodeProject('gto-core'),
      nodeProject('player-core'),
      nodeProject('db'),
      nodeProject('coinpoker-parser'),
      {
        resolve: { alias: workspaceAlias },
        test: {
          name: 'web',
          root: `${root}apps/web`,
          environment: 'happy-dom',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts'],
    },
  },
});
