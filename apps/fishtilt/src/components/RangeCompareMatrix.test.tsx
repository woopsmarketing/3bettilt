import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { RFI_RANGES } from '@gto-self/strategy-core';
import { RangeCompareMatrix } from './RangeCompareMatrix.js';

// `RFI_RANGES` positions used below are never `null` at runtime (only `BB` is), so a tiny
// local unwrap keeps the tests honest about that instead of `!`.
function unwrapNonNull<T>(value: T | null): T {
  if (value === null) throw new Error('expected a non-null range in this fixture');
  return value;
}

function ControlledCompareMatrix() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <RangeCompareMatrix
      label="비교"
      rangeA={unwrapNonNull(RFI_RANGES.BTN)}
      labelA="BTN"
      rangeB={unwrapNonNull(RFI_RANGES.UTG)}
      labelB="UTG"
      selectedKey={selected}
      onSelectKey={setSelected}
    />
  );
}

describe('RangeCompareMatrix', () => {
  it('renders exactly 169 cells', () => {
    render(<ControlledCompareMatrix />);
    expect(screen.getAllByRole('button')).toHaveLength(169);
  });

  it('exposes an accessible group name', () => {
    render(<ControlledCompareMatrix />);
    expect(screen.getByRole('group', { name: '비교' })).toBeInTheDocument();
  });

  it('draws SHARED and DIFFERS labels in the ink-on-fill token, never in a surface colour', () => {
    /*
     * FISHTILT_STATE ruling 104, the two-range half of it. `text-ground-900` on the raise and
     * call fills is the page colour used as ink; inverting the palette turns both into
     * light-on-light. `src/app/theme-tokens.test.ts` asserts the resulting contrast in both
     * themes — this asserts that the component asks for the right token in the first place.
     */
    render(<ControlledCompareMatrix />);
    const shared = screen.getByRole('button', { name: /^99 .*, 두 레인지 모두에 포함$/u });
    const differs = screen.getByRole('button', { name: /^53s .*BTN/u });
    for (const cell of [shared, differs]) {
      expect(cell.className).toContain('text-ink-on-action');
      expect(cell.className).not.toContain('text-ground-900');
    }
  });

  it('marks a hand in both ranges as shared, in words', () => {
    // 99 is in both UTG's pairs (66+) and BTN's pairs (33+) per tables.ts.
    render(<ControlledCompareMatrix />);
    expect(
      screen.getByRole('button', { name: /^99 .*, 두 레인지 모두에 포함$/u }),
    ).toBeInTheDocument();
  });

  it('marks a hand only in the wider (BTN) range distinctly, naming BTN', () => {
    // 53s is in BTN's list (53s+) but not in UTG's (A3s+ / K8s+ / Q9s+ / J9s+ / T9s only).
    render(<ControlledCompareMatrix />);
    expect(screen.getByRole('button', { name: /^53s .*, BTN에만 포함$/u })).toBeInTheDocument();
  });

  it('marks a hand in neither range as absent from both, in words', () => {
    // 72o is nobody's RFI hand.
    render(<ControlledCompareMatrix />);
    expect(
      screen.getByRole('button', { name: /^72o .*, 어느 레인지에도 없음$/u }),
    ).toBeInTheDocument();
  });

  it('the rare BTN-only class relative to SB is named for the correct side, never folded into "neither"', () => {
    // Real data: 3 classes are in BTN's RFI range but not SB's, even though SB has more
    // total combos. This is the exact edge case this component's doc comment names.
    function Fixture() {
      const [selected, setSelected] = useState<string | null>(null);
      return (
        <RangeCompareMatrix
          label="BTN과 SB 비교"
          rangeA={unwrapNonNull(RFI_RANGES.BTN)}
          labelA="BTN"
          rangeB={unwrapNonNull(RFI_RANGES.SB)}
          labelB="SB"
          selectedKey={selected}
          onSelectKey={setSelected}
        />
      );
    }
    render(<Fixture />);
    const onlyBtn = screen.getAllByRole('button', { name: /BTN에만 포함$/ });
    expect(onlyBtn.length).toBeGreaterThan(0);
    // None of those cells are mislabelled as "in neither range."
    for (const button of onlyBtn) {
      expect(button).not.toHaveAccessibleName(expect.stringContaining('어느 레인지에도 없음'));
    }
  });

  it('separates shared from differing cells by more than colour (WCAG 1.4.1)', () => {
    /*
     * `act-raise-500` (shared) and `act-call-500` (in one range only) are far apart in hue and
     * almost identical in lightness — relative luminance 0.235 vs 0.294, 1.21:1 — and both
     * carry the same `ground-900` ink, so with colour removed the two states are the same
     * grey. The rule asserted here is that the two states differ in something a reader can see
     * without colour at all, not that a particular class name is present.
     */
    render(<ControlledCompareMatrix />);
    const shared = screen.getAllByRole('button', { name: /, 두 레인지 모두에 포함$/u })[0];
    const differs = screen.getAllByRole('button', { name: /에만 포함$/u })[0];
    expect(shared).toBeDefined();
    expect(differs).toBeDefined();
    if (shared === undefined || differs === undefined) return;

    const nonColourMarks = (className: string) =>
      className
        .split(/\s+/u)
        .filter((token) => /^(underline|italic|font-|border-\d|ring-\d|decoration-)/u.test(token))
        .sort()
        .join(' ');

    expect(nonColourMarks(differs.className)).not.toBe(nonColourMarks(shared.className));
    expect(nonColourMarks(differs.className)).not.toBe('');
  });

  it('selecting a cell calls onSelectKey and reflects aria-pressed', async () => {
    const user = userEvent.setup();
    render(<ControlledCompareMatrix />);
    const cell = screen.getByRole('button', { name: /^AKs .*,/u });
    expect(cell).toHaveAttribute('aria-pressed', 'false');
    await user.click(cell);
    expect(cell).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders a legend covering all four visual states', () => {
    render(<ControlledCompareMatrix />);
    expect(screen.getByText('두 레인지 모두에 포함되는 핸드 (공통)')).toBeInTheDocument();
    expect(screen.getByText(/^한쪽 레인지에만 포함되는 핸드/u)).toBeInTheDocument();
    expect(screen.getByText('어느 레인지에도 없는 핸드')).toBeInTheDocument();
    expect(screen.getByText('선택한 핸드')).toBeInTheDocument();
  });

  it('never mentions GTO', () => {
    render(<ControlledCompareMatrix />);
    expect(document.body.textContent?.toUpperCase()).not.toContain('GTO');
  });
});
