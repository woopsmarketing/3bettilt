/**
 * The pure form -> `TableState` path. No React and no database is involved, which is the
 * point: every decision the setup screen makes is testable without rendering anything.
 */
import { describe, expect, it } from 'vitest';
import { Money, asId } from '@gto-self/shared';
import type { PlayerId } from '@gto-self/shared';
import { CP_NL50_6MAX_ANTE, SEAT_INDEXES } from '@gto-self/poker-core';
import type { SeatIndex } from '@gto-self/poker-core';
import type { SeatFormValue, SessionFormValue } from './contract.js';
import { buildSessionTable, emptySeatForm, initialSessionForm, planSession } from './plan.js';

const idFor = (seat: SeatIndex): PlayerId => asId<'Player'>(`player-${seat}`);

function seat(overrides: Partial<SeatFormValue> = {}): SeatFormValue {
  return { ...emptySeatForm(), occupancy: 'ACTIVE', nickname: 'x', stackText: '100', ...overrides };
}

/** Six ACTIVE seats, distinct nicknames, Hero at seat 0, button at seat 0. */
function validForm(overrides: Partial<SessionFormValue> = {}): SessionFormValue {
  return {
    presetId: CP_NL50_6MAX_ANTE.presetId,
    anteEnabled: true,
    label: 'Tuesday',
    buttonSeat: 0,
    autoTopUpEnabled: false,
    autoTopUpTargetText: '100',
    seats: SEAT_INDEXES.map((index) => seat({ nickname: `Villain ${index}`, isHero: index === 0 })),
    ...overrides,
  };
}

function withSeat(
  form: SessionFormValue,
  index: SeatIndex,
  patch: Partial<SeatFormValue>,
): SessionFormValue {
  return {
    ...form,
    seats: form.seats.map((value, i) => (i === index ? { ...value, ...patch } : value)),
  };
}

const fields = (issues: readonly { field: string }[]) => issues.map((i) => i.field);

describe('stack text at the money boundary', () => {
  it('converts entered BB text into integer milliBB', () => {
    const built = buildSessionTable(withSeat(validForm(), 2, { stackText: '93.701' }), idFor);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.table.seats[2].stack).toBe(93_701);
    expect(Number.isInteger(built.table.seats[2].stack)).toBe(true);
  });

  it('accepts the money forms `Money.parseBB` accepts', () => {
    for (const [text, milliBB] of [
      ['100', 100_000],
      ['.5', 500],
      ['2.37', 2_370],
      ['1,000', 1_000_000],
    ] as const) {
      const built = buildSessionTable(withSeat(validForm(), 1, { stackText: text }), idFor);
      expect(built.ok, text).toBe(true);
      if (built.ok) expect(built.table.seats[1].stack).toBe(milliBB);
    }
  });

  it('REJECTS garbage on the seat that owns it, not as "invalid form"', () => {
    const planned = planSession(withSeat(validForm(), 3, { stackText: 'abc' }));
    expect(planned.ok).toBe(false);
    if (planned.ok) return;
    expect(planned.issues).toHaveLength(1);
    expect(planned.issues[0]?.seat).toBe(3);
    expect(planned.issues[0]?.field).toBe('stackText');
    expect(planned.issues[0]?.message).toContain('not a number');
  });

  it('rejects more than milliBB precision and an out-of-range amount', () => {
    const tooPrecise = planSession(withSeat(validForm(), 0, { stackText: '1.2345' }));
    expect(tooPrecise.ok).toBe(false);
    if (!tooPrecise.ok) expect(tooPrecise.issues[0]?.message).toContain('3 decimal places');

    const tooBig = planSession(withSeat(validForm(), 0, { stackText: '99999999' }));
    expect(tooBig.ok).toBe(false);
    if (!tooBig.ok) expect(tooBig.issues[0]?.message).toContain('out of range');
  });

  it('NEVER rewrites the text it could not parse — the form value is returned untouched', () => {
    const form = withSeat(validForm(), 3, { stackText: '  1o0  ' });
    const planned = planSession(form);
    expect(planned.ok).toBe(false);
    // `planSession` is pure: the caller still holds exactly what the user typed.
    expect(form.seats[3]?.stackText).toBe('  1o0  ');
  });

  it('keeps a seat with a zero stack out of the table — the engine refuses it', () => {
    const built = buildSessionTable(withSeat(validForm(), 4, { stackText: '0' }), idFor);
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.issues[0]?.code).toBe('STACK_NOT_POSITIVE');
    expect(built.issues[0]?.seat).toBe(4);
  });
});

