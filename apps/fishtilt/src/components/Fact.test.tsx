import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { COMBO_COUNT, HAND_CLASS_COUNT, RFI_RANGES, comboCountOf } from '@gto-self/strategy-core';
import { Fact } from './Fact.js';
import { factValue } from '../content/facts.js';

/*
 * `Fact` exists so prose never types a number. These tests check the two halves of that:
 * the value really is read from the packages, and an unanswerable request fails loudly
 * rather than rendering something plausible (CLAUDE.md rule 5).
 */
describe('Fact', () => {
  it('renders the 1326-combo universe from strategy-core, not a literal', () => {
    render(<Fact name="COMBO_COUNT" />);
    expect(screen.getByText(COMBO_COUNT.toLocaleString('ko-KR'))).toBeInTheDocument();
  });

  it('renders the 169-class count from strategy-core', () => {
    render(<Fact name="HAND_CLASS_COUNT" />);
    expect(screen.getByText(String(HAND_CLASS_COUNT))).toBeInTheDocument();
  });

  it('renders a phrasing-level <span> so it is legal mid-paragraph', () => {
    const { container } = render(<Fact name="HAND_CLASS_COUNT" />);
    expect(container.firstElementChild?.tagName).toBe('SPAN');
  });
});

describe('factValue', () => {
  it('reads the per-kind combo counts from the hand-class model', () => {
    expect(factValue('COMBOS_OF_KIND', 'PAIR')).toBe('6');
    expect(factValue('COMBOS_OF_KIND', 'SUITED')).toBe('4');
    expect(factValue('COMBOS_OF_KIND', 'OFFSUIT')).toBe('12');
  });

  it('splits the 169 classes as 13 / 78 / 78', () => {
    expect(factValue('CLASSES_OF_KIND', 'PAIR')).toBe('13');
    expect(factValue('CLASSES_OF_KIND', 'SUITED')).toBe('78');
    expect(factValue('CLASSES_OF_KIND', 'OFFSUIT')).toBe('78');
  });

  it('reads a first-in range size straight from the range facade', () => {
    const btn = RFI_RANGES.BTN;
    expect(btn).not.toBeNull();
    if (btn === null) return;
    expect(factValue('RFI_COMBOS', 'BTN')).toBe(comboCountOf(btn).toLocaleString('ko-KR'));
  });

  it('lists the positions whose first-in range holds a hand, in seat order', () => {
    expect(factValue('RFI_POSITIONS_WITH', 'AA')).toBe('UTG · HJ · CO · BTN · SB');
  });

  it('says so in words when NO position opens a hand, rather than rendering blank', () => {
    expect(factValue('RFI_POSITIONS_WITH', '72o')).toBe('한 자리도 없습니다');
  });

  it('throws for a hand that is not one of the 169', () => {
    expect(() => factValue('HAND_COMBOS', 'AKx')).toThrow(/169/u);
  });

  it('throws for a missing argument rather than guessing one', () => {
    expect(() => factValue('RFI_PERCENT')).toThrow(/needs an arg/u);
  });

  it('throws for the big blind, which has no first-in range at all', () => {
    expect(() => factValue('RFI_COMBOS', 'BB')).toThrow(/no shipped first-in range/u);
  });

  it('throws for a name that is not a fact', () => {
    expect(() => factValue('MADE_UP' as never)).toThrow(/unknown fact/u);
  });
});
