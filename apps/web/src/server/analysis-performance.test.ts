// @vitest-environment node
/**
 * The analysis performance MEASUREMENT (prompt §35). Not a CI gate.
 *
 * It is skipped unless `GTO_SELF_BENCH=1` is set, deliberately:
 *
 * ```
 * GTO_SELF_BENCH=1 pnpm vitest run --project web src/server/analysis-performance.test.ts
 * ```
 *
 * Prompt §35 asks for 100 / 500 / 1000-hand durations to be reported, and forbids
 * optimising without evidence. A wall-clock assertion in the normal suite would be the
 * opposite of evidence — it would be a flake that fires on a loaded machine and says nothing
 * about the algorithm. So the numbers are measured on demand and recorded in
 * `docs/reports/C0C1_WP_C1B.md`; the only assertion here is a ceiling so generous that
 * tripping it means a real complexity regression, not a busy laptop.
 *
 * What is being measured is `runSessionAnalysis` alone — building and STORING the synthetic
 * history is excluded from the timer, because that is `persistCompletedHand`'s cost and it
 * is paid one hand at a time during play, not at the button.
 */
import { describe, expect, it } from 'vitest';
import { sequentialIdFactory } from '@gto-self/shared';
import { timestamp } from '@gto-self/player-core';
import { openTestDatabase } from '@gto-self/db';
import { runSessionAnalysis } from './analysis-service.js';
import { persistFixtureHands, startFixtureSession } from '../../tests/support/analysis-fixture.js';

const NOW = timestamp(1_800_000_000_000);
const HAND_COUNTS = [100, 500, 1000] as const;

/** A ceiling that a correctness-preserving change cannot plausibly cross. */
const CEILING_MS_PER_HAND = 200;

describe.skipIf(process.env.GTO_SELF_BENCH !== '1')('analysis performance (prompt §35)', () => {
  for (const handCount of HAND_COUNTS) {
    it(`analyses a ${handCount}-hand session`, () => {
      const handle = openTestDatabase();
      const db = handle.db;
      const session = startFixtureSession(db, {
        label: `bench ${handCount}`,
        nicknames: ['모카', '감자', '체리'],
        ids: sequentialIdFactory(`bench-${handCount}`),
        now: NOW,
      });
      const buildStart = performance.now();
      persistFixtureHands(db, session, handCount, {
        idPrefix: `bench-${handCount}`,
        now: NOW,
      });
      const buildMs = performance.now() - buildStart;

      let clock = 1_800_000_100_000;
      const start = performance.now();
      const result = runSessionAnalysis(
        db,
        { sessionId: session.sessionId },
        { ids: sequentialIdFactory('bench-run'), now: () => timestamp((clock += 1)) },
      );
      const analysisMs = performance.now() - start;
      if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
      expect(result.summary.status).toBe('SUCCESS');
      expect(result.summary.sessionHandCount).toBe(handCount);
      expect(result.summary.players.every((player) => player.totalHands === handCount)).toBe(true);

      // A SECOND run over the same history is the NO_CHANGES path: no compute at all, so
      // it is the floor the idempotency gate buys.
      const repeatStart = performance.now();
      const repeat = runSessionAnalysis(
        db,
        { sessionId: session.sessionId },
        { ids: sequentialIdFactory('bench-run-2'), now: () => timestamp((clock += 1)) },
      );
      const repeatMs = performance.now() - repeatStart;
      if (!repeat.ok) throw new Error(repeat.message);
      expect(repeat.summary.players.every((player) => player.outcome === 'NO_CHANGES')).toBe(true);

      console.log(
        `[bench] hands=${handCount} players=3 ` +
          `build+persist=${buildMs.toFixed(0)}ms ` +
          `analysis=${analysisMs.toFixed(0)}ms ` +
          `re-run(NO_CHANGES)=${repeatMs.toFixed(1)}ms`,
      );
      expect(analysisMs).toBeLessThan(handCount * CEILING_MS_PER_HAND);
      handle.close();
    }, 600_000);
  }
});
