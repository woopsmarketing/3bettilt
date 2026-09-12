import { describe, expect, it } from 'vitest';
import {
  differenceHandClassSets,
  HAND_CLASSES,
  HAND_CLASS_COUNT,
  handClassSet,
  RFI_RANGES,
  unionHandClassSets,
  type HandClassSet,
} from '@gto-self/strategy-core';
import { formatHandClassSet } from './notation.js';

/** Every one of the 169 classes, built without going through this module's own formatter —
 *  a union of 169 single-class sets is the most literal "full range" construction there is. */
function fullRange(): HandClassSet {
  return unionHandClassSets(HAND_CLASSES.map((handClass) => handClassSet(handClass.key)));
}

/** Membership as a stable, sorted array of keys — the round-trip property we actually
 *  care about, independent of token spelling or ordering. */
function membershipOf(set: HandClassSet): readonly number[] {
  return Array.from(set.members);
}

function roundTrips(set: HandClassSet): void {
  const notation = formatHandClassSet(set);
  const reparsed = handClassSet(notation);
  expect(membershipOf(reparsed)).toEqual(membershipOf(set));
}

describe('formatHandClassSet', () => {
  it('formats the empty range as an empty string', () => {
    expect(formatHandClassSet(handClassSet(''))).toBe('');
  });

  it('round-trips the empty range', () => {
    roundTrips(handClassSet(''));
  });

  it('round-trips the full 169-class range', () => {
    const full = fullRange();
    expect(full.members.reduce((sum, m) => sum + m, 0)).toBe(HAND_CLASS_COUNT);
    roundTrips(full);
  });

  it('round-trips a single pocket pair', () => {
    roundTrips(handClassSet('KK'));
  });

  it('round-trips a single suited class', () => {
    roundTrips(handClassSet('AKs'));
  });

  it('round-trips a single offsuit class', () => {
    roundTrips(handClassSet('72o'));
  });

  it('round-trips a plus-run pair range', () => {
    roundTrips(handClassSet('66+'));
  });

  it('round-trips a non-top pair run (dash form)', () => {
    roundTrips(handClassSet('TT-88'));
  });

  it('round-trips a suited plus-run', () => {
    roundTrips(handClassSet('A3s+'));
  });

  it('round-trips a non-edge suited run (dash form)', () => {
    roundTrips(handClassSet('A5s-A2s'));
  });

  it('round-trips a non-contiguous, mixed-kind set', () => {
    roundTrips(handClassSet('AA,QQ,T9s,72o,32o'));
  });

  it('round-trips every shipped RFI range, including the derived SB set', () => {
    for (const position of ['UTG', 'HJ', 'CO', 'BTN', 'SB'] as const) {
      const range = RFI_RANGES[position];
      expect(range).not.toBeNull();
      if (range) roundTrips(range);
    }
  });

  it('round-trips a union', () => {
    roundTrips(unionHandClassSets([handClassSet('QQ+'), handClassSet('AKs')]));
  });

  it('round-trips a difference (the same shape RFI_RANGES.SB is built with)', () => {
    roundTrips(differenceHandClassSets(handClassSet('22+,A2s+'), handClassSet('22,33')));
  });

  it('produces notation that reads in the documented style for a known table', () => {
    // UTG's source notation is already hand-authored in exactly this compact style
    // (tables.ts); the formatter should reproduce an equivalent (not necessarily
    // character-identical) representation for it.
    const utg = RFI_RANGES.UTG;
    expect(utg).not.toBeNull();
    if (!utg) return;
    const notation = formatHandClassSet(utg);
    expect(notation).toContain('66+');
    expect(notation).toContain('ATo+');
    expect(notation).toContain('KJo+');
  });
});
