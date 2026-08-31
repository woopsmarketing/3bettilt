/**
 * C0 — durable raw history for COMPLETED hands (ADR-0059, ADR-0060; prompt §5-§9, §36).
 *
 * The properties under test are the ones the whole milestone rests on:
 *
 * 1. A finished hand is written EXACTLY ONCE, header + lineup + every event, in one
 *    transaction, and a second call writes NOTHING and says so.
 * 2. What comes back out IS the hand that went in — the same ordered log, the same folded
 *    `HandState`, the same integer money, the same cards, and no cards that were never
 *    entered.
 * 3. An unfinished hand is refused rather than stored as a plausible complete one.
 * 4. Stored history cannot be rewritten, by any route, once it is finished.
 *
 * The showdown fixture carries a hero holding, a real SHOW, a MUCK, a split award, an
 * uncalled return, two pots and both a rake and a fee — a schema or a code path that
 * silently drops one of those fails here rather than in a player model six weeks later.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  asId,
  parseCards,
  unwrap,
  type HandId,
  type PlayerId,
  type SessionId,
} from '@gto-self/shared';
import type { Hand } from '@gto-self/poker-core';
import { createPlayer, timestamp } from '@gto-self/player-core';
import * as handRepository from '../src/repositories/hands.js';
import { insertSession } from '../src/repositories/sessions.js';
import { insertPlayer } from '../src/repositories/players.js';
import { openTestDatabase, type DatabaseHandle } from '../src/index.js';
import { handEvents, handPlayers, hands } from '../src/index.js';
import {
  buildFixtureHand,
  buildShowdownFixtureHand,
  buildShowdownTable,
  buildTable,
  FIXTURE_FEE,
  SHOWDOWN_HERO_CARDS,
  SHOWDOWN_SHOWN_CARDS,
  withoutInsertOnlyGuards,
} from './fixture.js';

const T0 = timestamp(1_700_000_000_000);
const T1 = timestamp(1_700_000_060_000);
const T2 = timestamp(1_700_000_120_000);
const SESSION = asId<'Session'>('sess-1') as SessionId;
const OTHER_SESSION = asId<'Session'>('sess-2') as SessionId;
const SHOWDOWN = asId<'Hand'>('hand-showdown-1') as HandId;
const SEAT = (n: number): PlayerId => asId<'Player'>(`seat-${n}`) as PlayerId;

/** SQLite reports an aborted trigger with the RAISE message, not a constraint marker. */
const IMMUTABLE = /is insert-only|is immutable/u;

