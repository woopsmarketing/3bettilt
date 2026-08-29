import { describe, expect, it } from 'vitest';
import { unwrap } from '@gto-self/shared';
import { DEFAULT_RULE_OPTIONS } from './config.js';
import {
  assignBlinds,
  assignPositions,
  comparePositions,
  derivePositionLabels,
  postflopActionOrder,
  preflopActionOrder,
  type BlindAssignment,
  type BlindSeatOverride,
  type Position,
} from './positions.js';
import type { SeatIndex } from './seat.js';

const rules = DEFAULT_RULE_OPTIONS;

function lineup(dealtIn: readonly SeatIndex[], button: SeatIndex) {
  const blinds = unwrap(assignBlinds(dealtIn, button, rules));
  const positions = assignPositions(dealtIn, blinds, rules);
  const labelOf = (seat: SeatIndex): Position | null => positions[seat]?.position ?? null;
  return {
    blinds,
    positions,
    preflop: preflopActionOrder(dealtIn, blinds).map(labelOf),
    postflop: postflopActionOrder(dealtIn, blinds).map(labelOf),
    ring: dealtIn.map(labelOf),
  };
}

describe('blind assignment', () => {
  it('gives SB and BB to the two seats after the button when 3+ are dealt in', () => {
    const { blinds } = lineup([0, 1, 2, 3, 4, 5], 0);
    expect(blinds).toEqual({ buttonSeat: 0, smallBlindSeat: 1, bigBlindSeat: 2, headsUp: false });
  });

  it('wraps around gaps in the seating', () => {
    const { blinds } = lineup([1, 3, 4], 4);
    expect(blinds.smallBlindSeat).toBe(1);
    expect(blinds.bigBlindSeat).toBe(3);
  });

  it('heads-up, the button posts the small blind', () => {
    const { blinds } = lineup([2, 5], 5);
    expect(blinds).toEqual({ buttonSeat: 5, smallBlindSeat: 5, bigBlindSeat: 2, headsUp: true });
  });

  it('heads-up with the rule flipped, the button posts the big blind', () => {
    const flipped = { ...rules, headsUpButtonPostsSmallBlind: false };
    const blinds = unwrap(assignBlinds([2, 5], 5, flipped));
    expect(blinds.smallBlindSeat).toBe(2);
    expect(blinds.bigBlindSeat).toBe(5);
    expect(preflopActionOrder([2, 5], blinds)).toEqual([2, 5]);
  });

  it('rejects rosters it cannot seat', () => {
    expect(unwrapErr(assignBlinds([1], 1, rules))).toBe('NOT_ENOUGH_PLAYERS');
    expect(unwrapErr(assignBlinds([0, 1, 2, 3, 4], 3, rules))).toBeUndefined();
    expect(unwrapErr(assignBlinds([0, 1, 2], 4, rules))).toBe('BUTTON_SEAT_NOT_DEALT_IN');
    expect(unwrapErr(assignBlinds([2, 1], 1, rules))).toBe('CORRUPT_LOG');
  });
});

function unwrapErr(result: ReturnType<typeof assignBlinds>): string | undefined {
  return result.ok ? undefined : result.error.code;
}

