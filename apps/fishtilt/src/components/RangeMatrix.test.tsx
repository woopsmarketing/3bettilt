import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  HAND_CLASSES,
  handClassAt,
  handClassByKey,
  handClassSet,
  type HandClassIndex,
} from '@gto-self/strategy-core';
import { handClassAccessibleName } from '../features/range/index.js';
import { RangeMatrix } from './RangeMatrix.js';

/**
 * The accessible name a cell must carry, composed from the same copy function the component
 * uses, so these queries assert the RULE — key, then spoken reading, then membership — and
 * do not pin today's exact Korean wording in twenty places. The wording itself is pinned
 * once, in `features/range/copy.test.ts`, and the SHAPE is pinned by the first test in the
 * `range membership` block below (`docs/FISHTILT_STATE.md` ruling 26).
 */
function cellName(key: string, membership = ''): string {
  const handClass = handClassByKey(key);
  if (handClass === undefined) throw new Error(`fixture: no such hand class ${key}`);
  return `${handClassAccessibleName(handClass)}${membership}`;
}

function ControlledMatrix(props: {
  readonly range?: ReturnType<typeof handClassSet> | null;
  readonly initialSelected?: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(props.initialSelected ?? null);
  return (
    <RangeMatrix
      label="핸드 레인지 표"
      range={props.range ?? null}
      selectedKey={selected}
      onSelectKey={setSelected}
    />
  );
}

describe('RangeMatrix', () => {
  it('renders exactly 169 cells', () => {
    render(<ControlledMatrix />);
    expect(screen.getAllByRole('button')).toHaveLength(169);
  });

  it('exposes an accessible group name', () => {
    render(<ControlledMatrix />);
    expect(screen.getByRole('group', { name: '핸드 레인지 표' })).toBeInTheDocument();
  });

  it('draws the in-range label in the ink-on-fill token, never in a surface colour', () => {
    /*
     * FISHTILT_STATE ruling 104. This label used to be `text-ground-900` — the PAGE colour
     * used as dark ink on a saturated orange fill. It worked only because the page happened
     * to be black; the moment the light theme redefines `ground-900` to an off-white, all 169
     * in-range cells become near-white text on orange.
     *
     * The fix is a token that belongs to the FILL rather than to the page, and the contrast it
     * produces is asserted in BOTH themes by `src/app/theme-tokens.test.ts`. What is checked
     * here is the other half: that this component actually asks for it.
     */
    render(<ControlledMatrix range={handClassSet('AA,AKs')} />);
    const inRange = screen.getByRole('button', { name: cellName('AA', ', 레인지 포함') });
    expect(inRange.className).toContain('text-ink-on-action');
    expect(inRange.className).not.toContain('text-ground-900');
  });

  describe('orientation — pinned to strategy-core row/col convention', () => {
    it('cell (row 0, col 0) is AA — the diagonal is pairs', () => {
      render(<ControlledMatrix />);
      const cell = screen.getAllByRole('button')[0];
      expect(cell).toHaveAttribute('data-row', '0');
      expect(cell).toHaveAttribute('data-col', '0');
      expect(cell).toHaveTextContent('AA');
      expect(handClassAt(0 as HandClassIndex).key).toBe('AA');
    });

    it('cell (row 0, col 1) is AKs — above the diagonal is suited', () => {
      render(<ControlledMatrix />);
      const cell = screen.getAllByRole('button')[1];
      expect(cell).toHaveAttribute('data-row', '0');
      expect(cell).toHaveAttribute('data-col', '1');
      expect(cell).toHaveTextContent('AKs');
      expect(handClassAt(1 as HandClassIndex).key).toBe('AKs');
    });

    it('cell (row 1, col 0) is AKo — below the diagonal is offsuit', () => {
      render(<ControlledMatrix />);
      const cell = screen.getAllByRole('button')[13];
      expect(cell).toHaveAttribute('data-row', '1');
      expect(cell).toHaveAttribute('data-col', '0');
      expect(cell).toHaveTextContent('AKo');
      expect(handClassAt(13 as HandClassIndex).key).toBe('AKo');
    });

    it('renders every one of the 169 classes in strategy-core matrix order (row * 13 + col)', () => {
      render(<ControlledMatrix />);
      const cells = screen.getAllByRole('button');
      HAND_CLASSES.forEach((handClass, index) => {
        expect(cells[index]).toHaveAttribute('data-row', String(handClass.row));
        expect(cells[index]).toHaveAttribute('data-col', String(handClass.col));
        expect(cells[index]).toHaveTextContent(handClass.key);
      });
    });
  });

  describe('selection — click/tap, controlled', () => {
    it('is unselected by default and every cell has an accessible name', () => {
      render(<ControlledMatrix />);
      const aa = screen.getByRole('button', { name: cellName('AA') });
      expect(aa).toHaveAttribute('aria-pressed', 'false');
    });

    it('selects a cell on click and reflects it via aria-pressed', async () => {
      const user = userEvent.setup();
      render(<ControlledMatrix />);
      const aa = screen.getByRole('button', { name: cellName('AA') });
      await user.click(aa);
      expect(aa).toHaveAttribute('aria-pressed', 'true');
    });

    it('is keyboard operable: Tab reaches a cell, Enter selects it', async () => {
      const user = userEvent.setup();
      render(<ControlledMatrix />);
      const aa = screen.getByRole('button', { name: cellName('AA') });
      aa.focus();
      expect(aa).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(aa).toHaveAttribute('aria-pressed', 'true');
    });

    it('calls onSelectKey with the clicked class key', async () => {
      const user = userEvent.setup();
      const onSelectKey = vi.fn();
      render(
        <RangeMatrix
          label="핸드 레인지 표"
          range={null}
          selectedKey={null}
          onSelectKey={onSelectKey}
        />,
      );
      await user.click(screen.getByRole('button', { name: cellName('AKs') }));
      expect(onSelectKey).toHaveBeenCalledWith('AKs');
    });
  });

  describe('range membership — never colour alone', () => {
    it('every cell announces its key AND a Korean reading, never the bare notation', () => {
      // The gap this closes: `AKs` alone is read out letter by letter, which in a 169-button
      // grid leaves the whole chart unusable by ear. Asserted over all 169 cells rather than
      // one, so a class whose reading fell through would fail here.
      render(<ControlledMatrix />);
      const cells = screen.getAllByRole('button');
      HAND_CLASSES.forEach((handClass, index) => {
        const name = cells[index]?.getAttribute('aria-label') ?? '';
        expect(name.startsWith(`${handClass.key} `)).toBe(true);
        expect(name.slice(handClass.key.length + 1)).toMatch(/[가-힣]/u);
      });
    });

    it('with no range, cells carry no membership wording and no legend renders', () => {
      render(<ControlledMatrix range={null} />);
      const aa = screen.getByRole('button', { name: cellName('AA') });
      expect(aa).toHaveAccessibleName(cellName('AA'));
      expect(screen.queryByText('레인지에 포함되는 핸드')).not.toBeInTheDocument();
    });

    it('states membership in words in the accessible name, not colour alone', () => {
      const range = handClassSet('AA,KK');
      render(<ControlledMatrix range={range} />);
      expect(
        screen.getByRole('button', { name: cellName('AA', ', 레인지 포함') }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: cellName('KK', ', 레인지 포함') }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: cellName('72o', ', 레인지 밖') }),
      ).toBeInTheDocument();
    });

    it('renders a legend distinguishing in-range, out-of-range and selected, each with text', () => {
      const range = handClassSet('AA');
      render(<ControlledMatrix range={range} />);
      expect(screen.getByText('레인지에 포함되는 핸드')).toBeInTheDocument();
      expect(screen.getByText('레인지 밖의 핸드')).toBeInTheDocument();
      expect(screen.getByText('선택한 핸드')).toBeInTheDocument();
    });

    it('uses the strategy-action tokens for membership, never the brand red', () => {
      const range = handClassSet('AA');
      render(<ControlledMatrix range={range} />);
      const inRangeCell = screen.getByRole('button', { name: cellName('AA', ', 레인지 포함') });
      expect(inRangeCell.className).toContain('bg-act-raise-500');
      expect(inRangeCell.className).not.toContain('bg-brand');
      const outOfRangeCell = screen.getByRole('button', { name: cellName('72o', ', 레인지 밖') });
      expect(outOfRangeCell.className).toContain('bg-act-fold-500');
      expect(outOfRangeCell.className).not.toContain('bg-brand');
    });

    it('never uses act-fold-500 as a border/outline — only as a filled background with text-100', () => {
      const range = handClassSet('AA');
      render(<ControlledMatrix range={range} />);
      const outOfRangeCell = screen.getByRole('button', { name: cellName('72o', ', 레인지 밖') });
      expect(outOfRangeCell.className).toContain('bg-act-fold-500');
      expect(outOfRangeCell.className).toContain('text-text-100');
      expect(outOfRangeCell.className).not.toMatch(/border-act-fold-500|outline-act-fold-500/);
    });

    it('a selected cell switches to the brand-600 fill regardless of its membership', async () => {
      const user = userEvent.setup();
      const range = handClassSet('AA');
      render(<ControlledMatrix range={range} />);
      const inRangeCell = screen.getByRole('button', { name: cellName('AA', ', 레인지 포함') });
      await user.click(inRangeCell);
      expect(inRangeCell.className).toContain('bg-brand-600');
      expect(inRangeCell.className).not.toContain('act-raise-500');
    });
  });

  it('the matrix scrolls horizontally within its own wrapper, never forcing the page to', () => {
    const { container } = render(<ControlledMatrix />);
    const scrollWrapper = container.querySelector('.overflow-x-auto');
    expect(scrollWrapper).toBeInTheDocument();
  });

  it('cells meet the 44px minimum touch target', () => {
    render(<ControlledMatrix />);
    for (const cell of screen.getAllByRole('button').slice(0, 5)) {
      expect(cell.className).toContain('h-11');
      expect(cell.className).toContain('w-11');
    }
  });

  it('accepts a group container queryable by its own root without leaking other groups', () => {
    render(<ControlledMatrix />);
    const group = screen.getByRole('group', { name: '핸드 레인지 표' });
    expect(within(group).getAllByRole('button')).toHaveLength(169);
  });
});
