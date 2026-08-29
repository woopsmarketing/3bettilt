/**
 * `hands`, `hand_players`, `hand_events` — the event log round trip.
 *
 * The property that matters: events written to SQLite and read back reproduce the SAME
 * `HandState`, through `poker-core`'s `loadHand`. The fixture hand exercises every Phase-2
 * addition to the event shape, so a schema written against an older description would fail
 * here rather than silently drop a field.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { asId, Money, unwrap, type HandId, type PlayerId, type SessionId } from '@gto-self/shared';
import { createPlayer, timestamp } from '@gto-self/player-core';
import { jsonRoundTrip } from '@gto-self/poker-core';
import * as handRepository from '../src/repositories/hands.js';
import { insertSession } from '../src/repositories/sessions.js';
import { insertPlayer } from '../src/repositories/players.js';
import { openTestDatabase, type DatabaseHandle } from '../src/client.js';
import { handEvents } from '../src/schema.js';
import { BB, buildFixtureHand, buildTable, FIXTURE_FEE } from './fixture.js';

const T0 = timestamp(1_700_000_000_000);
const T1 = timestamp(1_700_000_060_000);
const SESSION = asId<'Session'>('sess-1') as SessionId;
const HAND = asId<'Hand'>('hand-fixture-1') as HandId;

describe('hand persistence', () => {
  let handle: DatabaseHandle;
  beforeEach(() => {
    handle = openTestDatabase();
    for (const seat of [0, 1, 2, 3] as const) {
      unwrap(
        insertPlayer(
          handle.db,
          unwrap(
            createPlayer({
              id: asId<'Player'>(`seat-${seat}`) as PlayerId,
              nickname: `Seat ${seat}`,
              createdAt: T0,
            }),
          ),
        ),
      );
    }
    unwrap(
      insertSession(handle.db, {
        id: SESSION,
        label: null,
        presetId: null,
        table: buildTable(),
        createdAt: T0,
        updatedAt: T0,
        closedAt: null,
        autoTopUp: null,
      }),
    );
    return () => handle.close();
  });

  it('the fixture exercises every Phase-2 addition to the event shape', () => {
    const hand = buildFixtureHand();
    const kinds = hand.events.map((event) => event.kind);
    expect(kinds).toContain('POST_DEAD_BLIND');
    const started = hand.events[0];
    expect(started?.kind === 'HAND_STARTED' && started.blindOverride).toEqual({
      smallBlindSeat: 2,
      bigBlindSeat: 3,
    });
    const awarded = hand.events.find((event) => event.kind === 'POT_AWARDED');
    expect(awarded?.kind === 'POT_AWARDED' && awarded.rake).toBeGreaterThan(0);
    expect(awarded?.kind === 'POT_AWARDED' && awarded.fee).toBe(FIXTURE_FEE);
    const finished = hand.events.at(-1);
    expect(finished?.kind === 'HAND_FINISHED' && finished.totalFees).toBe(FIXTURE_FEE);
    expect(hand.state.phase).toBe('COMPLETE');
  });

  it('writes a hand and reproduces the SAME HandState on load', () => {
    const hand = buildFixtureHand();
    unwrap(handRepository.insertHand(handle.db, { sessionId: SESSION, hand, startedAt: T0 }));

    const loaded = handRepository.loadStoredHand(handle.db, HAND);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.events).toEqual(hand.events);
    expect(loaded.value.state).toEqual(hand.state);
  });

  it('preserves rake, fee and every money value as EXACT integers', () => {
    const hand = buildFixtureHand();
    unwrap(handRepository.insertHand(handle.db, { sessionId: SESSION, hand, startedAt: T0 }));
    const loaded = unwrap(handRepository.loadStoredHand(handle.db, HAND));

    expect(loaded.state.potTotal).toBe(Money.mbb(7_640));
    expect(loaded.state.totalRake).toBe(Money.mbb(380));
    expect(loaded.state.totalFees).toBe(FIXTURE_FEE);
    expect(loaded.state.totalFees).not.toBe(loaded.state.totalRake);
    for (const value of [loaded.state.potTotal, loaded.state.totalRake, loaded.state.totalFees]) {
      expect(Number.isInteger(value)).toBe(true);
    }

    const award = loaded.state.awards[0];
    expect(award).toBeDefined();
    if (award === undefined) return;
    // `Money.sub`, not raw operators: money arithmetic never uses `-` (`CLAUDE.md` rule 1).
    expect(Money.sub(Money.sub(award.grossAmount, award.rake), award.fee)).toBe(award.netAmount);
    expect(award.netAmount).toBe(Money.mbb(7_060));

    // The starting stacks came back as exact integers too.
    const seats = unwrap(handRepository.listHandSeats(handle.db, HAND));
    expect(seats).toHaveLength(4);
    expect(seats[0]?.startingStack).toBe(BB(100));
    const raw = handle.sqlite
      .prepare(`select typeof(starting_stack) as t from hand_players limit 1`)
      .get() as { readonly t: string };
    expect(raw.t).toBe('integer');
  });

  it('survives the JSON round trip poker-core defines, from the rows actually stored', () => {
    const hand = buildFixtureHand();
    unwrap(handRepository.insertHand(handle.db, { sessionId: SESSION, hand, startedAt: T0 }));
    const events = unwrap(handRepository.loadHandEvents(handle.db, HAND));
    expect(jsonRoundTrip(events).ok).toBe(true);
  });

  it('appends events IN ORDER and refuses a gap, a repeat or a reorder', () => {
    const hand = buildFixtureHand();
    const head = hand.events.slice(0, 13);
    const tail = hand.events.slice(13);
    // The state is deliberately the COMPLETE one while only the head of the log is stored:
    // this exercises the append path, and the projections `insertHand` checks (`handId`,
    // `hand_number`) agree with `head[0]` regardless, because it is the same hand.
    unwrap(
      handRepository.insertHand(handle.db, {
        sessionId: SESSION,
        hand: { events: head, state: hand.state },
        startedAt: T0,
      }),
    );

    // A gap.
    const gap = handRepository.appendHandEvents(handle.db, HAND, tail.slice(1));
    expect(gap.ok).toBe(false);
    if (!gap.ok) expect(gap.error.code).toBe('CONFLICT');

    // A repeat of an already-stored seq.
    const repeat = handRepository.appendHandEvents(handle.db, HAND, head.slice(-1));
    expect(repeat.ok).toBe(false);
    if (!repeat.ok) expect(repeat.error.code).toBe('CONFLICT');

    // Out of order within the batch.
    const reordered = [...tail].reverse();
    const swapped = handRepository.appendHandEvents(handle.db, HAND, reordered);
    expect(swapped.ok).toBe(false);

    // Nothing partial was written by the rejected attempts.
    expect(handle.db.select().from(handEvents).all()).toHaveLength(head.length);

    // The correct continuation is accepted, and the whole hand loads.
    expect(unwrap(handRepository.appendHandEvents(handle.db, HAND, tail))).toBe(tail.length);
    const loaded = unwrap(handRepository.loadStoredHand(handle.db, HAND));
    expect(loaded.state).toEqual(hand.state);
  });

  it('refuses a header whose hand_number disagrees with the log HAND_STARTED', () => {
    const hand = buildFixtureHand();
    const started = hand.events[0];
    expect(started?.kind === 'HAND_STARTED' && started.handNumber).toBe(hand.state.handNumber);

    const forged = handRepository.insertHand(handle.db, {
      sessionId: SESSION,
      // The log is untouched; only the caller-supplied projection source is wrong.
      hand: { events: hand.events, state: { ...hand.state, handNumber: 99 } },
      startedAt: T0,
    });
    expect(forged.ok).toBe(false);
    if (!forged.ok) {
      expect(forged.error.code).toBe('INVALID_INPUT');
      expect(forged.error.context.field).toBe('hand_number');
    }
    // Nothing was written, so the disagreement never reached a row.
    expect(handle.db.select().from(handEvents).all()).toHaveLength(0);
    expect(unwrap(handRepository.listHandsForSession(handle.db, SESSION))).toHaveLength(0);
  });

  it('rejects appending to a hand that does not exist', () => {
    const hand = buildFixtureHand();
    const missing = handRepository.appendHandEvents(
      handle.db,
      asId<'Hand'>('nope') as HandId,
      hand.events,
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('NOT_FOUND');
  });

  it('records the dealt-in seats as a projection, with the log staying authoritative', () => {
    const hand = buildFixtureHand();
    unwrap(handRepository.insertHand(handle.db, { sessionId: SESSION, hand, startedAt: T0 }));
    const seats = unwrap(handRepository.listHandSeats(handle.db, HAND));
    expect(seats.map((seat) => seat.seat)).toEqual([0, 1, 2, 3]);
    expect(seats.map((seat) => seat.playerId)).toEqual(['seat-0', 'seat-1', 'seat-2', 'seat-3']);
  });

  it('lists a session hands in play order, and marks a hand finished', () => {
    const hand = buildFixtureHand();
    unwrap(handRepository.insertHand(handle.db, { sessionId: SESSION, hand, startedAt: T0 }));

    // A DIFFERENT hand id at the SAME hand number: the unique index must bite.
    const second = buildFixtureHand(buildTable(), 'hand-fixture-2');
    const collision = handRepository.insertHand(handle.db, {
      sessionId: SESSION,
      hand: second,
      startedAt: T1,
    });
    expect(collision.ok).toBe(false);
    if (!collision.ok) expect(collision.error.code).toBe('CONSTRAINT_VIOLATION');

    const listed = unwrap(handRepository.listHandsForSession(handle.db, SESSION));
    expect(listed.map((row) => row.id)).toEqual([HAND]);
    expect(listed[0]?.finishedAt).toBeNull();

    unwrap(handRepository.markHandFinished(handle.db, HAND, T1));
    const finished = unwrap(handRepository.listHandsForSession(handle.db, SESSION));
    expect(finished[0]?.finishedAt).toBe(T1);
  });

  it('reports a corrupt row when a meta column disagrees with the stored payload', () => {
    const hand = buildFixtureHand();
    unwrap(handRepository.insertHand(handle.db, { sessionId: SESSION, hand, startedAt: T0 }));
    handle.sqlite.prepare(`update hand_events set origin = 'ENGINE' where seq = 12`).run();
    const loaded = handRepository.loadStoredHand(handle.db, HAND);
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.code).toBe('CORRUPT_ROW');
  });

  it('reports a corrupt row when a stored payload is not a valid event', () => {
    const hand = buildFixtureHand();
    unwrap(handRepository.insertHand(handle.db, { sessionId: SESSION, hand, startedAt: T0 }));
    handle.sqlite
      .prepare(`update hand_events set payload_json = '{"kind":"NOT_AN_EVENT"}' where seq = 5`)
      .run();
    const loaded = handRepository.loadStoredHand(handle.db, HAND);
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.code).toBe('CORRUPT_ROW');
  });

  it('refuses a hand whose session does not exist', () => {
    const hand = buildFixtureHand();
    const written = handRepository.insertHand(handle.db, {
      sessionId: asId<'Session'>('ghost') as SessionId,
      hand,
      startedAt: T0,
    });
    expect(written.ok).toBe(false);
    if (!written.ok) expect(written.error.code).toBe('CONSTRAINT_VIOLATION');
    // The failed transaction left nothing behind.
    expect(handle.db.select().from(handEvents).all()).toHaveLength(0);
  });
});
