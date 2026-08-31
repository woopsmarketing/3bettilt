// @vitest-environment node
//
// Server code is Node code: it opens a native SQLite binding and `@gto-self/db` resolves its
// migrations folder from `import.meta.url`, which is not a `file:` URL under the project's
// default happy-dom environment. The DOM is irrelevant to everything here.
/**
 * `persistCompletedHand` against a REAL migrated database.
 *
 * The interesting parts are the ones the component test cannot reach: that the stored hand
 * round-trips through `loadStoredHand` back to the hand the browser played, that a duplicate
 * callback writes nothing, and what the service does with a session it must not silently
 * refuse and a client clock it must not silently believe.
 *
 * The hand is built through `poker-core`'s public API on the SESSION's own stored table, so
 * its seats hold the real `players` rows the session created — a hand dealt from a synthetic
 * fixture table would fail the `hand_players` foreign key rather than test anything.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  asId,
  Money,
  parseCards,
  sequentialIdFactory,
  unwrap,
  type SessionId,
} from '@gto-self/shared';
import type { HandId } from '@gto-self/shared';
import { timestamp } from '@gto-self/player-core';
import {
  advanceButton,
  applyCommands,
  applyHandResult,
  awardPots,
  call,
  check,
  CP_NL50_6MAX_ANTE,
  dealBoard,
  encodeHandEvents,
  fold,
  raiseTo,
  SEAT_INDEXES,
  setHoleCards,
  startHand,
  type Hand,
  type TableState,
} from '@gto-self/poker-core';
import {
  closeSession,
  getHand,
  getSession,
  listCompletedHandsForSession,
  loadHandEvents,
  loadStoredHand,
  openTestDatabase,
  type DatabaseHandle,
} from '@gto-self/db';
import type { SeatFormValue, SessionFormValue } from '../lib/session-setup/contract.js';
import { emptySeatForm } from '../lib/session-setup/plan.js';
import { startSession } from './session-service.js';
import { persistCompletedHand } from './hand-history-service.js';

/** The SERVER clock every test injects. Fixed, so a clamp is observable. */
const NOW = timestamp(1_800_000_000_000);
/** A plausible client reading, a few minutes before `NOW`. */
const CLIENT_STARTED = 1_799_999_700_000;
const CLIENT_FINISHED = 1_799_999_800_000;

function seat(overrides: Partial<SeatFormValue> = {}): SeatFormValue {
  return { ...emptySeatForm(), occupancy: 'ACTIVE', nickname: 'x', stackText: '100', ...overrides };
}

function form(): SessionFormValue {
  return {
    presetId: CP_NL50_6MAX_ANTE.presetId,
    anteEnabled: true,
    label: 'History session',
    buttonSeat: 0,
    autoTopUpEnabled: false,
    autoTopUpTargetText: '100',
    seats: SEAT_INDEXES.map((index) =>
      index < 3
        ? seat({ nickname: `History villain ${index}`, isHero: index === 0 })
        : { ...emptySeatForm(), occupancy: 'EMPTY' as const },
    ),
  };
}

let handle: DatabaseHandle;
/** The drizzle database the repositories take. */
let db: (typeof handle)['db'];
let sessionId: SessionId;
let table: TableState;

beforeEach(() => {
  handle = openTestDatabase();
  db = handle.db;
  const started = startSession(db, form(), { ids: sequentialIdFactory('s'), now: NOW });
  if (!started.ok) throw new Error(started.issues.map((issue) => issue.message).join('; '));
  sessionId = asId<'Session'>(started.sessionId);
  const stored = getSession(db, sessionId);
  if (!stored.ok || stored.value === null) throw new Error('the session did not come back');
  table = stored.value.table;
});

/**
 * A complete three-handed hand on the session's own table: the button opens, the small blind
 * folds, the big blind calls, the board runs out checked, and the pot is awarded with a
 * manual splash fee. Hero's hole cards and one SHOWN hand are entered, so the round trip is
 * asked about cards too.
 */
