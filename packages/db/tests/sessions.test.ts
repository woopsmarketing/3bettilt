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
const SESSION = asId<'Session'>('sess-1') as SessionId;

/** A deliberately awkward exact integer: it must come back unchanged, not as a float. */
const ODD_STACK = Money.mbb(93_701);

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
});
