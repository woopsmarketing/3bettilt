/**
 * `game_presets`, `sessions` and `session_seats`.
 *
 * A session's configuration — including its `RakeConfig` and `FeeConfig` — must survive a
 * round trip byte for byte, because every money outcome in the hands it holds was computed
 * under exactly those numbers.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { asId, Money, unwrap, type PlayerId, type SessionId } from '@gto-self/shared';
import { createPlayer, timestamp } from '@gto-self/player-core';
import {
  createTable,
  seatPlayer,
  setButtonSeat,
  setHeroSeat,
  setSeatOccupancy,
} from '@gto-self/poker-core';
import * as sessionRepository from '../src/repositories/sessions.js';
import * as presetRepository from '../src/repositories/presets.js';
import { insertPlayer } from '../src/repositories/players.js';
import { openTestDatabase, type DatabaseHandle } from '../src/client.js';
import { sessionSeats } from '../src/schema.js';
import { MANUAL_FEE_PRESET } from './fixture.js';

const T0 = timestamp(1_700_000_000_000);
const T1 = timestamp(1_700_000_060_000);
const T2 = timestamp(1_700_000_120_000);
const SESSION = asId<'Session'>('sess-1') as SessionId;

/** A deliberately awkward exact integer: it must come back unchanged, not as a float. */
const ODD_STACK = Money.mbb(93_701);

/** The three players `beforeEach` inserts, as the seats below name them. */
const HERO = asId<'Player'>('seat-0') as PlayerId;
const VILLAIN_1 = asId<'Player'>('seat-1') as PlayerId;
const VILLAIN_2 = asId<'Player'>('seat-2') as PlayerId;

