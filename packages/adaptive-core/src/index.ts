/**
 * `@gto-self/adaptive-core` — the COMPOSITION layer (user-facing name 상대 적응 · ADAPTIVE).
 *
 * It owns exactly one idea: take the REFERENCE engine's answer AS A VALUE, take what we
 * honestly know about an opponent AS A VALUE, and produce a second, clearly-labelled answer
 * plus the evidence for every step of the difference. It is not a strategy engine, it holds
 * no poker rules, and it never recomputes a baseline.
 *
 * ---------------------------------------------------------------------------------------
 * LAYERING (CLAUDE.md rule 4, WP-J design contract §1) — ESLint and
 * `tests/layering.test.ts` both enforce this, independently.
 *
 * MAY import:  `@gto-self/shared`, `@gto-self/strategy-core`, `@gto-self/player-core`.
 *
 * MUST NOT import:
 *   - `@gto-self/analysis-core` — ADR-0061 stands: nothing but `apps/web` composes the
 *     event-log interpreter. Learned-model numbers reach this package as the neutral
 *     `AdaptiveStatObservation[]` DTO, so no persistence or event-log knowledge leaks in.
 *   - `@gto-self/db` — the domain is authoritative; the DB is persistence.
 *   - `@gto-self/poker-core` — this package never sees a `HandState`; the caller hands it
 *     an already-computed baseline.
 *   - `@gto-self/gto-core` — solved data and the local REFERENCE engine stay mutually
 *     unaware, and ADAPTIVE composes the latter.
 *   - React / Next.js, and `solver-lab`.
 *
 * THE INVARIANT THIS PACKAGE EXISTS TO PRESERVE: `computeStrategy(state, heroSeat)` is
 * byte-identical whatever the player data is. ADAPTIVE is a SECOND call that takes the
 * REFERENCE result as an argument, never a parameter threaded into the first one.
 *
 * NOTHING HERE IS GTO (CLAUDE.md rule 2). The anchors in `priors.ts` are this project's own
 * declared zero-adjustment points, tagged `HEURISTIC` with a mandatory note, and are never
 * labelled as solved output.
 *
 * DETERMINISM: no clock, no random source, no generated id, and integer basis points end to
 * end. The same input produces the same bytes, which is what lets a stored trace be
 * reproduced and compared.
 * ---------------------------------------------------------------------------------------
 */
export * from './stats.js';
export * from './inputs.js';
export * from './priors.js';
export * from './profile.js';
export * from './version.js';

// The composition layer proper (WP J-C): the neutral baseline, the two policy models as data,
// the two passes over them, the multi-opponent roles, and the single entry point.
export * from './baseline.js';
export * from './multiway.js';
export * from './recommendation.js';
export * from './compose.js';

export * from './policy/reasons.js';
export * from './policy/frequencyModel.js';
export * from './policy/sizingModel.js';
export * from './policy/scope.js';
export * from './policy/frequency.js';
export * from './policy/sizing.js';
