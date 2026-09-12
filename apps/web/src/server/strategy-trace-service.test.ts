// @vitest-environment node
//
// Server code is Node code (native SQLite binding); the happy-dom default environment has no
// `file:` `import.meta.url`, which `@gto-self/db`'s migration resolution needs.
/**
 * `generateStrategyTracesForHand` against a REAL migrated database.
 *
 * The hand is built through `poker-core`'s public API on a session's own stored table,
 * exactly like `hand-history-service.test.ts` — a synthetic fixture table would fail the
 * `hand_players` foreign key rather than test anything.
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
import { timestamp } from '@gto-self/player-core';
import {
  applyCommands,
  awardPots,
  call,
  check,
  CP_NL50_6MAX_ANTE,
  dealBoard,
  fold,
  raiseTo,
  SEAT_INDEXES,
  setHoleCards,
  startHand,
  type Hand,
  type TableState,
} from '@gto-self/poker-core';
import {
  getSession,
  listTracesForHand,
  openTestDatabase,
  type DatabaseHandle,
} from '@gto-self/db';
import type { SeatFormValue, SessionFormValue } from '../lib/session-setup/contract.js';
import { emptySeatForm } from '../lib/session-setup/plan.js';
import { startSession } from './session-service.js';
import { persistCompletedHand } from './hand-history-service.js';
import { generateStrategyTracesForHand } from './strategy-trace-service.js';

const NOW = timestamp(1_800_000_000_000);

function seat(overrides: Partial<SeatFormValue> = {}): SeatFormValue {
  return { ...emptySeatForm(), occupancy: 'ACTIVE', nickname: 'x', stackText: '100', ...overrides };
}

function form(): SessionFormValue {
  return {
    presetId: CP_NL50_6MAX_ANTE.presetId,
    anteEnabled: true,
    label: 'Trace session',
    buttonSeat: 0,
    autoTopUpEnabled: false,
    autoTopUpTargetText: '100',
    seats: SEAT_INDEXES.map((index) =>
      index < 3
        ? seat({ nickname: `Trace villain ${index}`, isHero: index === 0 })
        : { ...emptySeatForm(), occupancy: 'EMPTY' as const },
    ),
  };
}

let handle: DatabaseHandle;
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
  expect(table.heroSeat).toBe(0);
});

/**
 * Hero (seat 0, button) opens preflop, the SB folds, the BB calls, and the board runs out
 * fully checked to a Hero award. Hero has FOUR of the hand's own decisions: the preflop
 * RAISE and one CHECK on each of flop/turn/river.
 */
