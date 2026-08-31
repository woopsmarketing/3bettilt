// @vitest-environment node
/**
 * ACCEPTANCE BLOCKER (prompt §39, ADR-0062g): C1 creates knowledge and does NOT use it.
 *
 * A fixed strategy query is evaluated through `apps/web/src/lib/table/strategy.ts` — the
 * exact call the Strategy Panel makes — before and after a real analysis run has written
 * player model snapshots. The two results must serialize BIT-IDENTICALLY.
 *
 * This is a permanent test, not a milestone check. The day a C2 phase deliberately wires the
 * player model into 기본전략, this test is the thing that must be consciously changed, with
 * an ADR, rather than quietly drifting.
 *
 * The property has a structural backstop too: `strategy-core` may not import
 * `analysis-core`, `player-core` or `@gto-self/db`, and ESLint enforces it in both
 * directions (ADR-0061). That makes an accidental coupling a lint failure. This test is what
 * catches the other route — the app layer feeding model data into the query it builds.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { asId, Money, parseCards, sequentialIdFactory, unwrap } from '@gto-self/shared';
import { timestamp } from '@gto-self/player-core';
import {
  applyCommands,
  call,
  check,
  dealBoard,
  fold,
  raiseTo,
  setHoleCards,
  startHand,
  type Hand,
} from '@gto-self/poker-core';
import { getLatestSnapshot, openTestDatabase, type DatabaseHandle } from '@gto-self/db';
import { computeStrategy } from '../lib/table/strategy.js';
import { runSessionAnalysis } from './analysis-service.js';
import { persistFixtureHands, startFixtureSession } from '../../tests/support/analysis-fixture.js';

const NOW = timestamp(1_800_000_000_000);

let handle: DatabaseHandle;

beforeEach(() => {
  handle = openTestDatabase();
});

describe('the player model does NOT change 기본전략 · REFERENCE (prompt §39)', () => {
  it('serializes the SAME recommendation before and after analysis writes snapshots', () => {
    const db = handle.db;
    const session = startFixtureSession(db, {
      label: 'strategy pin',
      nicknames: ['모카', '감자', '체리'],
      ids: sequentialIdFactory('sp'),
      now: NOW,
    });

    // The fixed query. Built once, from a table that exists before any analysis has run, and
    // reused verbatim afterwards — the same `HandState` object both times, so nothing about
    // the query itself can drift between the two evaluations.
    const ids = sequentialIdFactory('pin-ev');
    const opening = unwrap(
      applyCommands(
        unwrap(startHand(session.table, { handId: asId<'Hand'>('pin-hand') }, ids)),
        [setHoleCards(0, unwrap(parseCards('Ah Kd')), false)],
        ids,
      ),
    );
    const flop: Hand = unwrap(
      applyCommands(
        opening,
        [
          raiseTo(Money.fromBB(3)),
          fold(),
          call(),
          dealBoard(unwrap(parseCards('7c 2d Ts'))),
          check(),
        ],
        ids,
      ),
    );

    const preflopBefore = JSON.stringify(computeStrategy(opening.state, 0));
    const flopBefore = JSON.stringify(computeStrategy(flop.state, 0));
    expect(preflopBefore.length).toBeGreaterThan(0);
    expect(flopBefore.length).toBeGreaterThan(0);

    // Now create the knowledge: real history, a real analysis run, real snapshots.
    persistFixtureHands(db, session, 6, { idPrefix: 'sp', now: NOW });
    let clock = 1_800_000_100_000;
    const run = runSessionAnalysis(
      db,
      { sessionId: session.sessionId },
      {
        ids: sequentialIdFactory('sp-run'),
        now: () => timestamp((clock += 5)),
      },
    );
    if (!run.ok) throw new Error(`${run.code}: ${run.message}`);
    expect(run.summary.status).toBe('SUCCESS');
    // The test is worthless unless snapshots really were written.
    expect(run.summary.players.every((player) => player.outcome === 'SNAPSHOT_CREATED')).toBe(true);
    for (const player of run.summary.players) {
      const snapshot = getLatestSnapshot(db, asId<'Player'>(player.playerId));
      if (!snapshot.ok || snapshot.value === null) throw new Error('no snapshot was written');
      expect(snapshot.value.sourceHandCount).toBeGreaterThan(0);
      expect(snapshot.value.globalStats.length).toBeGreaterThan(0);
    }

    const preflopAfter = JSON.stringify(computeStrategy(opening.state, 0));
    const flopAfter = JSON.stringify(computeStrategy(flop.state, 0));

    expect(preflopAfter).toBe(preflopBefore);
    expect(flopAfter).toBe(flopBefore);
  });
});