describe('presets and sessions', () => {
  let handle: DatabaseHandle;
  beforeEach(() => {
    handle = openTestDatabase();
    for (const seat of [0, 1, 2] as const) {
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
    return () => handle.close();
  });

  function buildSessionTable() {
    let table = unwrap(createTable(MANUAL_FEE_PRESET));
    table = unwrap(seatPlayer(table, 0, asId<'Player'>('seat-0') as PlayerId, ODD_STACK));
    table = unwrap(seatPlayer(table, 1, asId<'Player'>('seat-1') as PlayerId, Money.mbb(100_000)));
    table = unwrap(seatPlayer(table, 2, asId<'Player'>('seat-2') as PlayerId, Money.mbb(48_320)));
    table = unwrap(setSeatOccupancy(table, 2, 'SITTING_OUT'));
    table = unwrap(setButtonSeat(table, 0));
    return unwrap(setHeroSeat(table, 0));
  }

  it('round-trips a preset document through poker-core validation', () => {
    unwrap(presetRepository.insertPreset(handle.db, MANUAL_FEE_PRESET, T0));
    const loaded = presetRepository.getPreset(handle.db, MANUAL_FEE_PRESET.presetId);
    expect(loaded.ok && loaded.value?.config).toEqual(MANUAL_FEE_PRESET);
    expect(loaded.ok && loaded.value?.config.rake.quantum).toBe(20);
    expect(loaded.ok && loaded.value?.config.fee.triggerPolicy).toBe('MANUAL');

    const again = presetRepository.insertPreset(handle.db, MANUAL_FEE_PRESET, T0);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe('CONFLICT');
  });

  it('round-trips a session with its RakeConfig, FeeConfig, seats and EXACT integer stacks', () => {
    unwrap(presetRepository.insertPreset(handle.db, MANUAL_FEE_PRESET, T0));
    const table = buildSessionTable();
    unwrap(
      sessionRepository.insertSession(handle.db, {
        id: SESSION,
        label: 'Tuesday grind',
        presetId: MANUAL_FEE_PRESET.presetId,
        table,
        createdAt: T0,
        updatedAt: T0,
        closedAt: null,
        autoTopUp: null,
        seatAutoTopUp: {},
        seatStackUnverified: {},
      }),
    );

    const loaded = sessionRepository.getSession(handle.db, SESSION);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok || loaded.value === null) return;
    expect(loaded.value.table).toEqual(table);
    expect(loaded.value.table.config.rake).toEqual(MANUAL_FEE_PRESET.rake);
    expect(loaded.value.table.config.fee).toEqual(MANUAL_FEE_PRESET.fee);
    expect(loaded.value.table.seats[0].stack).toBe(ODD_STACK);
    expect(Number.isInteger(loaded.value.table.seats[0].stack)).toBe(true);
    expect(loaded.value.table.seats[2].occupancy).toBe('SITTING_OUT');
    expect(loaded.value.table.seats[3].occupancy).toBe('EMPTY');
    expect(loaded.value.table.seats[3].playerId).toBeNull();
    expect(loaded.value.table.buttonSeat).toBe(0);
    expect(loaded.value.table.heroSeat).toBe(0);

    // The stack really is an INTEGER in the column, not a float that rounded back.
    const raw = handle.sqlite
      .prepare(`select stack, typeof(stack) as t from session_seats where seat = 0`)
      .get() as { readonly stack: number; readonly t: string };
    expect(raw.t).toBe('integer');
    expect(raw.stack).toBe(93_701);
  });

  it('writes all six seat rows, so an empty seat is a fact rather than a missing row', () => {
    unwrap(
      sessionRepository.insertSession(handle.db, {
        id: SESSION,
        label: null,
        presetId: null,
        table: buildSessionTable(),
        createdAt: T0,
        updatedAt: T0,
        closedAt: null,
        autoTopUp: null,
        seatAutoTopUp: {},
        seatStackUnverified: {},
      }),
    );
    expect(handle.db.select().from(sessionSeats).all()).toHaveLength(6);
  });

  it('keeps its OWN config copy: editing the preset does not rewrite the session', () => {
    unwrap(presetRepository.insertPreset(handle.db, MANUAL_FEE_PRESET, T0));
    unwrap(
      sessionRepository.insertSession(handle.db, {
        id: SESSION,
        label: null,
        presetId: MANUAL_FEE_PRESET.presetId,
        table: buildSessionTable(),
        createdAt: T0,
        updatedAt: T0,
        closedAt: null,
        autoTopUp: null,
        seatAutoTopUp: {},
        seatStackUnverified: {},
      }),
    );
    unwrap(
      presetRepository.updatePreset(
        handle.db,
        { ...MANUAL_FEE_PRESET, rake: { ...MANUAL_FEE_PRESET.rake, numerator: 3 } },
        T1,
      ),
    );
    const loaded = sessionRepository.getSession(handle.db, SESSION);
    expect(loaded.ok && loaded.value?.table.config.rake.numerator).toBe(5);
    const preset = presetRepository.getPreset(handle.db, MANUAL_FEE_PRESET.presetId);
    expect(preset.ok && preset.value?.config.rake.numerator).toBe(3);
  });

  it('writes the table state back, and closes a session', () => {
    const table = buildSessionTable();
    unwrap(
      sessionRepository.insertSession(handle.db, {
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
    const advanced = { ...table, handNumber: 7, buttonSeat: 1 as const };
    unwrap(sessionRepository.updateSessionTable(handle.db, SESSION, advanced, T1));
    const loaded = sessionRepository.getSession(handle.db, SESSION);
    expect(loaded.ok && loaded.value?.table.handNumber).toBe(7);
    expect(loaded.ok && loaded.value?.table.buttonSeat).toBe(1);
    expect(loaded.ok && loaded.value?.updatedAt).toBe(T1);

    unwrap(sessionRepository.closeSession(handle.db, SESSION, T1));
    const closed = sessionRepository.getSession(handle.db, SESSION);
    expect(closed.ok && closed.value?.closedAt).toBe(T1);
    const open = sessionRepository.listSessions(handle.db, { includeClosed: false });
    expect(open.ok && open.value).toHaveLength(0);
  });

  /**
   * `closeSession` writes `closedAt` into `updated_at` as well. A backwards `updated_at` is
   * a typed error everywhere else in this phase (`player-core`'s `touch`,
   * `recordObservation`), and rewinding it would reorder this session against writes that
   * really did happen later.
   */
  it('refuses to move updated_at BACKWARDS when closing a session', () => {
    const table = buildSessionTable();
    unwrap(
      sessionRepository.insertSession(handle.db, {
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
    unwrap(sessionRepository.updateSessionTable(handle.db, SESSION, table, T1));

    const backwards = sessionRepository.closeSession(handle.db, SESSION, T0);
    expect(backwards.ok).toBe(false);
    if (!backwards.ok) {
      expect(backwards.error.code).toBe('INVALID_INPUT');
      expect(backwards.error.context.field).toBe('updated_at');
    }
    // Nothing was written: the session is still open at the later timestamp.
    const stillOpen = sessionRepository.getSession(handle.db, SESSION);
    expect(stillOpen.ok && stillOpen.value?.closedAt).toBeNull();
    expect(stillOpen.ok && stillOpen.value?.updatedAt).toBe(T1);

    // Closing AT the stored updated_at is fine — only moving backwards is refused.
    unwrap(sessionRepository.closeSession(handle.db, SESSION, T1));
    const closed = sessionRepository.getSession(handle.db, SESSION);
    expect(closed.ok && closed.value?.closedAt).toBe(T1);
  });

  it('reports NOT_FOUND when closing a session that does not exist', () => {
    const missing = sessionRepository.closeSession(
      handle.db,
      asId<'Session'>('ghost') as SessionId,
      T1,
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('NOT_FOUND');
  });

  it('refuses a seat pointing at a player that does not exist', () => {
    let table = unwrap(createTable(MANUAL_FEE_PRESET));
    table = unwrap(seatPlayer(table, 0, asId<'Player'>('ghost') as PlayerId, Money.mbb(1_000)));
    const written = sessionRepository.insertSession(handle.db, {
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
    });
    expect(written.ok).toBe(false);
    if (!written.ok) expect(written.error.code).toBe('CONSTRAINT_VIOLATION');
  });

  it('reports a corrupt row when the stored config is not a valid TableConfig', () => {
    unwrap(
      sessionRepository.insertSession(handle.db, {
        id: SESSION,
        label: null,
        presetId: null,
        table: buildSessionTable(),
        createdAt: T0,
        updatedAt: T0,
        closedAt: null,
        autoTopUp: null,
        seatAutoTopUp: {},
        seatStackUnverified: {},
      }),
    );
    handle.sqlite.prepare(`update sessions set config_json = '{"nope":1}'`).run();
    const loaded = sessionRepository.getSession(handle.db, SESSION);
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.code).toBe('CORRUPT_ROW');
  });
  /**
   * The auto top-up policy (Phase 4, migration `0002`). `threshold` has no column yet: it
   * is `targetStack` by construction, and a policy that disagrees is REFUSED rather than
   * written with the threshold dropped.
   */
  describe('auto top-up policy', () => {
    it('round-trips enabled + target stack, and re-derives threshold from the target', () => {
      const policy = {
        enabled: true,
        targetStack: Money.mbb(100_000),
        threshold: Money.mbb(100_000),
      };
      unwrap(
        sessionRepository.insertSession(handle.db, {
          id: SESSION,
          label: null,
          presetId: null,
          table: buildSessionTable(),
          createdAt: T0,
          updatedAt: T0,
          closedAt: null,
          autoTopUp: policy,
          seatAutoTopUp: {},
          seatStackUnverified: {},
        }),
      );
      const loaded = unwrap(sessionRepository.getSession(handle.db, SESSION));
      expect(loaded?.autoTopUp).toEqual(policy);

      const raw = handle.sqlite
        .prepare(
          `select auto_top_up_enabled as e, auto_top_up_target_stack as t, typeof(auto_top_up_target_stack) as ty from sessions where id = ?`,
        )
        .get(SESSION) as { readonly e: number; readonly t: number; readonly ty: string };
      expect(raw).toEqual({ e: 1, t: 100_000, ty: 'integer' });
    });

    it('round-trips a DISABLED policy as a stored fact, not as an absent one', () => {
      const policy = {
        enabled: false,
        targetStack: Money.mbb(50_000),
        threshold: Money.mbb(50_000),
      };
      unwrap(
        sessionRepository.insertSession(handle.db, {
          id: SESSION,
          label: null,
          presetId: null,
          table: buildSessionTable(),
          createdAt: T0,
          updatedAt: T0,
          closedAt: null,
          autoTopUp: policy,
          seatAutoTopUp: {},
          seatStackUnverified: {},
        }),
      );
      expect(unwrap(sessionRepository.getSession(handle.db, SESSION))?.autoTopUp).toEqual(policy);
    });

    it('stores NULL for both columns when the session records no policy', () => {
      unwrap(
        sessionRepository.insertSession(handle.db, {
          id: SESSION,
          label: null,
          presetId: null,
          table: buildSessionTable(),
          createdAt: T0,
          updatedAt: T0,
          closedAt: null,
          autoTopUp: null,
          seatAutoTopUp: {},
          seatStackUnverified: {},
        }),
      );
      expect(unwrap(sessionRepository.getSession(handle.db, SESSION))?.autoTopUp).toBeNull();
      const raw = handle.sqlite
        .prepare(
          `select auto_top_up_enabled as e, auto_top_up_target_stack as t from sessions where id = ?`,
        )
        .get(SESSION) as { readonly e: number | null; readonly t: number | null };
      expect(raw).toEqual({ e: null, t: null });
    });

    it('REFUSES a threshold that differs from the target rather than dropping it', () => {
      const written = sessionRepository.insertSession(handle.db, {
        id: SESSION,
        label: null,
        presetId: null,
        table: buildSessionTable(),
        createdAt: T0,
        updatedAt: T0,
        closedAt: null,
        autoTopUp: {
          enabled: true,
          targetStack: Money.mbb(100_000),
          threshold: Money.mbb(40_000),
        },
        seatAutoTopUp: {},
        seatStackUnverified: {},
      });
      expect(written.ok).toBe(false);
      if (!written.ok) expect(written.error.code).toBe('INVALID_INPUT');
      expect(handle.sqlite.prepare(`select count(*) as n from sessions`).get()).toEqual({ n: 0 });
    });

    it('REJECTS a fractional target stack AT THE CONSTRAINT', () => {
      unwrap(
        sessionRepository.insertSession(handle.db, {
          id: SESSION,
          label: null,
          presetId: null,
          table: buildSessionTable(),
          createdAt: T0,
          updatedAt: T0,
          closedAt: null,
          autoTopUp: null,
          seatAutoTopUp: {},
          seatStackUnverified: {},
        }),
      );
      expect(() =>
        handle.sqlite
          .prepare(
            `update sessions set auto_top_up_enabled = 1, auto_top_up_target_stack = 93701.5`,
          )
          .run(),
      ).toThrow(/CHECK constraint failed/u);
      // ... and a non-positive target, and a half-written pair.
      expect(() =>
        handle.sqlite
          .prepare(`update sessions set auto_top_up_enabled = 1, auto_top_up_target_stack = 0`)
          .run(),
      ).toThrow(/CHECK constraint failed/u);
      expect(() =>
        handle.sqlite.prepare(`update sessions set auto_top_up_enabled = 1`).run(),
      ).toThrow(/CHECK constraint failed/u);
      expect(() =>
        handle.sqlite.prepare(`update sessions set auto_top_up_enabled = 2`).run(),
      ).toThrow(/CHECK constraint failed/u);
    });

    it('refuses a HALF-WRITTEN pair at the constraint, not later at the decoder', () => {
      unwrap(
        sessionRepository.insertSession(handle.db, {
          id: SESSION,
          label: null,
          presetId: null,
          table: buildSessionTable(),
          createdAt: T0,
          updatedAt: T0,
          closedAt: null,
          autoTopUp: null,
          seatAutoTopUp: {},
          seatStackUnverified: {},
        }),
      );
      // `decodeAutoTopUp` also rejects a half-written pair, but a row that can never be
      // written is the stronger guarantee: assert the constraint is what stops it.
      const attempted = () =>
        handle.sqlite.prepare(`update sessions set auto_top_up_target_stack = 100000`).run();
      expect(attempted).toThrow(/CHECK constraint failed: sessions_auto_top_up_pair/u);
    });
  });

  /**
   * Per-seat policy (migration `0003`). Auto top-up is a SEAT preference: each occupied
   * seat carries its own on/off and its own target, seeded from the session default but
   * free to diverge from it. Same two columns, same `threshold = targetStack` rule.
   */
  describe('per-seat auto top-up policy', () => {
    const at = (targetStack: number, enabled = true) => ({
      enabled,
      targetStack: Money.mbb(targetStack),
      threshold: Money.mbb(targetStack),
    });

    function insert(seatAutoTopUp: Record<number, ReturnType<typeof at>> = {}) {
      return sessionRepository.insertSession(handle.db, {
        id: SESSION,
        label: null,
        presetId: null,
        table: buildSessionTable(),
        createdAt: T0,
        updatedAt: T0,
        closedAt: null,
        autoTopUp: at(100_000),
        seatAutoTopUp,
        seatStackUnverified: {},
      });
    }

    it("round-trips each seat's own policy beside — not inside — the table state", () => {
      unwrap(insert({ 0: at(100_000), 1: at(250_000), 2: at(50_000, false) }));
      const loaded = unwrap(sessionRepository.getSession(handle.db, SESSION));
      expect(loaded?.seatAutoTopUp).toEqual({
        0: at(100_000),
        1: at(250_000),
        2: at(50_000, false),
      });
      // The session-level default is a SEPARATE fact and is untouched by the seats.
      expect(loaded?.autoTopUp).toEqual(at(100_000));
      // And nothing about the policy leaked into `TableState`.
      expect(loaded?.table).toEqual(buildSessionTable());

      const raw = handle.sqlite
        .prepare(
          `select seat, auto_top_up_enabled as e, auto_top_up_target_stack as t,
                  typeof(auto_top_up_target_stack) as ty
             from session_seats order by seat`,
        )
        .all();
      expect(raw).toEqual([
        { seat: 0, e: 1, t: 100_000, ty: 'integer' },
        { seat: 1, e: 1, t: 250_000, ty: 'integer' },
        { seat: 2, e: 0, t: 50_000, ty: 'integer' },
        { seat: 3, e: null, t: null, ty: 'null' },
        { seat: 4, e: null, t: null, ty: 'null' },
        { seat: 5, e: null, t: null, ty: 'null' },
      ]);
    });

    it('a seat with no entry records NO policy, which is not the same as a disabled one', () => {
      unwrap(insert({ 1: at(100_000, false) }));
      const loaded = unwrap(sessionRepository.getSession(handle.db, SESSION));
      expect(loaded?.seatAutoTopUp).toEqual({ 1: at(100_000, false) });
      expect(loaded?.seatAutoTopUp[0]).toBeUndefined();
    });

    it('updates ONE seat and touches no other column and no other seat', () => {
      unwrap(insert({ 0: at(100_000), 1: at(100_000) }));
      unwrap(
        sessionRepository.updateSessionSeatAutoTopUp(handle.db, SESSION, 1, at(250_000, false)),
      );
      const loaded = unwrap(sessionRepository.getSession(handle.db, SESSION));
      expect(loaded?.seatAutoTopUp).toEqual({ 0: at(100_000), 1: at(250_000, false) });
      // Occupancy, player and STACK are the table's business and did not move.
      expect(loaded?.table).toEqual(buildSessionTable());
      // Neither did the session default or its timestamps.
      expect(loaded?.autoTopUp).toEqual(at(100_000));
      expect(loaded?.updatedAt).toBe(T0);
    });

    it('clears one seat back to no policy without disturbing its neighbour', () => {
      unwrap(insert({ 0: at(100_000), 1: at(100_000) }));
      unwrap(sessionRepository.updateSessionSeatAutoTopUp(handle.db, SESSION, 0, null));
      const loaded = unwrap(sessionRepository.getSession(handle.db, SESSION));
      expect(loaded?.seatAutoTopUp).toEqual({ 1: at(100_000) });
    });

    it('REFUSES a threshold that differs from the target, on insert and on update', () => {
      const bad = {
        enabled: true,
        targetStack: Money.mbb(100_000),
        threshold: Money.mbb(40_000),
      };
      const written = insert({ 2: bad });
      expect(written.ok).toBe(false);
      if (!written.ok) {
        expect(written.error.code).toBe('INVALID_INPUT');
        expect(written.error.context.table).toBe('session_seats');
        expect(written.error.context.expected).toBe('100000');
        expect(written.error.context.actual).toBe('40000');
      }
      // The refusal happens before the transaction opens: NOTHING was written.
      expect(handle.sqlite.prepare(`select count(*) as n from sessions`).get()).toEqual({ n: 0 });

      unwrap(insert());
      const updated = sessionRepository.updateSessionSeatAutoTopUp(handle.db, SESSION, 2, bad);
      expect(updated.ok).toBe(false);
      if (!updated.ok) expect(updated.error.code).toBe('INVALID_INPUT');
      expect(unwrap(sessionRepository.getSession(handle.db, SESSION))?.seatAutoTopUp).toEqual({});
    });

    it('reports NOT_FOUND for a session that does not exist, rather than affecting 0 rows', () => {
      const missing = sessionRepository.updateSessionSeatAutoTopUp(
        handle.db,
        asId<'Session'>('ghost') as SessionId,
        3,
        at(100_000),
      );
      expect(missing.ok).toBe(false);
      if (!missing.ok) expect(missing.error.code).toBe('NOT_FOUND');
    });

    it('reports NOT_FOUND for a seat row that is not there', () => {
      unwrap(insert());
      // All six rows always exist, so this can only happen to a database corrupted by
      // other means — and it must still be an error rather than a silent no-op.
      handle.sqlite.prepare(`delete from session_seats where seat = 5`).run();
      const missing = sessionRepository.updateSessionSeatAutoTopUp(handle.db, SESSION, 5, null);
      expect(missing.ok).toBe(false);
      if (!missing.ok) {
        expect(missing.error.code).toBe('NOT_FOUND');
        expect(missing.error.context.actual).toBe('5');
      }
    });

    it('REJECTS a bad per-seat value AT THE CONSTRAINT', () => {
      unwrap(insert());
      expect(() =>
        handle.sqlite
          .prepare(
            `update session_seats set auto_top_up_enabled = 1, auto_top_up_target_stack = 93701.5 where seat = 0`,
          )
          .run(),
      ).toThrow(/CHECK constraint failed: session_seats_auto_top_up_target_stack_range/u);
      expect(() =>
        handle.sqlite
          .prepare(`update session_seats set auto_top_up_enabled = 1 where seat = 0`)
          .run(),
      ).toThrow(/CHECK constraint failed: session_seats_auto_top_up_pair/u);
      expect(() =>
        handle.sqlite
          .prepare(
            `update session_seats set auto_top_up_enabled = 2, auto_top_up_target_stack = 100000 where seat = 0`,
          )
          .run(),
      ).toThrow(/CHECK constraint failed: session_seats_auto_top_up_enabled_boolean/u);
    });

    it('reports a corrupt row when a seat holds a HALF-WRITTEN policy', () => {
      unwrap(insert());
      handle.sqlite.prepare(`pragma ignore_check_constraints = ON`).run();
      handle.sqlite
        .prepare(`update session_seats set auto_top_up_enabled = 1 where seat = 0`)
        .run();
      handle.sqlite.prepare(`pragma ignore_check_constraints = OFF`).run();
      const loaded = sessionRepository.getSession(handle.db, SESSION);
      expect(loaded.ok).toBe(false);
      if (!loaded.ok) {
        expect(loaded.error.code).toBe('CORRUPT_ROW');
        expect(loaded.error.context.table).toBe('session_seats');
      }
    });
  });

  /**
   * The narrow between-hands seat writer. This is a MONEY WRITE PATH (`stack` is integer
   * milliBB), so each test below asserts not only what changed but what did NOT: the auto
   * top-up preference columns, the session's own config/hero/hand-number, and every other
   * session in the file.
   */
  describe('seat state (updateSessionSeats)', () => {
    const at = (targetStack: number) => ({
      enabled: true,
      targetStack: Money.mbb(targetStack),
      threshold: Money.mbb(targetStack),
    });
    const OTHER = asId<'Session'>('sess-2') as SessionId;

    function insert(id: SessionId = SESSION) {
      return sessionRepository.insertSession(handle.db, {
        id,
        label: null,
        presetId: null,
        table: buildSessionTable(),
        createdAt: T0,
        updatedAt: T0,
        closedAt: null,
        autoTopUp: at(100_000),
        seatAutoTopUp: { 0: at(100_000), 1: at(250_000) },
        seatStackUnverified: {},
      });
    }

    /** Every column of `session_seats`, raw, so nothing can hide behind the decoder. */
    const rawSeats = (id: string = SESSION) =>
      handle.sqlite
        .prepare(
          `select seat, occupancy, player_id, stack, typeof(stack) as stack_type,
                  auto_top_up_enabled as e, auto_top_up_target_stack as t
             from session_seats where session_id = ? order by seat`,
        )
        .all(id);

    it('writes occupancy, player and EXACT integer stack for several seats at once', () => {
      unwrap(insert());
      unwrap(
        sessionRepository.updateSessionSeats(
          handle.db,
          SESSION,
          [
            {
              seat: 0,
              occupancy: 'ACTIVE',
              playerId: HERO,
              stack: Money.mbb(41_337),
              stackUnverified: false,
            },
            {
              seat: 2,
              occupancy: 'ACTIVE',
              playerId: VILLAIN_2,
              stack: Money.mbb(150_000),
              stackUnverified: false,
            },
          ],
          T1,
        ),
      );

      const loaded = unwrap(sessionRepository.getSession(handle.db, SESSION));
      expect(loaded?.table.seats[0].stack).toBe(Money.mbb(41_337));
      expect(loaded?.table.seats[2].stack).toBe(Money.mbb(150_000));
      // Seat 2 was SITTING_OUT before this call.
      expect(loaded?.table.seats[2].occupancy).toBe('ACTIVE');
      // The seat nobody named is byte-identical.
      expect(loaded?.table.seats[1]).toEqual(buildSessionTable().seats[1]);
      expect(loaded?.updatedAt).toBe(T1);
      // Integer milliBB in an INTEGER column, not a REAL that happens to look right.
      expect(rawSeats().map((row) => (row as { stack_type: string }).stack_type)).toEqual(
        Array.from({ length: 6 }, () => 'integer'),
      );
    });

    it('NEVER touches the auto top-up columns, the config, the hero seat or the hand number', () => {
      unwrap(insert());
      const before = unwrap(sessionRepository.getSession(handle.db, SESSION));
      unwrap(
        sessionRepository.updateSessionSeats(
          handle.db,
          SESSION,
          [
            {
              seat: 1,
              occupancy: 'SITTING_OUT',
              playerId: VILLAIN_1,
              stack: Money.mbb(1),
              stackUnverified: false,
            },
          ],
          T1,
        ),
      );

      const after = unwrap(sessionRepository.getSession(handle.db, SESSION));
      // The per-seat PREFERENCE is not table state and must survive untouched.
      expect(after?.seatAutoTopUp).toEqual({ 0: at(100_000), 1: at(250_000) });
      expect(after?.autoTopUp).toEqual(at(100_000));
      expect(after?.table.config).toEqual(before?.table.config);
      expect(after?.table.heroSeat).toBe(before?.table.heroSeat);
      expect(after?.table.handNumber).toBe(before?.table.handNumber);
      expect(after?.table.buttonSeat).toBe(before?.table.buttonSeat);
      expect(after?.createdAt).toBe(T0);
    });

    /**
     * ADR-0078b. An unverified stack — a pre-hand figure nobody has confirmed since the hand
     * that disturbed it — was marked in memory only while the NUMBER was already persisted,
     * so a reload rendered unconfirmed money as confirmed money. The mark is a column now
     * (migration `0010`), and these are the three claims that make it worth having.
     */
    it('stores stack_unverified and reads it back, per seat and both ways', () => {
      unwrap(insert());
      // A brand-new session confirms every seat: the stacks came from the setup form.
      expect(unwrap(sessionRepository.getSession(handle.db, SESSION))?.seatStackUnverified).toEqual(
        {},
      );

      unwrap(
        sessionRepository.updateSessionSeats(
          handle.db,
          SESSION,
          [
            {
              seat: 0,
              occupancy: 'ACTIVE',
              playerId: HERO,
              stack: Money.mbb(93_701),
              stackUnverified: true,
            },
            {
              seat: 1,
              occupancy: 'ACTIVE',
              playerId: VILLAIN_1,
              stack: Money.mbb(50_000),
              stackUnverified: false,
            },
          ],
          T1,
        ),
      );

      const marked = unwrap(sessionRepository.getSession(handle.db, SESSION));
      expect(marked?.seatStackUnverified).toEqual({ 0: true });
      // The flag is about the stack; it does not change the stack.
      expect(marked?.table.seats[0].stack).toBe(Money.mbb(93_701));
      expect(marked?.table.seats[1].stack).toBe(Money.mbb(50_000));
      // Raw, so nothing hides behind the decoder: an INTEGER 1/0, not a REAL or a string.
      expect(
        handle.sqlite
          .prepare(
            `select seat, stack_unverified as u, typeof(stack_unverified) as t
               from session_seats where session_id = ? and seat in (0, 1) order by seat`,
          )
          .all(SESSION),
      ).toEqual([
        { seat: 0, u: 1, t: 'integer' },
        { seat: 1, u: 0, t: 'integer' },
      ]);

      // Stating the stack clears the mark — the same write, the other way round.
      unwrap(
        sessionRepository.updateSessionSeats(
          handle.db,
          SESSION,
          [
            {
              seat: 0,
              occupancy: 'ACTIVE',
              playerId: HERO,
              stack: Money.mbb(88_000),
              stackUnverified: false,
            },
          ],
          T2,
        ),
      );
      const cleared = unwrap(sessionRepository.getSession(handle.db, SESSION));
      expect(cleared?.seatStackUnverified).toEqual({});
      expect(cleared?.table.seats[0].stack).toBe(Money.mbb(88_000));
    });

    it('updateSessionSeatAutoTopUp and updateSessionSeatOccupancy NEVER touch stack_unverified', () => {
      unwrap(insert());
      unwrap(
        sessionRepository.updateSessionSeats(
          handle.db,
          SESSION,
          [
            {
              seat: 0,
              occupancy: 'ACTIVE',
              playerId: HERO,
              stack: Money.mbb(93_701),
              stackUnverified: true,
            },
          ],
          T1,
        ),
      );

      // Toggling a per-seat PREFERENCE must not silently confirm an unverified stack...
      unwrap(sessionRepository.updateSessionSeatAutoTopUp(handle.db, SESSION, 0, at(300_000)));
      expect(unwrap(sessionRepository.getSession(handle.db, SESSION))?.seatStackUnverified).toEqual(
        { 0: true },
      );
      unwrap(sessionRepository.updateSessionSeatAutoTopUp(handle.db, SESSION, 0, null));
      expect(unwrap(sessionRepository.getSession(handle.db, SESSION))?.seatStackUnverified).toEqual(
        { 0: true },
      );
      // ... and neither must sitting the seat out and back in.
      unwrap(sessionRepository.updateSessionSeatOccupancy(handle.db, SESSION, 0, 'SITTING_OUT'));
      unwrap(sessionRepository.updateSessionSeatOccupancy(handle.db, SESSION, 0, 'ACTIVE'));
      const after = unwrap(sessionRepository.getSession(handle.db, SESSION));
      expect(after?.seatStackUnverified).toEqual({ 0: true });
      expect(after?.table.seats[0].stack).toBe(Money.mbb(93_701));
    });

    it('a rolled-back seat write leaves stack_unverified as it was', () => {
      unwrap(insert());
      unwrap(
        sessionRepository.updateSessionSeats(
          handle.db,
          SESSION,
          [
            {
              seat: 0,
              occupancy: 'ACTIVE',
              playerId: HERO,
              stack: Money.mbb(93_701),
              stackUnverified: true,
            },
          ],
          T1,
        ),
      );
      // Seat 0 would clear its mark; seat 3 names a player that does not exist and throws
      // inside the same transaction, so neither lands.
      const refused = sessionRepository.updateSessionSeats(
        handle.db,
        SESSION,
        [
          {
            seat: 0,
            occupancy: 'ACTIVE',
            playerId: HERO,
            stack: Money.mbb(41_337),
            stackUnverified: false,
          },
          {
            seat: 3,
            occupancy: 'ACTIVE',
            playerId: asId<'Player'>('ghost') as PlayerId,
            stack: Money.mbb(100_000),
            stackUnverified: false,
          },
        ],
        T2,
      );
      expect(refused.ok).toBe(false);
      const after = unwrap(sessionRepository.getSession(handle.db, SESSION));
      expect(after?.seatStackUnverified).toEqual({ 0: true });
      expect(after?.table.seats[0].stack).toBe(Money.mbb(93_701));
    });

    it('leaves every OTHER session alone', () => {
      unwrap(insert());
      unwrap(insert(OTHER));
      const untouched = unwrap(sessionRepository.getSession(handle.db, OTHER));
      unwrap(
        sessionRepository.updateSessionSeats(
          handle.db,
          SESSION,
          [
            {
              seat: 0,
              occupancy: 'ACTIVE',
              playerId: HERO,
              stack: Money.mbb(7),
              stackUnverified: false,
            },
          ],
          T1,
        ),
      );
      expect(unwrap(sessionRepository.getSession(handle.db, OTHER))).toEqual(untouched);
    });

    it('reports NOT_FOUND for a session that does not exist, and writes nothing', () => {
      unwrap(insert());
      const missing = sessionRepository.updateSessionSeats(
        handle.db,
        asId<'Session'>('ghost') as SessionId,
        [
          {
            seat: 0,
            occupancy: 'ACTIVE',
            playerId: HERO,
            stack: Money.mbb(7),
            stackUnverified: false,
          },
        ],
        T1,
      );
      expect(missing.ok).toBe(false);
      if (!missing.ok) {
        expect(missing.error.code).toBe('NOT_FOUND');
        expect(missing.error.context.table).toBe('sessions');
      }
      expect(unwrap(sessionRepository.getSession(handle.db, SESSION))?.updatedAt).toBe(T0);
    });

    it('reports NOT_FOUND for a seat row that is not there, leaving the OTHER seats alone', () => {
      unwrap(insert());
      // All six rows always exist, so this can only happen to a database corrupted by other
      // means — and it must still refuse the WHOLE call rather than apply the seats it could.
      handle.sqlite.prepare(`delete from session_seats where seat = 5`).run();
      const missing = sessionRepository.updateSessionSeats(
        handle.db,
        SESSION,
        [
          {
            seat: 0,
            occupancy: 'ACTIVE',
            playerId: HERO,
            stack: Money.mbb(41_337),
            stackUnverified: false,
          },
          {
            seat: 5,
            occupancy: 'EMPTY',
            playerId: null,
            stack: Money.mbb(0),
            stackUnverified: false,
          },
        ],
        T1,
      );
      expect(missing.ok).toBe(false);
      if (!missing.ok) {
        expect(missing.error.code).toBe('NOT_FOUND');
        expect(missing.error.context.table).toBe('session_seats');
        expect(missing.error.context.actual).toBe('5');
      }
      // Seat 0 came FIRST in the list and still did not move: the check runs before the
      // first write.
      const seat0 = rawSeats()[0] as { stack: number };
      expect(seat0.stack).toBe(ODD_STACK);
      expect(
        (handle.sqlite.prepare(`select updated_at as u from sessions`).get() as { u: number }).u,
      ).toBe(T0);
    });

    it('ROLLS BACK every seat when the database refuses one of them', () => {
      unwrap(insert());
      const refused = sessionRepository.updateSessionSeats(
        handle.db,
        SESSION,
        [
          {
            seat: 0,
            occupancy: 'ACTIVE',
            playerId: HERO,
            stack: Money.mbb(41_337),
            stackUnverified: false,
          },
          // A negative stack is refused by `session_seats_stack_non_negative`. The CHECK is
          // the authority on a storable stack; this asserts the refusal is TOTAL.
          {
            seat: 1,
            occupancy: 'ACTIVE',
            playerId: VILLAIN_1,
            stack: Money.mbb(-1),
            stackUnverified: false,
          },
        ],
        T1,
      );
      expect(refused.ok).toBe(false);
      if (!refused.ok) {
        expect(refused.error.code).toBe('CONSTRAINT_VIOLATION');
        expect(refused.error.message).toMatch(/CHECK constraint failed/u);
      }
      const rows = rawSeats() as readonly { seat: number; stack: number }[];
      expect(rows[0]?.stack).toBe(ODD_STACK);
      expect(rows[1]?.stack).toBe(100_000);
      expect(
        (handle.sqlite.prepare(`select updated_at as u from sessions`).get() as { u: number }).u,
      ).toBe(T0);
    });

    it('ROLLS BACK when a seat names a player that does not exist', () => {
      unwrap(insert());
      const refused = sessionRepository.updateSessionSeats(
        handle.db,
        SESSION,
        [
          {
            seat: 0,
            occupancy: 'ACTIVE',
            playerId: HERO,
            stack: Money.mbb(41_337),
            stackUnverified: false,
          },
          {
            seat: 3,
            occupancy: 'ACTIVE',
            playerId: asId<'Player'>('ghost') as PlayerId,
            stack: Money.mbb(100_000),
            stackUnverified: false,
          },
        ],
        T1,
      );
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.error.code).toBe('CONSTRAINT_VIOLATION');
      expect((rawSeats()[0] as { stack: number }).stack).toBe(ODD_STACK);
      expect((rawSeats()[3] as { occupancy: string }).occupancy).toBe('EMPTY');
    });

    it('REFUSES a duplicate seat rather than resolving it last-write-wins', () => {
      unwrap(insert());
      const refused = sessionRepository.updateSessionSeats(
        handle.db,
        SESSION,
        [
          {
            seat: 0,
            occupancy: 'ACTIVE',
            playerId: HERO,
            stack: Money.mbb(41_337),
            stackUnverified: false,
          },
          {
            seat: 0,
            occupancy: 'ACTIVE',
            playerId: HERO,
            stack: Money.mbb(99_000),
            stackUnverified: false,
          },
        ],
        T1,
      );
      expect(refused.ok).toBe(false);
      if (!refused.ok) {
        expect(refused.error.code).toBe('INVALID_INPUT');
        expect(refused.error.context.actual).toBe('0');
      }
      // The refusal happens before the transaction opens: NOTHING was written.
      expect((rawSeats()[0] as { stack: number }).stack).toBe(ODD_STACK);
      expect(unwrap(sessionRepository.getSession(handle.db, SESSION))?.updatedAt).toBe(T0);
    });

    it('REFUSES an updatedAt that would move the session backwards', () => {
      unwrap(insert());
      unwrap(
        sessionRepository.updateSessionSeats(
          handle.db,
          SESSION,
          [
            {
              seat: 0,
              occupancy: 'ACTIVE',
              playerId: HERO,
              stack: Money.mbb(41_337),
              stackUnverified: false,
            },
          ],
          T1,
        ),
      );
      const backwards = sessionRepository.updateSessionSeats(
        handle.db,
        SESSION,
        [
          {
            seat: 0,
            occupancy: 'ACTIVE',
            playerId: HERO,
            stack: Money.mbb(1_000),
            stackUnverified: false,
          },
        ],
        T0,
      );
      expect(backwards.ok).toBe(false);
      if (!backwards.ok) {
        expect(backwards.error.code).toBe('INVALID_INPUT');
        expect(backwards.error.context.field).toBe('updated_at');
      }
      const loaded = unwrap(sessionRepository.getSession(handle.db, SESSION));
      expect(loaded?.table.seats[0].stack).toBe(Money.mbb(41_337));
      expect(loaded?.updatedAt).toBe(T1);
    });

    it('vacates a seat to EMPTY, and refuses an EMPTY seat that keeps chips', () => {
      unwrap(insert());
      unwrap(
        sessionRepository.updateSessionSeats(
          handle.db,
          SESSION,
          [
            {
              seat: 1,
              occupancy: 'EMPTY',
              playerId: null,
              stack: Money.mbb(0),
              stackUnverified: false,
            },
          ],
          T1,
        ),
      );
      const loaded = unwrap(sessionRepository.getSession(handle.db, SESSION));
      expect(loaded?.table.seats[1].occupancy).toBe('EMPTY');
      expect(loaded?.table.seats[1].playerId).toBeNull();
      expect(loaded?.table.seats[1].stack).toBe(Money.mbb(0));

      const refused = sessionRepository.updateSessionSeats(
        handle.db,
        SESSION,
        [
          {
            seat: 2,
            occupancy: 'EMPTY',
            playerId: null,
            stack: Money.mbb(48_320),
            stackUnverified: false,
          },
        ],
        T1,
      );
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.error.code).toBe('CONSTRAINT_VIOLATION');
    });

    it('writes nothing at all — not even updated_at — for an empty seat list', () => {
      unwrap(insert());
      unwrap(sessionRepository.updateSessionSeats(handle.db, SESSION, [], T1));
      expect(unwrap(sessionRepository.getSession(handle.db, SESSION))?.updatedAt).toBe(T0);
      // ... but a session that is not there is still NOT_FOUND, not a quiet success.
      const missing = sessionRepository.updateSessionSeats(
        handle.db,
        asId<'Session'>('ghost') as SessionId,
        [],
        T1,
      );
      expect(missing.ok).toBe(false);
      if (!missing.ok) expect(missing.error.code).toBe('NOT_FOUND');
    });
  });

  describe('button seat (updateSessionButtonSeat)', () => {
    function insert() {
      return sessionRepository.insertSession(handle.db, {
        id: SESSION,
        label: null,
        presetId: null,
        table: buildSessionTable(),
        createdAt: T0,
        updatedAt: T0,
        closedAt: null,
        autoTopUp: null,
        seatAutoTopUp: {},
        seatStackUnverified: {},
      });
    }

    it('moves the button and bumps updated_at, and nothing else moves', () => {
      unwrap(insert());
      const before = unwrap(sessionRepository.getSession(handle.db, SESSION));
      unwrap(sessionRepository.updateSessionButtonSeat(handle.db, SESSION, 1, T1));

      const after = unwrap(sessionRepository.getSession(handle.db, SESSION));
      expect(after?.table.buttonSeat).toBe(1);
      expect(after?.updatedAt).toBe(T1);
      // Designating the button is a CORRECTION, never a hand advance.
      expect(after?.table.handNumber).toBe(before?.table.handNumber);
      expect(after?.table.heroSeat).toBe(before?.table.heroSeat);
      expect(after?.table.seats).toEqual(before?.table.seats);
      expect(after?.table.config).toEqual(before?.table.config);
    });

    it('clears the button back to none', () => {
      unwrap(insert());
      unwrap(sessionRepository.updateSessionButtonSeat(handle.db, SESSION, null, T1));
      const loaded = unwrap(sessionRepository.getSession(handle.db, SESSION));
      expect(loaded?.table.buttonSeat).toBeNull();
    });

    it('reports NOT_FOUND for a session that does not exist', () => {
      const missing = sessionRepository.updateSessionButtonSeat(
        handle.db,
        asId<'Session'>('ghost') as SessionId,
        0,
        T1,
      );
      expect(missing.ok).toBe(false);
      if (!missing.ok) {
        expect(missing.error.code).toBe('NOT_FOUND');
        expect(missing.error.context.table).toBe('sessions');
      }
    });

    it('REFUSES an updatedAt that would move the session backwards, and writes nothing', () => {
      unwrap(insert());
      unwrap(sessionRepository.updateSessionButtonSeat(handle.db, SESSION, 1, T1));
      const backwards = sessionRepository.updateSessionButtonSeat(handle.db, SESSION, 2, T0);
      expect(backwards.ok).toBe(false);
      if (!backwards.ok) {
        expect(backwards.error.code).toBe('INVALID_INPUT');
        expect(backwards.error.context.field).toBe('updated_at');
      }
      const loaded = unwrap(sessionRepository.getSession(handle.db, SESSION));
      expect(loaded?.table.buttonSeat).toBe(1);
      expect(loaded?.updatedAt).toBe(T1);
    });
  });

  describe('seat occupancy (updateSessionSeatOccupancy)', () => {
    function insert() {
      return sessionRepository.insertSession(handle.db, {
        id: SESSION,
        label: null,
        presetId: null,
        table: buildSessionTable(),
        createdAt: T0,
        updatedAt: T0,
        closedAt: null,
        autoTopUp: null,
        seatAutoTopUp: {},
        seatStackUnverified: {},
      });
    }

    it('updates ONE seat and touches no other column, seat, or timestamp', () => {
      unwrap(insert());
      // `buildSessionTable` seats 0 ACTIVE, 1 ACTIVE, 2 SITTING_OUT.
      unwrap(sessionRepository.updateSessionSeatOccupancy(handle.db, SESSION, 0, 'SITTING_OUT'));

      const loaded = unwrap(sessionRepository.getSession(handle.db, SESSION));
      expect(loaded?.table.seats[0].occupancy).toBe('SITTING_OUT');
      // The player and the stack did not move.
      expect(loaded?.table.seats[0].playerId).toBe(asId<'Player'>('seat-0'));
      expect(loaded?.table.seats[0].stack).toBe(ODD_STACK);
      // The untouched neighbour, and the session's own timestamp, are exactly as inserted.
      expect(loaded?.table.seats[1].occupancy).toBe('ACTIVE');
      expect(loaded?.table.seats[2].occupancy).toBe('SITTING_OUT');
      expect(loaded?.updatedAt).toBe(T0);
    });

    it('brings a seat back ACTIVE', () => {
      unwrap(insert());
      unwrap(sessionRepository.updateSessionSeatOccupancy(handle.db, SESSION, 2, 'ACTIVE'));

      const loaded = unwrap(sessionRepository.getSession(handle.db, SESSION));
      expect(loaded?.table.seats[2].occupancy).toBe('ACTIVE');
    });

    it('reports NOT_FOUND for a session that does not exist, rather than affecting 0 rows', () => {
      const missing = sessionRepository.updateSessionSeatOccupancy(
        handle.db,
        asId<'Session'>('ghost') as SessionId,
        0,
        'SITTING_OUT',
      );
      expect(missing.ok).toBe(false);
      if (!missing.ok) expect(missing.error.code).toBe('NOT_FOUND');
    });

    it('reports NOT_FOUND for a seat row that is not there', () => {
      unwrap(insert());
      // All six rows always exist, so this can only happen to a database corrupted by
      // other means — and it must still be an error rather than a silent no-op.
      handle.sqlite.prepare(`delete from session_seats where seat = 5`).run();
      const missing = sessionRepository.updateSessionSeatOccupancy(handle.db, SESSION, 5, 'ACTIVE');
      expect(missing.ok).toBe(false);
      if (!missing.ok) {
        expect(missing.error.code).toBe('NOT_FOUND');
        expect(missing.error.context.actual).toBe('5');
      }
    });
  });
});