describe('planSession', () => {
  it('accepts a valid six-seat configuration', () => {
    const planned = planSession(validForm());
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.value.seats).toHaveLength(6);
    expect(planned.value.heroSeat).toBe(0);
    expect(planned.value.buttonSeat).toBe(0);
    expect(planned.value.label).toBe('Tuesday');
    expect(planned.value.config.ante.enabled).toBe(true);
    expect(planned.value.preset.presetId).toBe(CP_NL50_6MAX_ANTE.presetId);
    expect(planned.value.autoTopUp).toBeNull();
  });

  it('applies the ante toggle to the chosen preset', () => {
    const planned = planSession(validForm({ anteEnabled: false }));
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.value.config.ante.enabled).toBe(false);
    // ... and changes nothing else about the preset's money policy.
    expect(planned.value.config.rake).toEqual(CP_NL50_6MAX_ANTE.rake);
    expect(planned.value.config.ante.amount).toBe(CP_NL50_6MAX_ANTE.ante.amount);
  });

  it('reports EVERY problem at once, not just the first', () => {
    const form = withSeat(withSeat(validForm({ buttonSeat: null }), 1, { stackText: 'nope' }), 2, {
      nickname: '',
    });
    const planned = planSession(form);
    expect(planned.ok).toBe(false);
    if (planned.ok) return;
    expect(fields(planned.issues)).toEqual(
      expect.arrayContaining(['stackText', 'nickname', 'buttonSeat']),
    );
  });

  it('requires a Hero', () => {
    const form = { ...validForm(), seats: validForm().seats.map((s) => ({ ...s, isHero: false })) };
    const planned = planSession(form);
    expect(planned.ok).toBe(false);
    if (planned.ok) return;
    expect(planned.issues.some((i) => i.field === 'heroSeat')).toBe(true);
    expect(planned.issues.find((i) => i.field === 'heroSeat')?.message).toContain('Hero');
  });

  it('refuses TWO Heroes', () => {
    const planned = planSession(withSeat(validForm(), 3, { isHero: true }));
    expect(planned.ok).toBe(false);
    if (planned.ok) return;
    const hero = planned.issues.find((i) => i.field === 'heroSeat');
    expect(hero?.message).toContain('single seat');
    expect(hero?.message).toContain('4');
  });

  it('refuses a Hero who is sitting out', () => {
    const planned = planSession(withSeat(validForm(), 0, { occupancy: 'SITTING_OUT' }));
    expect(planned.ok).toBe(false);
    if (planned.ok) return;
    expect(planned.issues.some((i) => i.message.includes('Hero must be an active seat'))).toBe(
      true,
    );
  });

  it('refuses the same nickname at two seats, whatever the casing or spacing', () => {
    const planned = planSession(withSeat(validForm(), 4, { nickname: '  villain 0  ' }));
    expect(planned.ok).toBe(false);
    if (planned.ok) return;
    const clash = planned.issues.find((i) => i.field === 'nickname');
    expect(clash?.seat).toBe(4);
    expect(clash?.code).toBe('DUPLICATE_PLAYER');
    expect(clash?.message).toContain('seat 1');
  });

  it('refuses the same EXISTING player at two seats', () => {
    const form = withSeat(withSeat(validForm(), 0, { existingPlayerId: 'p-1' }), 5, {
      existingPlayerId: 'p-1',
    });
    const planned = planSession(form);
    expect(planned.ok).toBe(false);
    if (planned.ok) return;
    expect(planned.issues.find((i) => i.seat === 5)?.code).toBe('DUPLICATE_PLAYER');
  });

  it('requires a nickname on an occupied seat but ignores one on an EMPTY seat', () => {
    const blank = planSession(withSeat(validForm(), 2, { nickname: '   ' }));
    expect(blank.ok).toBe(false);
    if (!blank.ok) expect(blank.issues[0]?.code).toBe('EMPTY_NAME');

    const emptied = planSession(
      withSeat(validForm(), 2, { occupancy: 'EMPTY', nickname: 'left over', stackText: 'junk' }),
    );
    expect(emptied.ok).toBe(true);
    if (emptied.ok) expect(emptied.value.seats.map((s) => s.seat)).toEqual([0, 1, 3, 4, 5]);
  });

  it('collects an optional HUD reading and leaves the seat without one when it is blank', () => {
    const planned = planSession(
      withSeat(validForm(), 1, { hud: { VPIP: '24.5', PFR: '19' }, hudHandsText: '1240' }),
    );
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.value.seats[1]?.hud).toEqual([
      { key: 'VPIP', enteredText: '24.5' },
      { key: 'PFR', enteredText: '19' },
    ]);
    expect(planned.value.seats[1]?.hudHandSample).toBe(1240);
    expect(planned.value.seats[0]?.hud).toEqual([]);
    expect(planned.value.seats[0]?.hudHandSample).toBeNull();
  });

  it('stores an auto top-up policy only when it is switched on', () => {
    const off = planSession(validForm({ autoTopUpEnabled: false, autoTopUpTargetText: 'junk' }));
    expect(off.ok).toBe(true);
    if (off.ok) expect(off.value.autoTopUp).toBeNull();

    const on = planSession(validForm({ autoTopUpEnabled: true, autoTopUpTargetText: '100' }));
    expect(on.ok).toBe(true);
    if (on.ok) {
      expect(on.value.autoTopUp).toEqual({
        enabled: true,
        targetStack: Money.mbb(100_000),
        threshold: Money.mbb(100_000),
      });
    }

    const bad = planSession(validForm({ autoTopUpEnabled: true, autoTopUpTargetText: 'junk' }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(fields(bad.issues)).toContain('autoTopUpTargetText');
  });

  it('rejects an unknown preset', () => {
    const planned = planSession(validForm({ presetId: 'NOT_A_PRESET' }));
    expect(planned.ok).toBe(false);
    if (!planned.ok) expect(fields(planned.issues)).toContain('presetId');
  });
});

