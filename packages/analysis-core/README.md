# `@gto-self/analysis-core`

The deterministic **event-log → player-observation interpreter** (ADR-0061).

It exists because the layering forbids anyone else from doing this job: `player-core` may
not import `poker-core` and `poker-core` may not import `player-core` (ADR-0021), so the
code that reads a hand's event log and produces player-domain facts can live in neither.

## Boundary

May import `@gto-self/shared`, `@gto-self/poker-core`, `@gto-self/player-core` — and
nothing else. Never `strategy-core` or `gto-core` (a player model must not read or
influence the REFERENCE baseline; that is C2 and has no import path today), never
`@gto-self/db`, never React or Next. Only `apps/web` may import this package; no other
package may. ESLint enforces all of it, in both directions.

## Guarantees

- **Deterministic.** No clock, no RNG, no id generation. The same hands under the same
  `ANALYSIS_ALGORITHM_VERSION` produce `JSON.stringify`-identical output, and the input
  order of the hands does not matter.
- **Facts only.** Opportunity counts, action counts, actual integer milliBB amounts, and
  explicitly revealed cards. No adjectives, no rates stored, no strategy comparison.
- **Real opportunities.** Every denominator is read off `HandState.actions` — the engine's
  own record of who was actually on the clock. Nothing is inferred from a position.

## Surface

| Export                                          | What it does                                            |
| ----------------------------------------------- | ------------------------------------------------------- |
| `extractHandObservations(hand, config?)`        | One COMPLETE hand → per-player facts                    |
| `computePlayerModel(playerId, hands, options?)` | Full recomputation → one model document                 |
| `inputIdentityHash(handIds)`                    | Order-independent 64-bit identity of an input set       |
| `playersInHands(hands)`                         | Every identified player in a hand set, sorted           |
| `decisionsOf(state, config)`                    | The classified decision walk, for inspection and tests  |
| `ANALYSIS_ALGORITHM_VERSION`                    | Stamped on every snapshot; bump on any behaviour change |

`src/testing.ts` holds test-only fixtures and is deliberately absent from the barrel.

Full taxonomy, per-stat denominators and open questions: `docs/reports/C0C1_WP_C1A.md`.