describe('the position table for 6 down to 2 dealt in', () => {
  it('6-handed: ring BTN SB BB UTG HJ CO, preflop UTG first', () => {
    const l = lineup([0, 1, 2, 3, 4, 5], 0);
    expect(l.ring).toEqual(['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO']);
    expect(l.preflop).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
    expect(l.postflop).toEqual(['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN']);
  });

  it('5-handed drops UTG, not CO', () => {
    const l = lineup([0, 1, 2, 3, 4], 0);
    expect(l.ring).toEqual(['BTN', 'SB', 'BB', 'HJ', 'CO']);
    expect(l.preflop).toEqual(['HJ', 'CO', 'BTN', 'SB', 'BB']);
  });

  it('4-handed keeps only CO', () => {
    const l = lineup([0, 1, 2, 3], 0);
    expect(l.ring).toEqual(['BTN', 'SB', 'BB', 'CO']);
    expect(l.preflop).toEqual(['CO', 'BTN', 'SB', 'BB']);
  });

  it('3-handed is BTN SB BB with the button first to act', () => {
    const l = lineup([0, 1, 2], 0);
    expect(l.ring).toEqual(['BTN', 'SB', 'BB']);
    expect(l.preflop).toEqual(['BTN', 'SB', 'BB']);
    expect(l.postflop).toEqual(['SB', 'BB', 'BTN']);
  });

  it('heads-up: the button acts first preflop and last postflop', () => {
    const l = lineup([0, 1], 0);
    expect(l.ring).toEqual(['BTN', 'BB']);
    expect(l.preflop).toEqual(['BTN', 'BB']);
    expect(l.postflop).toEqual(['BB', 'BTN']);
  });

  it('labels the heads-up button SB when the config says so', () => {
    const blinds = unwrap(assignBlinds([0, 1], 0, rules));
    const positions = assignPositions([0, 1], blinds, { ...rules, headsUpButtonLabel: 'SB' });
    expect(positions[0]?.position).toBe('SB');
    expect(positions[0]?.blindRole).toBe('SB');
    expect(positions[0]?.isButton).toBe(true);
  });
});

describe('structural lineup keys', () => {
  it('seatsBeforeButton is naming-independent and stable across lineup sizes', () => {
    const six = lineup([0, 1, 2, 3, 4, 5], 0).positions;
    const five = lineup([0, 1, 2, 3, 4], 0).positions;
    // CO is one seat before the button in both lineups.
    expect(six[5]?.seatsBeforeButton).toBe(1);
    expect(five[4]?.seatsBeforeButton).toBe(1);
    expect(six[5]?.position).toBe('CO');
    expect(five[4]?.position).toBe('CO');
  });

  it('seatsAfterButton counts clockwise from the button', () => {
    const positions = lineup([1, 3, 4], 3).positions;
    expect(positions[3]?.seatsAfterButton).toBe(0);
    expect(positions[4]?.seatsAfterButton).toBe(1);
    expect(positions[1]?.seatsAfterButton).toBe(2);
  });

  it('leaves seats that are not dealt in unlabelled', () => {
    const positions = lineup([0, 1, 2], 0).positions;
    expect(positions[3]).toBeNull();
    expect(positions[5]).toBeNull();
  });

  it('orders positions by full-ring preflop order', () => {
    const unsorted: Position[] = ['BB', 'BTN', 'UTG', 'SB', 'CO', 'HJ'];
    const sorted = [...unsorted].sort(comparePositions);
    expect(sorted).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
  });
});

// ---------------------------------------------------------------------------
// The manual SB/BB override (ADR-0031). It is USER input: nothing here infers one.
// ---------------------------------------------------------------------------

const override = (
  smallBlindSeat: SeatIndex,
  bigBlindSeat: SeatIndex,
): BlindSeatOverride => ({ smallBlindSeat, bigBlindSeat });