describe('buildTableState', () => {
  it('produces a table the engine accepts, with occupancy, Hero and button applied', () => {
    const form = withSeat(withSeat(validForm(), 3, { occupancy: 'SITTING_OUT' }), 5, {
      occupancy: 'EMPTY',
    });
    const built = buildSessionTable(form, idFor);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.table.seats[0].occupancy).toBe('ACTIVE');
    expect(built.table.seats[3].occupancy).toBe('SITTING_OUT');
    expect(built.table.seats[3].playerId).toBe('player-3');
    expect(built.table.seats[3].stack).toBe(100_000);
    expect(built.table.seats[5].occupancy).toBe('EMPTY');
    expect(built.table.seats[5].playerId).toBeNull();
    expect(built.table.seats[5].stack).toBe(0);
    expect(built.table.heroSeat).toBe(0);
    expect(built.table.buttonSeat).toBe(0);
    expect(built.table.handNumber).toBe(0);
  });

  it("surfaces the ENGINE's own error when fewer than two seats are dealt in", () => {
    const form: SessionFormValue = {
      ...validForm(),
      seats: SEAT_INDEXES.map((index) =>
        index === 0
          ? seat({ nickname: 'Hero', isHero: true })
          : { ...emptySeatForm(), occupancy: 'EMPTY' as const },
      ),
    };
    const built = buildSessionTable(form, idFor);
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.issues[0]?.code).toBe('NOT_ENOUGH_PLAYERS');
    expect(built.issues[0]?.message).toContain('two');
  });

  it('refuses a button on a seat that is sitting out, with the engine saying so', () => {
    const built = buildSessionTable(
      { ...withSeat(validForm(), 2, { occupancy: 'SITTING_OUT' }), buttonSeat: 2 },
      idFor,
    );
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.issues[0]?.field).toBe('buttonSeat');
  });
});

describe('initialSessionForm', () => {
  it('opens on the preset with every stack pre-filled as TEXT', () => {
    const form = initialSessionForm(CP_NL50_6MAX_ANTE);
    expect(form.presetId).toBe(CP_NL50_6MAX_ANTE.presetId);
    expect(form.anteEnabled).toBe(true);
    expect(form.seats).toHaveLength(6);
    expect(form.seats.every((s) => s.stackText === '100')).toBe(true);
    expect(form.seats.filter((s) => s.isHero)).toHaveLength(1);
  });

  it('is not yet valid: it has no nicknames', () => {
    expect(planSession(initialSessionForm(CP_NL50_6MAX_ANTE)).ok).toBe(false);
  });
});