function playCompleteHand(handId: string, forTable: TableState = table): Hand {
  const ids = sequentialIdFactory(`ev-${handId}`);
  const hand = unwrap(startHand(forTable, { handId: asId<'Hand'>(handId) }, ids));
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

/** Same hand, but Hero's preflop entry is a single (partial) card, refusing that one spot. */
function playHandWithPartialPreflopCards(handId: string): Hand {
  const ids = sequentialIdFactory(`ev-${handId}`);
  const hand = unwrap(startHand(table, { handId: asId<'Hand'>(handId) }, ids));
  return unwrap(
    applyCommands(
      hand,
      [
        setHoleCards(0, unwrap(parseCards('Ah')), false),
        raiseTo(Money.fromBB(3)),
        fold(),
        call(),
        dealBoard(unwrap(parseCards('7c 2d Ts'))),
        // Hero's holding is completed before the flop decision, so THIS decision point (and
        // turn/river) succeed even though the preflop one was refused.
        setHoleCards(0, unwrap(parseCards('Ah Kd')), false),
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

function persist(hand: Hand, forSessionId: SessionId = sessionId): void {
  const result = persistCompletedHand(
    db,
    {
      sessionId: forSessionId,
      events: hand.events.map((event) => ({ ...event })),
      startedAt: 1_799_999_700_000,
      finishedAt: 1_799_999_800_000,
    },
    { now: NOW },
  );
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
}

describe('generateStrategyTracesForHand', () => {
  it('produces one trace row per Hero decision, with plausible fields', () => {
    const hand = playCompleteHand('hand-traces');
    persist(hand);

    const result = generateStrategyTracesForHand(db, asId<'Hand'>('hand-traces'), { now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    // Preflop RAISE + 3 postflop CHECKs.
    expect(result.value).toHaveLength(4);
    expect(result.value.every((row) => row.outcome === 'PERSISTED')).toBe(true);

    const listed = listTracesForHand(db, asId<'Hand'>('hand-traces'));
    expect(listed.ok).toBe(true);
    if (!listed.ok) throw new Error(listed.error.message);
    expect(listed.value).toHaveLength(4);

    const streets = listed.value.map((trace) => trace.street);
    expect(streets).toEqual(['PREFLOP', 'FLOP', 'TURN', 'RIVER']);

    for (const trace of listed.value) {
      expect(trace.handId).toBe('hand-traces');
      expect(trace.heroSeat).toBe(0);
      expect(trace.strategyMode).toBe('REFERENCE');
      expect(trace.strategyVersion.length).toBeGreaterThan(0);
      expect(trace.source).toBe('ONLINE');
      expect(trace.actions.length).toBeGreaterThan(0);
      const total = trace.actions.reduce((sum, action) => sum + action.frequencyBps, 0);
      expect(total).toBe(10_000);
      expect(['SOURCE', 'DERIVED', 'HEURISTIC']).toContain(trace.provenanceQuality);
    }

    const preflop = listed.value[0];
    expect(preflop?.actualHeroAction).toBe('RAISE');
    const flop = listed.value[1];
    expect(flop?.actualHeroAction).toBe('CHECK');
  });

  it('is exactly-once: calling twice does not duplicate rows', () => {
    const hand = playCompleteHand('hand-twice');
    persist(hand);

    const first = generateStrategyTracesForHand(db, asId<'Hand'>('hand-twice'), { now: NOW });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.error.message);
    expect(first.value.every((row) => row.outcome === 'PERSISTED')).toBe(true);

    const second = generateStrategyTracesForHand(db, asId<'Hand'>('hand-twice'), { now: NOW });
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error(second.error.message);
    expect(second.value.every((row) => row.outcome === 'ALREADY_PERSISTED')).toBe(true);

    const listed = listTracesForHand(db, asId<'Hand'>('hand-twice'));
    expect(listed.ok).toBe(true);
    if (!listed.ok) throw new Error(listed.error.message);
    expect(listed.value).toHaveLength(4);
  });

  it('skips a refused decision point but still traces the others (partial success)', () => {
    const hand = playHandWithPartialPreflopCards('hand-partial');
    persist(hand);

    const result = generateStrategyTracesForHand(db, asId<'Hand'>('hand-partial'), { now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    // The preflop spot is refused (INVALID_HERO_CARDS: one card entered); flop/turn/river
    // still succeed.
    expect(result.value).toHaveLength(3);

    const listed = listTracesForHand(db, asId<'Hand'>('hand-partial'));
    expect(listed.ok).toBe(true);
    if (!listed.ok) throw new Error(listed.error.message);
    expect(listed.value.map((trace) => trace.street)).toEqual(['FLOP', 'TURN', 'RIVER']);
    expect(listed.value.every((trace) => trace.actualHeroAction === 'CHECK')).toBe(true);
  });

  // `startSession` itself refuses a lineup with no Hero seat chosen ("choose which seat is
  // Hero"), so a Hero-less session cannot be reached through this app's own session setup —
  // `generateStrategyTracesForHand`'s `session.value.table.heroSeat === null` branch is a
  // defensive guard for data this app cannot currently produce, not a reachable UI path, and
  // is intentionally left uncovered here rather than forcing it via a database bypass.
});