describe('assignBlinds with a manual override', () => {
  it('takes the named seats and keeps the button where it is', () => {
    const blinds = unwrap(assignBlinds([0, 1, 2, 3, 4, 5], 0, rules, override(3, 4)));
    expect(blinds).toEqual({ buttonSeat: 0, smallBlindSeat: 3, bigBlindSeat: 4, headsUp: false });
  });

  it('refuses the dead-button case: the button cannot hold a blind with 3+ dealt in', () => {
    expect(unwrapErr(assignBlinds([0, 1, 2], 0, rules, override(0, 1)))).toBe(
      'BLIND_OVERRIDE_ON_BUTTON',
    );
    expect(unwrapErr(assignBlinds([0, 1, 2], 0, rules, override(1, 0)))).toBe(
      'BLIND_OVERRIDE_ON_BUTTON',
    );
  });

  it('refuses seats that are not dealt in and the same seat twice', () => {
    expect(unwrapErr(assignBlinds([0, 1, 2], 0, rules, override(4, 1)))).toBe('SEAT_NOT_DEALT_IN');
    expect(unwrapErr(assignBlinds([0, 1, 2], 0, rules, override(1, 5)))).toBe('SEAT_NOT_DEALT_IN');
    expect(unwrapErr(assignBlinds([0, 1, 2], 0, rules, override(1, 1)))).toBe(
      'BLIND_OVERRIDE_INVALID',
    );
  });

  it('lets the heads-up button hold a blind, and outranks the configured rule', () => {
    const flipped = { ...rules, headsUpButtonPostsSmallBlind: false };
    // The rule says the button posts the big blind; the override says the small one.
    const blinds = unwrap(assignBlinds([0, 1], 0, flipped, override(0, 1)));
    expect(blinds).toEqual({ buttonSeat: 0, smallBlindSeat: 0, bigBlindSeat: 1, headsUp: true });
    // ...and the other way round, against the default rule.
    const back = unwrap(assignBlinds([0, 1], 0, rules, override(1, 0)));
    expect(back.smallBlindSeat).toBe(1);
    expect(back.bigBlindSeat).toBe(0);
  });

  it('is a no-op when the override names the seats the rotation would have chosen', () => {
    const plain = unwrap(assignBlinds([0, 1, 2, 3, 4, 5], 0, rules));
    const named = unwrap(assignBlinds([0, 1, 2, 3, 4, 5], 0, rules, override(1, 2)));
    expect(named).toEqual(plain);
  });
});

describe('derivation follows the effective blind assignment', () => {
  it('walks the ladder backwards from the button over the non-blind seats', () => {
    const blinds = unwrap(assignBlinds([0, 1, 2, 3, 4, 5], 0, rules, override(3, 4)));
    const positions = assignPositions([0, 1, 2, 3, 4, 5], blinds, rules);
    const at = (seat: SeatIndex): Position | null => positions[seat]?.position ?? null;
    expect([0, 1, 2, 3, 4, 5].map((s) => at(s as SeatIndex))).toEqual([
      'BTN',
      'UTG',
      'HJ',
      'SB',
      'BB',
      'CO',
    ]);
  });

  it('puts the big blind last preflop and the button last postflop', () => {
    const blinds = unwrap(assignBlinds([0, 1, 2, 3, 4, 5], 0, rules, override(3, 4)));
    // Preflop begins immediately after the big blind (seat 4).
    expect(preflopActionOrder([0, 1, 2, 3, 4, 5], blinds)).toEqual([5, 0, 1, 2, 3, 4]);
    // Postflop is a BUTTON rule and does not move with the blinds.
    expect(postflopActionOrder([0, 1, 2, 3, 4, 5], blinds)).toEqual([1, 2, 3, 4, 5, 0]);
  });

  it('never invents a label: an unlabelable lineup is an Err, not a guess', () => {
    // Hand-built (and invalid) assignment: the button also holds the small blind with
    // three dealt in. `assignBlinds` rejects it up front; the derivation refuses it too
    // rather than reusing a label or defaulting.
    const broken: BlindAssignment = {
      buttonSeat: 0,
      smallBlindSeat: 0,
      bigBlindSeat: 1,
      headsUp: false,
    };
    const derived = derivePositionLabels([0, 1, 2], broken, rules);
    expect(derived.ok).toBe(false);
    if (derived.ok) return;
    expect(derived.error.code).toBe('POSITION_LINEUP_UNSUPPORTED');
    // And the total wrapper fails loud rather than returning half a map.
    expect(() => assignPositions([0, 1, 2], broken, rules)).toThrow();
  });

  it('labels every dealt-in seat exactly once for every legal override', () => {
    for (const sb of [1, 2, 3, 4, 5] as const) {
      for (const bb of [1, 2, 3, 4, 5] as const) {
        if (sb === bb) continue;
        const blinds = unwrap(assignBlinds([0, 1, 2, 3, 4, 5], 0, rules, override(sb, bb)));
        const positions = assignPositions([0, 1, 2, 3, 4, 5], blinds, rules);
        const labels = [0, 1, 2, 3, 4, 5].map((s) => positions[s as SeatIndex]?.position);
        expect(labels.every((l) => l !== undefined)).toBe(true);
        expect(new Set(labels).size).toBe(6);
      }
    }
  });
});
