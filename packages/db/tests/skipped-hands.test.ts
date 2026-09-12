/**
 * `skipped_hands` — the best-effort audit row for a hand the user chose to SKIP.
 *
 * The interesting column is `reason` (migration `0009`), and the interesting property is
 * that its THREE states stay three: `QUICK_SKIP`, `HERO_FOLDED_UNOBSERVED`, and `NULL`
 * meaning "written before the reason was recorded". `NULL` is never produced as a default
 * and never read as a member (`CLAUDE.md` rules 3 and 5).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { asId, Money, unwrap, type PlayerId, type SessionId } from '@gto-self/shared';
import { createPlayer, timestamp } from '@gto-self/player-core';
import { createTable, seatPlayer } from '@gto-self/poker-core';
import { insertSession } from '../src/repositories/sessions.js';
import { insertPlayer } from '../src/repositories/players.js';
import {
  getSkippedHand,
  insertSkippedHand,
  listSkippedHandsForSession,
} from '../src/repositories/skipped-hands.js';
import { openTestDatabase, type DatabaseHandle } from '../src/client.js';
import { MANUAL_FEE_PRESET } from './fixture.js';

const T0 = timestamp(1_700_000_000_000);
const T1 = timestamp(1_700_000_060_000);
const SESSION = asId<'Session'>('sess-1') as SessionId;
const HERO = asId<'Player'>('p1') as PlayerId;

describe('skipped hands', () => {
  let handle: DatabaseHandle;
  beforeEach(() => {
    handle = openTestDatabase();
    unwrap(
      insertPlayer(handle.db, unwrap(createPlayer({ id: HERO, nickname: 'Hero', createdAt: T0 }))),
    );
    let table = unwrap(createTable(MANUAL_FEE_PRESET));
    table = unwrap(seatPlayer(table, 0, HERO, Money.mbb(100_000)));
    unwrap(
      insertSession(handle.db, {
        id: SESSION,
        label: null,
        presetId: null,
        table,
        createdAt: T0,
        updatedAt: T0,
        closedAt: null,
        autoTopUp: null,
        seatAutoTopUp: {},
        seatStackUnverified: {},
      }),
    );
    return () => handle.close();
  });

  it('round-trips both reasons verbatim', () => {
    unwrap(
      insertSkippedHand(handle.db, {
        id: asId<'SkippedHand'>('k1'),
        sessionId: SESSION,
        handNumber: 4,
        skippedAt: T0,
        reason: 'QUICK_SKIP',
      }),
    );
    unwrap(
      insertSkippedHand(handle.db, {
        id: asId<'SkippedHand'>('k2'),
        sessionId: SESSION,
        handNumber: 5,
        skippedAt: T1,
        reason: 'HERO_FOLDED_UNOBSERVED',
      }),
    );

    expect(unwrap(getSkippedHand(handle.db, asId<'SkippedHand'>('k1')))?.reason).toBe('QUICK_SKIP');
    expect(unwrap(listSkippedHandsForSession(handle.db, SESSION)).map((row) => row.reason)).toEqual(
      ['QUICK_SKIP', 'HERO_FOLDED_UNOBSERVED'],
    );
  });

  it('keeps NULL as "not recorded" — it is never defaulted to a reason on read', () => {
    // Exactly what a pre-0009 row looks like on an upgraded file.
    handle.sqlite
      .prepare(`insert into skipped_hands values ('old', 'sess-1', 1, ${T0}, null)`)
      .run();
    const loaded = unwrap(getSkippedHand(handle.db, asId<'SkippedHand'>('old')));
    expect(loaded?.reason).toBeNull();
  });

  it('REFUSES a reason the schema does not know, at the constraint', () => {
    const refused = insertSkippedHand(handle.db, {
      id: asId<'SkippedHand'>('k3'),
      sessionId: SESSION,
      handNumber: 6,
      skippedAt: T0,
      // Only reachable from JavaScript that ignored the union — which is exactly the caller
      // the CHECK exists for.
      reason: 'HERO_SAT_OUT' as 'QUICK_SKIP',
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.error.code).toBe('CONSTRAINT_VIOLATION');
      expect(refused.error.message).toMatch(/skipped_hands_reason/u);
    }
    expect(unwrap(listSkippedHandsForSession(handle.db, SESSION))).toEqual([]);
  });

  it('reports a CORRUPT_ROW rather than passing an unknown stored reason through', () => {
    handle.sqlite.prepare(`pragma ignore_check_constraints = ON`).run();
    handle.sqlite
      .prepare(`insert into skipped_hands values ('bad', 'sess-1', 2, ${T0}, 'WHATEVER')`)
      .run();
    handle.sqlite.prepare(`pragma ignore_check_constraints = OFF`).run();

    const loaded = getSkippedHand(handle.db, asId<'SkippedHand'>('bad'));
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) {
      expect(loaded.error.code).toBe('CORRUPT_ROW');
      expect(loaded.error.context.field).toBe('reason');
      expect(loaded.error.context.actual).toBe('WHATEVER');
    }
    // The list read refuses the whole page rather than skipping the bad row silently.
    expect(listSkippedHandsForSession(handle.db, SESSION).ok).toBe(false);
  });
});
