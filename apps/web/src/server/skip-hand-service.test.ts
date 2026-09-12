// @vitest-environment node
//
// Server code is Node code: it opens a native SQLite binding and `@gto-self/db` resolves its
// migrations folder from `import.meta.url`, which is not a `file:` URL under the project's
// default happy-dom environment. The DOM is irrelevant to everything here.
/**
 * `logSkippedHand` against a REAL migrated database.
 *
 * The interesting part is `reason`: it is REQUIRED on the wire (the client derives it from
 * the view and always sends one), it is stored VERBATIM, and an unknown value is refused
 * rather than defaulted — `NULL` in storage means "written before migration 0009", which is
 * a fact about the past that this path must never be able to produce.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  asId,
  Money,
  sequentialIdFactory,
  unwrap,
  type PlayerId,
  type SessionId,
} from '@gto-self/shared';
import { createPlayer, timestamp } from '@gto-self/player-core';
import { createTable, seatPlayer, CP_NL50_6MAX_ANTE } from '@gto-self/poker-core';
import {
  closeSession,
  insertPlayer,
  insertSession,
  listSkippedHandsForSession,
  openTestDatabase,
  type DatabaseHandle,
} from '@gto-self/db';
import { logSkippedHand } from './skip-hand-service.js';

/** The SERVER clock every test injects. The DB never reads a clock (ADR-0007). */
const NOW = timestamp(1_800_000_000_000);
const SESSION = asId<'Session'>('sess-skip') as SessionId;
const HERO = asId<'Player'>('hero') as PlayerId;

let handle: DatabaseHandle;
/** ONE factory per test, so two skips in the same test cannot collide on `id`. */
let deps: { readonly ids: ReturnType<typeof sequentialIdFactory>; readonly now: typeof NOW };

beforeEach(() => {
  handle = openTestDatabase();
  deps = { ids: sequentialIdFactory('skip'), now: NOW };
  unwrap(
    insertPlayer(
      handle.db,
      unwrap(createPlayer({ id: HERO, nickname: 'Hero', createdAt: timestamp(1_700_000_000_000) })),
    ),
  );
  let table = unwrap(createTable(CP_NL50_6MAX_ANTE));
  table = unwrap(seatPlayer(table, 0, HERO, Money.fromBB(100)));
  unwrap(
    insertSession(handle.db, {
      id: SESSION,
      label: null,
      presetId: null,
      table,
      createdAt: timestamp(1_700_000_000_000),
      updatedAt: timestamp(1_700_000_000_000),
      closedAt: null,
      autoTopUp: null,
      seatAutoTopUp: {},
      seatStackUnverified: {},
    }),
  );
  return () => handle.close();
});

describe('logSkippedHand', () => {
  it('stores the submitted reason verbatim', () => {
    expect(
      logSkippedHand(handle.db, { sessionId: SESSION, handNumber: 7, reason: 'QUICK_SKIP' }, deps),
    ).toEqual({ ok: true });
    expect(
      logSkippedHand(
        handle.db,
        { sessionId: SESSION, handNumber: 8, reason: 'HERO_FOLDED_UNOBSERVED' },
        deps,
      ),
    ).toEqual({ ok: true });

    const stored = unwrap(listSkippedHandsForSession(handle.db, SESSION));
    expect(stored.map((row) => [row.handNumber, row.reason])).toEqual([
      [7, 'QUICK_SKIP'],
      [8, 'HERO_FOLDED_UNOBSERVED'],
    ]);
    expect(stored.every((row) => row.skippedAt === NOW)).toBe(true);
  });

  it('REFUSES a submission with no reason instead of defaulting one', () => {
    const refused = logSkippedHand(handle.db, { sessionId: SESSION, handNumber: 7 }, deps);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.code).toBe('INVALID_INPUT');
      expect(refused.message).toMatch(/reason/u);
    }
    // Nothing was written: a malformed submission is not a half-recorded skip.
    expect(unwrap(listSkippedHandsForSession(handle.db, SESSION))).toEqual([]);
  });

  it('REFUSES a reason outside the vocabulary, including an explicit null', () => {
    for (const reason of ['HERO_SAT_OUT', '', null, 3]) {
      const refused = logSkippedHand(
        handle.db,
        { sessionId: SESSION, handNumber: 7, reason },
        deps,
      );
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.code).toBe('INVALID_INPUT');
    }
    expect(unwrap(listSkippedHandsForSession(handle.db, SESSION))).toEqual([]);
  });

  it('reports a session that does not exist rather than writing an orphan audit row', () => {
    const refused = logSkippedHand(
      handle.db,
      { sessionId: 'ghost', handNumber: 1, reason: 'QUICK_SKIP' },
      deps,
    );
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.code).toBe('CONSTRAINT_VIOLATION');
  });

  /**
   * The foreign key proves the session EXISTS; it says nothing about whether it is still
   * open, so a closed sitting used to accept new audit rows describing hands that cannot
   * have been played. Refused now, in the same words `seat-state-service.ts`' `openSession`
   * uses for every other table-side write.
   */
  it('REFUSES a skip against a CLOSED session, and writes nothing', () => {
    // A row written while the session was still open, so "nothing was written" below is a
    // claim about THIS call rather than about an empty table.
    expect(
      logSkippedHand(handle.db, { sessionId: SESSION, handNumber: 3, reason: 'QUICK_SKIP' }, deps),
    ).toEqual({ ok: true });

    unwrap(closeSession(handle.db, SESSION, timestamp(1_800_000_100_000)));

    const refused = logSkippedHand(
      handle.db,
      { sessionId: SESSION, handNumber: 4, reason: 'QUICK_SKIP' },
      deps,
    );
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.code).toBe('SESSION_CLOSED');
      expect(refused.message).toMatch(/ended/u);
    }

    // The earlier row is still there, and the refused one never landed.
    expect(
      unwrap(listSkippedHandsForSession(handle.db, SESSION)).map((row) => row.handNumber),
    ).toEqual([3]);
  });
});
