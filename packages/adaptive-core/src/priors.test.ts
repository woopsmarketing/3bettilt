/**
 * The model data itself. `profile.ts` has no model number in it, so these assertions are
 * the ONLY place the anchors and Ks can be wrong, and a reviewer who disagrees with the
 * model is disagreeing with `priors.ts` and this file — never with the arithmetic.
 */
import { describe, expect, it } from 'vitest';
import {
  ADAPTIVE_KNOWN_THRESHOLD,
  ADAPTIVE_LEARNING_THRESHOLD,
  ADAPTIVE_MODEL_KEY_COUNT,
  ADAPTIVE_PRIORS,
  ADAPTIVE_STAT_K,
  kFor,
  priorBpsFor,
} from './priors.js';
import { ADAPTIVE_STAT_KEYS, ADAPTIVE_STAT_SOURCES, isAdaptiveStatKey } from './stats.js';
import { ADAPTIVE_POLICY_VERSION } from './version.js';

describe('the stat vocabulary', () => {
  it('is exactly the 17 WP-J keys plus the 3 WP-K generic keys, in order', () => {
    expect(ADAPTIVE_STAT_KEYS).toEqual([
      'VPIP',
      'PFR',
      'THREE_BET',
      'FOLD_TO_THREE_BET',
      'STEAL',
      'FOLD_BB_TO_STEAL',
      'CBET_FLOP',
      'CBET_TURN',
      'CBET_RIVER',
      'FOLD_TO_CBET_FLOP',
      'FOLD_TO_CBET_TURN',
      'FOLD_TO_CBET_RIVER',
      'CHECK_RAISE_FLOP',
      'CHECK_RAISE_TURN',
      'CHECK_RAISE_RIVER',
      'WTSD',
      'WSD',
      'CBET_ANY_STREET',
      'FOLD_TO_CBET_ANY_STREET',
      'CHECK_RAISE_ANY_STREET',
    ]);
    expect(new Set(ADAPTIVE_STAT_KEYS).size).toBe(20);
    expect(ADAPTIVE_MODEL_KEY_COUNT).toBe(20);
  });

  it('recognises its own members and nothing else', () => {
    for (const key of ADAPTIVE_STAT_KEYS) expect(isAdaptiveStatKey(key)).toBe(true);
    expect(isAdaptiveStatKey('AGGRESSION_FACTOR')).toBe(false);
    expect(isAdaptiveStatKey('vpip')).toBe(false);
    expect(isAdaptiveStatKey(null)).toBe(false);
  });

  it('names the three sources in the order source references are emitted', () => {
    expect(ADAPTIVE_STAT_SOURCES).toEqual(['EXTERNAL_HUD', 'MANUAL_HUD', 'LEARNED_MODEL']);
  });
});