describe('completed hand persistence', () => {
  let handle: DatabaseHandle;

  beforeEach(() => {
    handle = openTestDatabase();
    for (const seat of [0, 1, 2, 3] as const) {
      unwrap(
        insertPlayer(
          handle.db,
          unwrap(createPlayer({ id: SEAT(seat), nickname: `Seat ${seat}`, createdAt: T0 })),
        ),
      );
    }
    for (const [id, table] of [
      [SESSION, buildShowdownTable()],
      [OTHER_SESSION, buildTable()],
    ] as const) {
      unwrap(
        insertSession(handle.db, {
          id,
          label: null,
          presetId: null,
          table,
          createdAt: T0,
          updatedAt: T0,
          closedAt: null,
          autoTopUp: null,
          seatAutoTopUp: {},
        }),
      );
    }
    return () => handle.close();
  });

  const persist = (
    hand = buildShowdownFixtureHand(),
    sessionId: SessionId = SESSION,
  ): handRepository.InsertCompletedHandResult =>
    unwrap(
      handRepository.insertCompletedHand(handle.db, {
        sessionId,
        hand,
        startedAt: T0,
        finishedAt: T1,
      }),
    );

  // -------------------------------------------------------------------------
  // exactly once
  // -------------------------------------------------------------------------

  it('persists a completed hand exactly once: header, lineup and every event', () => {
    const hand = buildShowdownFixtureHand();
    const written = persist(hand);
    expect(written).toEqual({ handId: SHOWDOWN, outcome: 'PERSISTED' });

    const header = unwrap(handRepository.getHand(handle.db, SHOWDOWN));
    expect(header).toEqual({
      id: SHOWDOWN,
      sessionId: SESSION,
      handNumber: hand.state.handNumber,
      startedAt: T0,
      // `finished_at` is set in the SAME transaction as the events (ADR-0059g).
      finishedAt: T1,
      source: 'MANUAL_PRACTICE',
      schemaVersion: 1,
    });
    expect(handle.db.select().from(handEvents).all()).toHaveLength(hand.events.length);
    expect(handle.db.select().from(handPlayers).all()).toHaveLength(4);
  });

  it('a duplicate completion callback writes NOTHING and reports ALREADY_PERSISTED', () => {
    const hand = buildShowdownFixtureHand();
    expect(persist(hand).outcome).toBe('PERSISTED');
    const rowsAfterFirst = handle.db.select().from(handEvents).all();

    // Every one of these is a real cause in prompt §9: a re-render, a double-fired effect,
    // a repeated click, a retry. All of them must converge, not accumulate.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const again = unwrap(
        handRepository.insertCompletedHand(handle.db, {
          sessionId: SESSION,
          hand,
          startedAt: T0,
          finishedAt: T2,
        }),
      );
      expect(again).toEqual({ handId: SHOWDOWN, outcome: 'ALREADY_PERSISTED' });
    }

    expect(handle.db.select().from(hands).all()).toHaveLength(1);
    expect(handle.db.select().from(handPlayers).all()).toHaveLength(4);
    // Byte-identical rows: the no-op did not even rewrite `finished_at` to T2.
    expect(handle.db.select().from(handEvents).all()).toEqual(rowsAfterFirst);
    expect(unwrap(handRepository.getHand(handle.db, SHOWDOWN))?.finishedAt).toBe(T1);
  });

  it('distinguishes a benign duplicate from a DIFFERENT hand wearing the same id', () => {
    persist();
    // The same id, the same session, but a different hand: the cheap integrity probe
    // (session, hand_number, event count) is what tells these apart, and it must not
    // report the collision as a harmless duplicate.
    const impostor = buildFixtureHand(buildTable(), 'hand-showdown-1');
    const conflict = handRepository.insertCompletedHand(handle.db, {
      sessionId: SESSION,
      hand: impostor,
      startedAt: T0,
      finishedAt: T1,
    });
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) {
      expect(conflict.error.code).toBe('CONFLICT');
      expect(conflict.error.context.field).toBe('seq');
    }
    // ... and one in a different session under the same id is a conflict too.
    const elsewhere = handRepository.insertCompletedHand(handle.db, {
      sessionId: OTHER_SESSION,
      hand: buildShowdownFixtureHand(),
      startedAt: T0,
      finishedAt: T1,
    });
    expect(elsewhere.ok).toBe(false);
    if (!elsewhere.ok) expect(elsewhere.error.context.field).toBe('session_id');

    // The stored hand is untouched by either attempt.
    expect(unwrap(handRepository.loadStoredHand(handle.db, SHOWDOWN)).events).toEqual(
      buildShowdownFixtureHand().events,
    );
  });

  it('REFUSES a hand that has not finished, and writes nothing', () => {
    const hand = buildShowdownFixtureHand();
    // The log truncated one command short of the award: settlement has not happened, so
    // rake, fee and the winners are not yet facts (prompt §5).
    const unfinished = {
      events: hand.events.slice(0, -3),
      state: { ...hand.state, phase: 'BETTING' as const },
    };
    const refused = handRepository.insertCompletedHand(handle.db, {
      sessionId: SESSION,
      hand: unfinished,
      startedAt: T0,
      finishedAt: T1,
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe('INVALID_INPUT');
    expect(handle.db.select().from(hands).all()).toEqual([]);
    expect(handle.db.select().from(handEvents).all()).toEqual([]);

    // A COMPLETE state whose log does not actually end in HAND_FINISHED is refused too:
    // the log is authoritative, not the caller's claim about it (ADR-0039).
    const forged = handRepository.insertCompletedHand(handle.db, {
      sessionId: SESSION,
      hand: { events: hand.events.slice(0, -1), state: hand.state },
      startedAt: T0,
      finishedAt: T1,
    });
    expect(forged.ok).toBe(false);
    if (!forged.ok) expect(forged.error.code).toBe('INVALID_INPUT');
    expect(handle.db.select().from(handEvents).all()).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // round trip
  // -------------------------------------------------------------------------

  it('reconstructs an EQUIVALENT final hand: the same ordered log and the same state', () => {
    const hand = buildShowdownFixtureHand();
    persist(hand);
    const loaded = unwrap(handRepository.loadStoredHand(handle.db, SHOWDOWN));
    expect(loaded.events).toEqual(hand.events);
    expect(loaded.state).toEqual(hand.state);
    expect(loaded.state.phase).toBe('COMPLETE');
  });

  it('preserves the event SEQUENCE ORDER, including the stored `seq` column', () => {
    const hand = buildShowdownFixtureHand();
    persist(hand);
    const events = unwrap(handRepository.loadHandEvents(handle.db, SHOWDOWN));
    expect(events.map((event) => event.seq)).toEqual(hand.events.map((event) => event.seq));
    expect(events.map((event) => event.kind)).toEqual(hand.events.map((event) => event.kind));
    expect(events.map((event) => event.commandSeq)).toEqual(
      hand.events.map((event) => event.commandSeq),
    );

    // The ordering key really is stored, dense from 0 — not an artifact of insertion order.
    const stored = handle.sqlite
      .prepare(`select seq, kind from hand_events where hand_id = ? order by rowid desc`)
      .all(SHOWDOWN) as readonly { readonly seq: number; readonly kind: string }[];
    expect([...stored].map((row) => row.seq).sort((a, b) => a - b)).toEqual(
      hand.events.map((event) => event.seq),
    );
  });

  it('preserves hero hole cards and a revealed SHOW exactly, and invents none for a MUCK', () => {
    persist();
    const loaded = unwrap(handRepository.loadStoredHand(handle.db, SHOWDOWN));
    const holdings = loaded.events.filter((event) => event.kind === 'HOLE_CARDS_SET');

    expect(holdings).toHaveLength(2);
    const hero = holdings.find((event) => event.seat === 0);
    expect(hero?.cards).toEqual(unwrap(parseCards(SHOWDOWN_HERO_CARDS)));
    // Hero's own entry is NOT a reveal, and that distinction survives the round trip.
    expect(hero?.revealed).toBe(false);

    const shown = holdings.find((event) => event.seat === 2);
    expect(shown?.cards).toEqual(unwrap(parseCards(SHOWDOWN_SHOWN_CARDS)));
    expect(shown?.revealed).toBe(true);

    // Seat 3 was all-in AT SHOWDOWN and mucked. ADR-0052: a muck carries no event, so there
    // is nothing to store and nothing to invent — for seat 3 or for the folded seat 1.
    expect(holdings.map((event) => event.seat)).toEqual([0, 2]);
    // No cards, not "cards we could not see": an empty holding, identical to the folded
    // seat's, is exactly what "unknown information" must look like after a reload.
    expect(loaded.state.seats[3].holeCards).toEqual([]);
    expect(loaded.state.seats[1].holeCards).toEqual([]);
    expect(loaded.state.seats[0].holeCards).toEqual(unwrap(parseCards(SHOWDOWN_HERO_CARDS)));
  });

  it('preserves split awards, uncalled returns, rake and fee as exact integers', () => {
    const hand = buildShowdownFixtureHand();
    persist(hand);
    const loaded = unwrap(handRepository.loadStoredHand(handle.db, SHOWDOWN));

    const returned = loaded.events.filter((event) => event.kind === 'RETURN_UNCALLED');
    expect(returned).toHaveLength(1);
    expect(returned[0]).toEqual(hand.events.find((event) => event.kind === 'RETURN_UNCALLED'));

    const awarded = loaded.events.filter((event) => event.kind === 'POT_AWARDED');
    expect(awarded).toHaveLength(2);
    expect(awarded).toEqual(hand.events.filter((event) => event.kind === 'POT_AWARDED'));
    const [main, side] = awarded;
    // A genuine SPLIT: one pot, two winners, one share each.
    expect(main?.kind === 'POT_AWARDED' && main.winners).toEqual([2, 3]);
    expect(main?.kind === 'POT_AWARDED' && main.shares).toHaveLength(2);
    expect(side?.kind === 'POT_AWARDED' && side.winners).toEqual([2]);

    for (const event of awarded) {
      if (event.kind !== 'POT_AWARDED') continue;
      expect(Number.isInteger(event.rake)).toBe(true);
      expect(Number.isInteger(event.fee)).toBe(true);
      for (const share of event.shares) expect(Number.isInteger(share.amount)).toBe(true);
    }

    const finished = loaded.events.at(-1);
    expect(finished?.kind === 'HAND_FINISHED' && finished.reason).toBe('SHOWDOWN');
    expect(finished?.kind === 'HAND_FINISHED' && finished.totalFees).toBe(FIXTURE_FEE);
    expect(loaded.state.totalRake).toBe(hand.state.totalRake);
    expect(loaded.state.totalFees).toBe(FIXTURE_FEE);
    expect(loaded.state.totalRake).toBeGreaterThan(0);
  });

  it('records the multiway lineup and the SHORT stack exactly as dealt in', () => {
    const hand = buildShowdownFixtureHand();
    persist(hand);
    const seats = unwrap(handRepository.listHandSeats(handle.db, SHOWDOWN));
    expect(seats.map((seat) => seat.seat)).toEqual([0, 1, 2, 3]);
    expect(seats.map((seat) => seat.playerId)).toEqual([SEAT(0), SEAT(1), SEAT(2), SEAT(3)]);
    expect(seats.map((seat) => seat.startingStack)).toEqual(
      hand.state.dealtInSeats.map((seat) => hand.state.seats[seat].startingStack),
    );
  });

  // -------------------------------------------------------------------------
  // immutability (ADR-0060)
  // -------------------------------------------------------------------------

  it('REFUSES every UPDATE and DELETE of a stored hand event, through the barrel or raw SQL', () => {
    persist();
    expect(() => handle.db.update(handEvents).set({ origin: 'ENGINE' }).run()).toThrow(IMMUTABLE);
    expect(() => handle.db.delete(handEvents).run()).toThrow(IMMUTABLE);
    expect(() => handle.sqlite.prepare(`update hand_events set payload_json = '{}'`).run()).toThrow(
      IMMUTABLE,
    );
    expect(() => handle.sqlite.prepare(`delete from hand_events`).run()).toThrow(IMMUTABLE);

    const hand = buildShowdownFixtureHand();
    expect(unwrap(handRepository.loadStoredHand(handle.db, SHOWDOWN)).events).toEqual(hand.events);
  });

  it('REFUSES every UPDATE and DELETE of the dealt-in lineup', () => {
    persist();
    expect(() => handle.db.update(handPlayers).set({ startingStack: 1 }).run()).toThrow(IMMUTABLE);
    expect(() => handle.db.delete(handPlayers).run()).toThrow(IMMUTABLE);
    expect(handle.db.select().from(handPlayers).all()).toHaveLength(4);
  });

  it('FREEZES a finished hand header, and refuses to delete any hand at all', () => {
    persist();
    expect(() => handle.db.update(hands).set({ handNumber: 99 }).run()).toThrow(IMMUTABLE);
    expect(() => handle.sqlite.prepare(`update hands set finished_at = null`).run()).toThrow(
      IMMUTABLE,
    );
    expect(() => handle.db.delete(hands).run()).toThrow(IMMUTABLE);
    // The DELETE never ran, so its CASCADE onto the log never ran either.
    expect(handle.db.select().from(handEvents).all().length).toBeGreaterThan(0);

    const rewrite = handRepository.markHandFinished(handle.db, SHOWDOWN, T2);
    expect(rewrite.ok).toBe(false);
    if (!rewrite.ok) expect(rewrite.error.message).toMatch(IMMUTABLE);
    expect(unwrap(handRepository.getHand(handle.db, SHOWDOWN))?.finishedAt).toBe(T1);
  });

  it('still allows an UNFINISHED header to be marked finished exactly once', () => {
    // The conditional half of the guard: ADR-0060 must not have broken the live-hand path a
    // later phase needs, or `markHandFinished` would be dead code shipped as a guarantee.
    const hand = buildFixtureHand();
    const id = asId<'Hand'>('hand-fixture-1') as HandId;
    unwrap(handRepository.insertHand(handle.db, { sessionId: OTHER_SESSION, hand, startedAt: T0 }));
    unwrap(handRepository.markHandFinished(handle.db, id, T1));
    expect(unwrap(handRepository.getHand(handle.db, id))?.finishedAt).toBe(T1);

    const second = handRepository.markHandFinished(handle.db, id, T2);
    expect(second.ok).toBe(false);
    expect(unwrap(handRepository.getHand(handle.db, id))?.finishedAt).toBe(T1);
  });

  // -------------------------------------------------------------------------
  // the analysis read surface
  // -------------------------------------------------------------------------

  it('lists a player COMPLETED hands across sessions, deterministically', () => {
    persist();
    // A second, unfinished hand in another session: not eligible history.
    unwrap(
      handRepository.insertHand(handle.db, {
        sessionId: OTHER_SESSION,
        hand: buildFixtureHand(),
        startedAt: T2,
      }),
    );

    const forSeat2 = unwrap(handRepository.listCompletedHandIdsForPlayer(handle.db, SEAT(2)));
    expect(forSeat2).toEqual([SHOWDOWN]);
    // Twice, byte-identically: a recomputation is identified by a hash over this list.
    expect(unwrap(handRepository.listCompletedHandIdsForPlayer(handle.db, SEAT(2)))).toEqual(
      forSeat2,
    );
    expect(
      unwrap(handRepository.listCompletedHandIdsForPlayer(handle.db, asId<'Player'>('ghost'))),
    ).toEqual([]);
  });

  it('lists a session COMPLETED headers and the players a run must recompute', () => {
    persist();
    unwrap(
      handRepository.insertHand(handle.db, {
        sessionId: OTHER_SESSION,
        hand: buildFixtureHand(),
        startedAt: T2,
      }),
    );

    expect(
      unwrap(handRepository.listCompletedHandsForSession(handle.db, SESSION)).map((row) => row.id),
    ).toEqual([SHOWDOWN]);
    // The unfinished hand's session yields nothing at all.
    expect(unwrap(handRepository.listCompletedHandsForSession(handle.db, OTHER_SESSION))).toEqual(
      [],
    );

    expect(
      unwrap(handRepository.listPlayerIdsWithCompletedHandsInSession(handle.db, SESSION)),
    ).toEqual([SEAT(0), SEAT(1), SEAT(2), SEAT(3)]);
    expect(
      unwrap(handRepository.listPlayerIdsWithCompletedHandsInSession(handle.db, OTHER_SESSION)),
    ).toEqual([]);
  });

  it('batch-loads hands in the ORDER REQUESTED and refuses an unfinished or unknown id', () => {
    const hand = buildShowdownFixtureHand();
    persist(hand);
    unwrap(
      handRepository.insertHand(handle.db, {
        sessionId: OTHER_SESSION,
        hand: buildFixtureHand(),
        startedAt: T2,
      }),
    );

    expect(unwrap(handRepository.loadCompletedHands(handle.db, []))).toEqual([]);
    const loaded = unwrap(handRepository.loadCompletedHands(handle.db, [SHOWDOWN, SHOWDOWN]));
    expect(loaded).toHaveLength(2);
    expect(loaded[0]?.state).toEqual(hand.state);

    // A shorter list than was asked for would silently produce a plausible, wrong model.
    const unfinished = handRepository.loadCompletedHands(handle.db, [
      SHOWDOWN,
      asId<'Hand'>('hand-fixture-1') as HandId,
    ]);
    expect(unfinished.ok).toBe(false);
    if (!unfinished.ok) expect(unfinished.error.context.field).toBe('finished_at');

    const missing = handRepository.loadCompletedHands(handle.db, [asId<'Hand'>('ghost') as HandId]);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('NOT_FOUND');
  });

  it('batch-loads a list far larger than SQLite bound-parameter ceiling', () => {
    persist();
    // `inArray` binds ONE parameter per id. Unchunked, a list this long is not a slow query
    // — it is a driver throw ("too many SQL variables"), i.e. the whole recomputation dies
    // (review R1/m5). ADR-0062b recomputes over ALL history, which grows without bound.
    //
    // The unknown id is FIRST so the presence probe — the only part that binds the ids — is
    // what is under test: the loop refuses at index 0 before decoding a single log, which
    // keeps this test about the ceiling and not about 33k fold operations.
    const oversized = [
      asId<'Hand'>('ghost') as HandId,
      ...Array.from({ length: 33_000 }, () => SHOWDOWN),
    ];
    const refused = handRepository.loadCompletedHands(handle.db, oversized);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe('NOT_FOUND');
  });

  it('reassembles chunked results in the ORDER REQUESTED, across chunk boundaries', () => {
    const showdown = buildShowdownFixtureHand();
    persist(showdown);
    const second = buildFixtureHand(buildTable(), 'hand-fixture-2');
    unwrap(
      handRepository.insertCompletedHand(handle.db, {
        sessionId: OTHER_SESSION,
        hand: second,
        startedAt: T0,
        finishedAt: T1,
      }),
    );

    // Long enough to span three chunks, and alternating so an off-by-one chunk boundary or
    // a per-chunk overwrite of the presence map shows up as a wrong id, not a wrong length.
    const requested = Array.from({ length: 1100 }, (_, index) =>
      index % 2 === 0 ? SHOWDOWN : (asId<'Hand'>('hand-fixture-2') as HandId),
    );
    const loaded = unwrap(handRepository.loadCompletedHands(handle.db, requested));
    expect(loaded.map((hand) => hand.state.handId)).toEqual(requested);
  });

  // -------------------------------------------------------------------------
  // the session's durable hand counter (review R1/B1)
  // -------------------------------------------------------------------------

  /**
   * A completed hand numbered `handNumber`, with its own id. `startHand` numbers a hand
   * `table.handNumber`; `sessions.hand_number` is the NEXT number, so a hand numbered `n`
   * leaves the counter at `n + 1`.
   */
  const numberedHand = (handNumber: number, handId: string): Hand =>
    buildShowdownFixtureHand({ ...buildShowdownTable(), handNumber }, handId);

  const sessionHandNumber = (id: SessionId = SESSION): number =>
    (
      handle.sqlite.prepare(`select hand_number as n from sessions where id = ?`).get(id) as {
        readonly n: number;
      }
    ).n;

  it('advances the session hand counter in the SAME transaction as the hand', () => {
    expect(sessionHandNumber()).toBe(0);
    persist(numberedHand(0, 'hand-n0'));
    expect(sessionHandNumber()).toBe(1);
    persist(numberedHand(1, 'hand-n1'));
    expect(sessionHandNumber()).toBe(2);
    // Only this session's counter moves.
    expect(sessionHandNumber(OTHER_SESSION)).toBe(0);
    expect(unwrap(handRepository.maxStoredHandNumber(handle.db, SESSION))).toBe(1);
    expect(unwrap(handRepository.maxStoredHandNumber(handle.db, OTHER_SESSION))).toBe(null);
  });

  it('never moves the session hand counter backwards', () => {
    persist(numberedHand(7, 'hand-n7'));
    expect(sessionHandNumber()).toBe(8);
    // A late-arriving lower number (a queued save from an earlier page life) stores, but it
    // must not reset the counter the NEXT hand will be numbered from.
    persist(numberedHand(3, 'hand-n3'));
    expect(sessionHandNumber()).toBe(8);
    expect(unwrap(handRepository.maxStoredHandNumber(handle.db, SESSION))).toBe(7);
  });

  it('refuses a DIFFERENT hand under a number this session already stored', () => {
    persist(numberedHand(1, 'hand-n1'));
    expect(sessionHandNumber()).toBe(2);
    // The exact second-tab / stale-counter case: a genuinely different hand, numbered 1
    // again. The id probe cannot see it (the id is new), so this must not slip through as a
    // raw UNIQUE driver message — and above all it is NOT `ALREADY_PERSISTED`.
    const collision = handRepository.insertCompletedHand(handle.db, {
      sessionId: SESSION,
      hand: numberedHand(1, 'hand-n1-other'),
      startedAt: T0,
      finishedAt: T1,
    });
    expect(collision.ok).toBe(false);
    if (!collision.ok) {
      expect(collision.error.code).toBe('CONFLICT');
      expect(collision.error.context.field).toBe('hand_number');
      expect(collision.error.context.actual).toBe('hand-n1');
    }
    // Nothing was written by the refusal, and the stored hand is untouched.
    expect(handle.db.select().from(hands).all()).toHaveLength(1);
    expect(sessionHandNumber()).toBe(2);
  });

  it('resuming from the stored high-water mark makes the next hand storable', () => {
    // The whole B1 scenario, at the repository level: three hands, then a "reload" that
    // reads the counter back and numbers the next hand from it.
    for (const n of [0, 1, 2]) persist(numberedHand(n, `hand-n${n}`));
    const mark = unwrap(handRepository.maxStoredHandNumber(handle.db, SESSION));
    expect(mark).toBe(2);
    const resumed = persist(numberedHand((mark ?? -1) + 1, 'hand-after-reload'));
    expect(resumed.outcome).toBe('PERSISTED');
    expect(sessionHandNumber()).toBe(4);
    expect(unwrap(handRepository.listCompletedHandsForSession(handle.db, SESSION))).toHaveLength(4);
  });

  // -------------------------------------------------------------------------
  // stored-representation metadata
  // -------------------------------------------------------------------------

  it('records the source and the stored-representation version, and rejects an unknown source', () => {
    persist();
    const stored = handle.sqlite
      .prepare(`select source, schema_version as v, typeof(schema_version) as t from hands`)
      .get() as { readonly source: string; readonly v: number; readonly t: string };
    expect(stored).toEqual({ source: 'MANUAL_PRACTICE', v: 1, t: 'integer' });

    // The enum is enforced by the DATABASE, not only by the type.
    withoutInsertOnlyGuards(handle, () => {
      expect(() => handle.sqlite.prepare(`update hands set source = 'SCRAPED'`).run()).toThrow(
        /CHECK constraint failed: hands_source/u,
      );
      expect(() => handle.sqlite.prepare(`update hands set schema_version = 0`).run()).toThrow(
        /CHECK constraint failed: hands_schema_version_positive/u,
      );
      expect(() => handle.sqlite.prepare(`update hands set schema_version = 1.5`).run()).toThrow(
        /CHECK constraint failed: hands_schema_version_positive/u,
      );
    });
  });

  it('accepts MANUAL_REVIEW as a source without changing anything else', () => {
    unwrap(
      handRepository.insertCompletedHand(handle.db, {
        sessionId: SESSION,
        hand: buildShowdownFixtureHand(),
        startedAt: T0,
        finishedAt: T1,
        source: 'MANUAL_REVIEW',
      }),
    );
    expect(unwrap(handRepository.getHand(handle.db, SHOWDOWN))?.source).toBe('MANUAL_REVIEW');
  });
});
