# @gto-self/strategy-core

Machinery for the deterministic local **REFERENCE** strategy engine (user-facing name
기본전략 · REFERENCE). It is **never** labelled GTO and contains **no** strategy numbers:
this package supplies the query model, the poker adapter seam, spot canonicalization,
stack buckets and the 1326-combo range model. The reference policies themselves land in a
later work package.

Layering:

- `@gto-self/shared` everywhere.
- `@gto-self/poker-core` **only** inside `src/adapter/` — the single documented seam that
  converts poker application state into a neutral `StrategyQuery`
  (`docs/GTO_DESIGN_NOTES.md` note F). Everything outside `src/adapter/` is neutral.
- Never `@gto-self/player-core` (player data must not influence baseline recommendations),
  never `@gto-self/gto-core` (the future solved-GTO provider is a separate, mutually
  unaware package), never React/Next/`@gto-self/db`.

ESLint enforces all of the above; see the `packages/strategy-core/**` blocks in
`eslint.config.js`.
