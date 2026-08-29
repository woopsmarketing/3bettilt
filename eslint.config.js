import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

/** Domain and persistence code is never presentation. */
const NO_UI = {
  group: ['react', 'react/*', 'react-dom', 'react-dom/*', 'next', 'next/*'],
  message: 'This layer must not depend on React or Next.js.',
};

/** The domain is authoritative; the DB is persistence. The arrow never reverses. */
const NO_DB = {
  group: ['@gto-self/db', '@gto-self/db/*'],
  message: 'Domain packages must not depend on persistence.',
};

/** `solver-lab` is a research sandbox and is never shipped (ADR-0013). */
const NO_SOLVER_LAB = {
  group: ['*solver-lab*'],
  message: 'solver-lab is a research sandbox and is never imported by the product (ADR-0013).',
};

const restrict = (patterns) => ['error', { patterns }];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/drizzle/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { ecmaVersion: 2023, sourceType: 'module' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  // Layering (CLAUDE.md rule 4, ADR-0006, ADR-0021, ADR-0023).
  //
  // Two things about how these are written, both of which are load-bearing:
  //
  // 1. They use `patterns`, not `paths`. `paths` matches the exact module specifier
  //    only, and every workspace package declares a `"./*"` export, so
  //    `@gto-self/db/client.js` sails straight past a `paths` entry for `@gto-self/db`.
  //    A layering rule with a hole in it is worse than no rule, because the docs then
  //    claim an enforcement that does not exist.
  //
  // 2. Every block spells out its FULL pattern list, including the shared bans. Flat
  //    config resolves a rule by last-match-wins, not by merging: a later broad block
  //    matching the same file would REPLACE a narrower block's patterns rather than add
  //    to them. So the bans are composed here in JavaScript, before ESLint sees them.
  {
    files: ['packages/poker-core/**/*.ts'],
    rules: {
      // The poker engine knows nothing but poker (ADR-0021): no React, no DOM, no
      // persistence, and no strategy or player-tendency logic.
      'no-restricted-imports': restrict([
        NO_UI,
        NO_DB,
        NO_SOLVER_LAB,
        {
          group: ['@gto-self/gto-core', '@gto-self/gto-core/*'],
          message: 'poker-core must not know about GTO, CFR or strategy policy (ADR-0021).',
        },
        {
          group: ['@gto-self/player-core', '@gto-self/player-core/*'],
          message: 'poker-core must not know about player tendencies (ADR-0021).',
        },
      ]),
    },
  },
  {
    files: ['packages/gto-core/**/*.ts'],
    rules: {
      // The GTO engine knows nothing about individual players, and never reaches for
      // persistence or the UI.
      'no-restricted-imports': restrict([
        NO_UI,
        NO_DB,
        NO_SOLVER_LAB,
        {
          group: ['@gto-self/player-core', '@gto-self/player-core/*'],
          message:
            'GTO baseline data must never be influenced by individual player statistics (ADR-0021).',
        },
      ]),
    },
  },
  {
    files: ['packages/player-core/**/*.ts'],
    rules: {
      // Player data is our own: manual nicknames, manual HUD snapshots and our own
      // observations. It never reaches for persistence, the UI, the poker engine or the
      // GTO baseline.
      'no-restricted-imports': restrict([
        NO_UI,
        NO_DB,
        NO_SOLVER_LAB,
        {
          group: ['@gto-self/poker-core', '@gto-self/poker-core/*'],
          message: 'player-core is a leaf on shared; the app maps at its boundary (ADR-0021).',
        },
        {
          group: ['@gto-self/gto-core', '@gto-self/gto-core/*'],
          message:
            'Composing player data with the GTO baseline belongs in strategy-policy (ADR-0023).',
        },
      ]),
    },
  },
  {
    files: ['packages/shared/**/*.ts'],
    rules: {
      // `shared` is the root of the graph and depends on no workspace package.
      'no-restricted-imports': restrict([
        NO_UI,
        NO_SOLVER_LAB,
        {
          group: ['@gto-self/*'],
          message: 'shared is the root of the dependency graph and imports no workspace package.',
        },
      ]),
    },
  },
  {
    files: ['packages/db/**/*.ts'],
    rules: {
      // Persistence may import the domain packages — that is the direction the layering
      // allows — but it is storage, not presentation.
      'no-restricted-imports': restrict([NO_UI, NO_SOLVER_LAB]),
    },
  },
  {
    files: ['packages/coinpoker-parser/**/*.ts'],
    rules: {
      // The parser turns hand-history text into domain events. It sits downstream of
      // poker-core and knows nothing about persistence, the UI, GTO data or players.
      'no-restricted-imports': restrict([
        NO_UI,
        NO_DB,
        NO_SOLVER_LAB,
        {
          group: [
            '@gto-self/gto-core',
            '@gto-self/gto-core/*',
            '@gto-self/player-core',
            '@gto-self/player-core/*',
          ],
          message: 'The parser produces poker events; it knows nothing about GTO or players.',
        },
      ]),
    },
  },
  {
    files: ['solver-lab/**/*.ts'],
    rules: {
      // The research sandbox depends on `shared` alone and is never shipped (ADR-0013).
      'no-restricted-imports': restrict([
        NO_UI,
        NO_DB,
        {
          group: [
            '@gto-self/poker-core',
            '@gto-self/poker-core/*',
            '@gto-self/gto-core',
            '@gto-self/gto-core/*',
            '@gto-self/player-core',
            '@gto-self/player-core/*',
            '@gto-self/coinpoker-parser',
            '@gto-self/coinpoker-parser/*',
          ],
          message: 'solver-lab depends on `shared` alone (ADR-0013).',
        },
      ]),
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // The app may import everything the layering allows — except the research sandbox.
      'no-restricted-imports': restrict([NO_SOLVER_LAB]),
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'solver-lab/**/*.ts', 'scripts/**/*.mjs'],
    rules: { 'no-console': 'off', '@typescript-eslint/no-explicit-any': 'off' },
  },
);
