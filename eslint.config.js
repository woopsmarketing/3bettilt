import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

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
  {
    // The poker engine knows nothing but poker (ADR-0021): no React, no DOM, no
    // persistence, and no strategy or player-tendency logic.
    files: ['packages/poker-core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'Domain packages must not depend on React.' },
            { name: 'next', message: 'Domain packages must not depend on Next.js.' },
            { name: '@gto-self/db', message: 'Domain packages must not depend on persistence.' },
            {
              name: '@gto-self/gto-core',
              message: 'poker-core must not know about GTO, CFR or strategy policy (ADR-0021).',
            },
            {
              name: '@gto-self/player-core',
              message: 'poker-core must not know about player tendencies (ADR-0021).',
            },
          ],
        },
      ],
    },
  },
  {
    // The GTO engine knows nothing about individual players, and never reaches for
    // persistence or the UI.
    files: ['packages/gto-core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'Domain packages must not depend on React.' },
            { name: 'next', message: 'Domain packages must not depend on Next.js.' },
            { name: '@gto-self/db', message: 'Domain packages must not depend on persistence.' },
            {
              name: '@gto-self/player-core',
              message:
                'GTO baseline data must never be influenced by individual player statistics (ADR-0021).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'solver-lab/**/*.ts', 'scripts/**/*.mjs'],
    rules: { 'no-console': 'off', '@typescript-eslint/no-explicit-any': 'off' },
  },
);