function playCompleteHand(handId: string): Hand {
  const ids = sequentialIdFactory(`ev-${handId}`);
  const hand = unwrap(startHand(table, { handId: asId<'Hand'>(handId) }, ids));
  return unwrap(
    applyCommands(
      hand,
      [
        setHoleCards(0, unwrap(parseCards('Ah Kd')), false),
        raiseTo(Money.fromBB(3)),
        fold(),
        call(),
        dealBoard(unwrap(parseCards('7c 2d Ts'))),
        check(),
        check(),
        dealBoard(unwrap(parseCards('4h'))),
        check(),
        check(),
        dealBoard(unwrap(parseCards('9s'))),
        check(),
        check(),
        setHoleCards(2, unwrap(parseCards('Qs Jc')), true),
        awardPots([{ potIndex: 0, winners: [0] }]),
      ],
      ids,
    ),
  );
}

const persistInput = (hand: Hand, overrides: Record<string, unknown> = {}) => ({
  sessionId,
  events: encodeHandEvents(hand.events),
  startedAt: CLIENT_STARTED,
  finishedAt: CLIENT_FINISHED,
  ...overrides,
});

describe('persistCompletedHand', () => {
  it('stores a completed hand and round-trips it back to the hand that was played', () => {
    const hand = playCompleteHand('hand-round-trip');

    const result = persistCompletedHand(db, persistInput(hand), { now: NOW });
    expect(result).toEqual({ ok: true, handId: hand.state.handId, outcome: 'PERSISTED' });

    const reloaded = loadStoredHand(db, asId<'Hand'>('hand-round-trip'));
    expect(reloaded.ok).toBe(true);
    if (!reloaded.ok) throw new Error('unreachable');
    // The WHOLE hand: every event in order, and the folded state the engine derives from it
    // (pot, rake, awards, hero cards, the SHOWN hand).
    expect(reloaded.value.events).toEqual(hand.events);
    expect(reloaded.value.state).toEqual(hand.state);

    const row = getHand(db, asId<'Hand'>('hand-round-trip'));
    if (!row.ok || row.value === null) throw new Error('the header did not come back');
    expect(row.value.sessionId).toBe(sessionId);
    expect(row.value.source).toBe('MANUAL_PRACTICE');
    expect(row.value.startedAt).toBe(CLIENT_STARTED);
    expect(row.value.finishedAt).toBe(CLIENT_FINISHED);
  });

  it('is exactly-once: a duplicate callback writes nothing and reports ALREADY_PERSISTED', () => {
    const hand = playCompleteHand('hand-duplicate');
    const first = persistCompletedHand(db, persistInput(hand), { now: NOW });
    expect(first).toEqual({ ok: true, handId: hand.state.handId, outcome: 'PERSISTED' });

    const before = loadHandEvents(db, asId<'Hand'>('hand-duplicate'));
    if (!before.ok) throw new Error(before.error.message);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const again = persistCompletedHand(db, persistInput(hand), { now: NOW });
      expect(again).toEqual({ ok: true, handId: hand.state.handId, outcome: 'ALREADY_PERSISTED' });
    }

    const after = loadHandEvents(db, asId<'Hand'>('hand-duplicate'));
    if (!after.ok) throw new Error(after.error.message);
    expect(after.value).toEqual(before.value);
    const listed = listCompletedHandsForSession(db, sessionId);
    if (!listed.ok) throw new Error(listed.error.message);
    expect(listed.value).toHaveLength(1);
  });

  it('REFUSES a hand that is not complete, and writes nothing', () => {
    const ids = sequentialIdFactory('ev-live');
    const live = unwrap(startHand(table, { handId: asId<'Hand'>('hand-live') }, ids));
    const afterOneAction = unwrap(applyCommands(live, [fold()], ids));

    const result = persistCompletedHand(db, persistInput(afterOneAction), { now: NOW });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.code).toBe('HAND_NOT_COMPLETE');

    const row = getHand(db, asId<'Hand'>('hand-live'));
    expect(row.ok && row.value).toBeNull();
  });

  it('REFUSES an event log the engine cannot decode, verbatim, and writes nothing', () => {
    const result = persistCompletedHand(
      db,
      {
        sessionId,
        events: [{ kind: 'NOT_AN_EVENT' }],
        startedAt: CLIENT_STARTED,
        finishedAt: CLIENT_FINISHED,
      },
      { now: NOW },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.message.length).toBeGreaterThan(0);

    const listed = listCompletedHandsForSession(db, sessionId);
    expect(listed.ok && listed.value).toHaveLength(0);
  });

  it('REFUSES malformed input shapes', () => {
    for (const input of [null, 'nope', {}, { sessionId, events: [] }]) {
      const result = persistCompletedHand(db, input, { now: NOW });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.code).toBe('INVALID_INPUT');
    }
  });

  it('REFUSES a session that does not exist', () => {
    const hand = playCompleteHand('hand-no-session');
    const result = persistCompletedHand(
      db,
      { ...persistInput(hand), sessionId: 'session-that-never-was' },
      { now: NOW },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.code).toBe('NOT_FOUND');
  });

  it('ACCEPTS a completed hand for a CLOSED session — history is not a preference', () => {
    const hand = playCompleteHand('hand-closed-session');
    const closed = closeSession(db, sessionId, NOW);
    if (!closed.ok) throw new Error(closed.error.message);

    const result = persistCompletedHand(db, persistInput(hand), { now: NOW });
    expect(result).toEqual({ ok: true, handId: hand.state.handId, outcome: 'PERSISTED' });
  });

  it('CLAMPS a client clock set in the FUTURE to the server clock, rather than losing the hand', () => {
    const hand = playCompleteHand('hand-future-clock');
    const result = persistCompletedHand(
      db,
      persistInput(hand, { startedAt: NOW + 86_400_000, finishedAt: NOW + 90_000_000 }),
      { now: NOW },
    );
    expect(result).toEqual({ ok: true, handId: hand.state.handId, outcome: 'PERSISTED' });

    const row = getHand(db, asId<'Hand'>('hand-future-clock'));
    if (!row.ok || row.value === null) throw new Error('no header');
    expect(row.value.startedAt).toBe(NOW);
    expect(row.value.finishedAt).toBe(NOW);
  });

  it('CLAMPS an implausible or non-integer client clock to the server clock', () => {
    const hand = playCompleteHand('hand-1970-clock');
    const result = persistCompletedHand(db, persistInput(hand, { startedAt: 0, finishedAt: 1.5 }), {
      now: NOW,
    });
    expect(result.ok).toBe(true);

    const row = getHand(db, asId<'Hand'>('hand-1970-clock'));
    if (!row.ok || row.value === null) throw new Error('no header');
    expect(row.value.startedAt).toBe(NOW);
    expect(row.value.finishedAt).toBe(NOW);
  });

  it('orders a reversed client pair rather than refusing the write', () => {
    const hand = playCompleteHand('hand-reversed-clock');
    const result = persistCompletedHand(
      db,
      persistInput(hand, { startedAt: CLIENT_FINISHED, finishedAt: CLIENT_STARTED }),
      { now: NOW },
    );
    expect(result.ok).toBe(true);
    const row = getHand(db, asId<'Hand'>('hand-reversed-clock'));
    if (!row.ok || row.value === null) throw new Error('no header');
    expect(row.value.startedAt).toBe(CLIENT_STARTED);
    expect(row.value.finishedAt).toBe(CLIENT_STARTED);
  });

  it('stores each of a session’s hands under its own id, in hand order', () => {
    const first = playCompleteHand('hand-seq-1');
    expect(persistCompletedHand(db, persistInput(first), { now: NOW }).ok).toBe(true);

    // The engine's own between-hands sequence, exactly as the store runs it, so the second
    // hand carries the NEXT `handNumber` rather than repeating the first one's.
    table = unwrap(advanceButton(unwrap(applyHandResult(table, first))));
    const second = playCompleteHand('hand-seq-2');
    expect(second.state.handNumber).toBe(first.state.handNumber + 1);
    expect(persistCompletedHand(db, persistInput(second), { now: NOW }).ok).toBe(true);

    const listed = listCompletedHandsForSession(db, sessionId);
    if (!listed.ok) throw new Error(listed.error.message);
    expect(listed.value.map((row) => row.id)).toEqual([
      asId<'Hand'>('hand-seq-1') as HandId,
      asId<'Hand'>('hand-seq-2') as HandId,
    ]);
  });
});
