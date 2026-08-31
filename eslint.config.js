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

/**
 * `analysis-core` is the event-log -> player-observation interpreter (ADR-0061). Only
 * `apps/web` composes it; no package imports it, including the two it itself reads. A
 * package that imported it would be reaching for player-tendency data from inside a layer
 * that must not have any.
 */
const NO_ANALYSIS_CORE = {
  group: ['@gto-self/analysis-core', '@gto-self/analysis-core/*'],
  message: 'analysis-core is composed by apps/web only; no package imports it (ADR-0061).',
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
        {
          group: ['@gto-self/strategy-core', '@gto-self/strategy-core/*'],
          message:
            'poker-core is the engine; strategy-core reads it through its own adapter and never the other way round.',
        },
        NO_ANALYSIS_CORE,
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
        {
          group: ['@gto-self/strategy-core', '@gto-self/strategy-core/*'],
          message:
            'gto-core (solved data) and strategy-core (the local REFERENCE engine) are mutually unaware.',
        },
        NO_ANALYSIS_CORE,
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
        {
          group: ['@gto-self/strategy-core', '@gto-self/strategy-core/*'],
          message:
            'Composing player data with the REFERENCE baseline belongs above both packages, never inside player-core.',
        },
        NO_ANALYSIS_CORE,
      ]),
    },
  },
  {
    files: ['packages/strategy-core/**/*.ts'],
    rules: {
      // The local REFERENCE engine. Neutral by construction: it consumes a `StrategyQuery`
      // DTO and knows no poker rules of its own. `poker-core` is banned HERE and allowed
      // back only in `src/adapter/**` by the block immediately below, which is the single
      // documented seam (docs/GTO_DESIGN_NOTES.md note F).
      'no-restricted-imports': restrict([
        NO_UI,
        NO_DB,
        NO_SOLVER_LAB,
        {
          group: ['@gto-self/poker-core', '@gto-self/poker-core/*'],
          message:
            'Only packages/strategy-core/src/adapter/ may import poker-core. Everything else consumes the neutral StrategyQuery.',
        },
        {
          group: ['@gto-self/player-core', '@gto-self/player-core/*'],
          message:
            'Player tendencies must never influence the REFERENCE baseline; compose them above this package.',
        },
        {
          group: ['@gto-self/gto-core', '@gto-self/gto-core/*'],
          message:
            'strategy-core (local REFERENCE) and gto-core (solved data) are separate and mutually unaware.',
        },
        NO_ANALYSIS_CORE,
      ]),
    },
  },
  {
    // THE SEAM. Flat config is last-match-wins and does NOT merge, so this block repeats
    // the full pattern list above with the poker-core ban removed — that omission is the
    // entire carve-out, and every other ban stays in force here.
    files: ['packages/strategy-core/src/adapter/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict([
        NO_UI,
        NO_DB,
        NO_SOLVER_LAB,
        {
          group: ['@gto-self/player-core', '@gto-self/player-core/*'],
          message:
            'Player tendencies must never influence the REFERENCE baseline; compose them above this package.',
        },
        {
          group: ['@gto-self/gto-core', '@gto-self/gto-core/*'],
          message:
            'strategy-core (local REFERENCE) and gto-core (solved data) are separate and mutually unaware.',
        },
        NO_ANALYSIS_CORE,
      ]),
    },
  },
  {
    files: ['packages/analysis-core/**/*.ts'],
    rules: {
      // ADR-0061. The interpreter reads the poker engine and writes player-domain facts,
      // so it is the ONE package allowed to import both `poker-core` and `player-core`.
      // Everything else is banned, and the two bans that matter most are strategy-core and
      // gto-core: a player model must never read or influence the baseline strategy. That
      // is the C2 boundary, and it is enforced here rather than trusted.
      'no-restricted-imports': restrict([
        NO_UI,
        NO_DB,
        NO_SOLVER_LAB,
        {
          group: ['@gto-self/strategy-core', '@gto-self/strategy-core/*'],
          message:
            'A player model must not read or influence the REFERENCE baseline; combining them is C2 and has no import path today (ADR-0061).',
        },
        {
          group: ['@gto-self/gto-core', '@gto-self/gto-core/*'],
          message:
            'analysis-core interprets our own hand history; solved GTO data has no part in it (ADR-0061).',
        },
        {
          group: ['@gto-self/coinpoker-parser', '@gto-self/coinpoker-parser/*'],
          message:
            'analysis-core consumes poker-core events, whatever produced them; it never depends on a particular importer.',
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
      'no-restricted-imports': restrict([NO_UI, NO_SOLVER_LAB, NO_ANALYSIS_CORE]),
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
            '@gto-self/strategy-core',
            '@gto-self/strategy-core/*',
          ],
          message:
            'The parser produces poker events; it knows nothing about GTO, strategy or players.',
        },
        NO_ANALYSIS_CORE,
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
            '@gto-self/strategy-core',
            '@gto-self/strategy-core/*',
            '@gto-self/coinpoker-parser',
            '@gto-self/coinpoker-parser/*',
            '@gto-self/analysis-core',
            '@gto-self/analysis-core/*',
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
      // The app may import the domain freely, but persistence is reached only through
      // `src/server/`. `@gto-self/db` pulls in `better-sqlite3`, a native Node module: a
      // client component that imports it does not fail a lint rule, it fails at runtime in
      // the browser. Funnelling every DB call through one server-only directory also keeps
      // the hot path — keypress -> poker-core -> React -> render — provably free of a
      // database round trip, which is a product requirement and not a style preference.
      'no-restricted-imports': restrict([
        NO_SOLVER_LAB,
        {
          ...NO_DB,
          message:
            'Reach persistence through apps/web/src/server/ only. @gto-self/db loads a native module and must never be bundled into a client component.',
        },
      ]),
    },
  },
  {
    // The one place in the app permitted to open the database — plus `apps/web/tests/`,
    // which is test scaffolding OUTSIDE the Next.js `src/` tree and is never bundled into
    // any page. The rule above exists to keep a native module out of a client bundle; a
    // fixture that no route can reach cannot put one there.
    files: ['apps/web/src/server/**/*.{ts,tsx}', 'apps/web/tests/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': restrict([NO_SOLVER_LAB]) },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'solver-lab/**/*.ts', 'scripts/**/*.mjs'],
    rules: { 'no-console': 'off', '@typescript-eslint/no-explicit-any': 'off' },
  },
);