describe('the priors', () => {
  it('covers every stat and nothing more', () => {
    expect(Object.keys(ADAPTIVE_PRIORS).sort()).toEqual([...ADAPTIVE_STAT_KEYS].sort());
  });

  it('tags every anchor HEURISTIC with a real explanation — never as GTO', () => {
    // CLAUDE.md rule 2. `Provenanced` already makes an unexplained HEURISTIC unwritable at
    // the type level; this asserts the notes are substantive rather than a placeholder, and
    // that no anchor has quietly been promoted to SOURCE or DERIVED.
    for (const key of ADAPTIVE_STAT_KEYS) {
      const entry = ADAPTIVE_PRIORS[key];
      expect(entry.provenance).toBe('HEURISTIC');
      // `note` is optional on the SOURCE/DERIVED arm of `Provenanced`, so it is read
      // defensively here: an anchor that lost its HEURISTIC tag would fail on the empty
      // string rather than on a type error nobody sees at runtime.
      const note = entry.note ?? '';
      expect(note.length).toBeGreaterThan(40);
      expect(note.toUpperCase()).not.toContain('GTO');
      expect(note.toLowerCase()).not.toContain('solver');
    }
  });

  it('holds every anchor strictly inside the basis-point range', () => {
    for (const key of ADAPTIVE_STAT_KEYS) {
      const value = priorBpsFor(key);
      expect(Number.isInteger(value)).toBe(true);
      // Strictly inside: an anchor at 0 or 10000 could only ever be deviated from in one
      // direction, which would turn a two-sided rule into a one-sided correction.
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThan(10000);
    }
  });

  it('pins the exact anchor values', () => {
    expect(ADAPTIVE_STAT_KEYS.map(priorBpsFor)).toEqual([
      2400, 1900, 700, 5500, 3000, 6500, 5500, 4500, 4000, 4500, 4500, 4500, 800, 600, 400, 2700,
      5000, 5500, 4500, 800,
    ]);
  });

  it('keeps the PFR anchor below the VPIP anchor', () => {
    // A player cannot raise more often than they enter a pot. An anchor pair that described
    // an impossible player would bias every PFR deviation in one direction.
    expect(priorBpsFor('PFR')).toBeLessThan(priorBpsFor('VPIP'));
  });

  it('descends the c-bet and check-raise anchors by street', () => {
    expect(priorBpsFor('CBET_FLOP')).toBeGreaterThan(priorBpsFor('CBET_TURN'));
    expect(priorBpsFor('CBET_TURN')).toBeGreaterThan(priorBpsFor('CBET_RIVER'));
    expect(priorBpsFor('CHECK_RAISE_FLOP')).toBeGreaterThan(priorBpsFor('CHECK_RAISE_TURN'));
    expect(priorBpsFor('CHECK_RAISE_TURN')).toBeGreaterThan(priorBpsFor('CHECK_RAISE_RIVER'));
  });
});

describe('the per-stat K', () => {
  it('covers every stat and nothing more', () => {
    expect(Object.keys(ADAPTIVE_STAT_K).sort()).toEqual([...ADAPTIVE_STAT_KEYS].sort());
  });

  it('pins the exact K values', () => {
    expect(ADAPTIVE_STAT_KEYS.map(kFor)).toEqual([
      50, 50, 40, 40, 40, 40, 40, 30, 25, 40, 30, 25, 40, 30, 25, 50, 40, 40, 40, 40,
    ]);
  });

  it('is a positive integer everywhere', () => {
    for (const key of ADAPTIVE_STAT_KEYS) {
      expect(Number.isSafeInteger(kFor(key))).toBe(true);
      expect(kFor(key)).toBeGreaterThan(0);
    }
  });

  it('lowers K as the opportunity gets rarer, street by street', () => {
    // The reason the Ks differ at all: a river spot arises a fraction as often as a flop
    // one, so a flop-sized K would leave the river stats permanently unable to fire.
    expect(kFor('CBET_FLOP')).toBeGreaterThan(kFor('CBET_TURN'));
    expect(kFor('CBET_TURN')).toBeGreaterThan(kFor('CBET_RIVER'));
    expect(kFor('FOLD_TO_CBET_FLOP')).toBeGreaterThan(kFor('FOLD_TO_CBET_TURN'));
    expect(kFor('FOLD_TO_CBET_TURN')).toBeGreaterThan(kFor('FOLD_TO_CBET_RIVER'));
    expect(kFor('CHECK_RAISE_FLOP')).toBeGreaterThan(kFor('CHECK_RAISE_TURN'));
    expect(kFor('CHECK_RAISE_TURN')).toBeGreaterThan(kFor('CHECK_RAISE_RIVER'));
  });
});

describe('the display thresholds and the policy version', () => {
  it('reuses player-core’s ADR-0062e thresholds rather than re-picking them', () => {
    expect(ADAPTIVE_LEARNING_THRESHOLD).toBe(5);
    expect(ADAPTIVE_KNOWN_THRESHOLD).toBe(30);
    expect(ADAPTIVE_LEARNING_THRESHOLD).toBeLessThan(ADAPTIVE_KNOWN_THRESHOLD);
  });

  it('stamps a stable, opaque policy version', () => {
    // Stored in `adaptive_strategy_traces.adaptive_policy_version`. Changing it is a
    // deliberate act; this assertion is the reminder.
    expect(ADAPTIVE_POLICY_VERSION).toBe('adaptive-2026-09-c2-v1');
  });
});
