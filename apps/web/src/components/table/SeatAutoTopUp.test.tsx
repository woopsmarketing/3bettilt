import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Money } from '@gto-self/shared';
import type { AutoTopUpPolicy } from '@gto-self/poker-core';
import { SeatAutoTopUp, type SeatAutoTopUpChange } from './SeatAutoTopUp.js';

/** NL50's reference stack, taken from the preset rather than typed in as a literal 100. */
const DEFAULT_TARGET = Money.fromBB(100);

function at(bb: number, enabled = true): AutoTopUpPolicy {
  const target = Money.fromBB(bb);
  return { enabled, targetStack: target, threshold: target };
}

function renderChip(policy: AutoTopUpPolicy | null) {
  const onChange = vi.fn<(change: SeatAutoTopUpChange) => void>();
  render(
    <SeatAutoTopUp seat={2} policy={policy} defaultTarget={DEFAULT_TARGET} onChange={onChange} />,
  );
  return onChange;
}

const chip = () => screen.getByTestId('seat-2-autotopup');
const toggle = () => screen.getByTestId('seat-2-autotopup-toggle');
const targetButton = () => screen.getByTestId('seat-2-autotopup-target');
const input = () => screen.getByTestId('seat-2-autotopup-input');

describe('SeatAutoTopUp', () => {
  it('shows the seat’s own target and state when it is on', () => {
    renderChip(at(100));
    expect(chip()).toHaveAttribute('data-enabled', 'true');
    expect(targetButton()).toHaveTextContent('100 BB');
    expect(screen.getByTestId('seat-2-autotopup-state')).toHaveTextContent('✓');
  });

  it('shows an obvious off state, with the target it would use', () => {
    renderChip(at(62.5, false));
    expect(chip()).toHaveAttribute('data-enabled', 'false');
    expect(targetButton()).toHaveTextContent('62.5 BB');
    expect(screen.getByTestId('seat-2-autotopup-state')).toHaveTextContent('끔');
  });

  it('says so when the seat records no preference at all', () => {
    renderChip(null);
    expect(chip()).toHaveAttribute('data-enabled', 'false');
    expect(targetButton()).toHaveTextContent('목표 없음');
  });

  it('turns a seat ON in one click, at the table’s own reference stack', () => {
    const onChange = renderChip(null);

    fireEvent.click(toggle());

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      seat: 2,
      policy: { enabled: true, targetStack: DEFAULT_TARGET, threshold: DEFAULT_TARGET },
      // The text the server will re-parse. It round-trips to exactly the same amount.
      targetText: '100',
    });
    expect(Money.parseBB('100')).toEqual({ ok: true, value: DEFAULT_TARGET });
  });

  it('turns a seat OFF in one click and keeps its target', () => {
    const onChange = renderChip(at(75));

    fireEvent.click(toggle());

    expect(onChange).toHaveBeenCalledWith({
      seat: 2,
      policy: at(75, false),
      targetText: '75',
    });
  });

  it('commits an edited target with Enter, keeping the switch as it was', () => {
    const onChange = renderChip(at(100, false));

    fireEvent.click(targetButton());
    expect(input()).toHaveValue('100');
    fireEvent.change(input(), { target: { value: '62.5' } });
    fireEvent.keyDown(input(), { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith({
      seat: 2,
      // Editing a target is not a decision to switch the seat on.
      policy: at(62.5, false),
      targetText: '62.5',
    });
    expect(screen.queryByTestId('seat-2-autotopup-input')).not.toBeInTheDocument();
  });

  it('cancels with Esc, keeping the stored target and dispatching nothing', () => {
    const onChange = renderChip(at(100));

    fireEvent.click(targetButton());
    fireEvent.change(input(), { target: { value: '40' } });
    fireEvent.keyDown(input(), { key: 'Escape' });

    expect(onChange).not.toHaveBeenCalled();
    expect(targetButton()).toHaveTextContent('100 BB');
  });

  it('keeps a target that will not parse and shows the problem beside it', () => {
    const onChange = renderChip(at(100));

    fireEvent.click(targetButton());
    fireEvent.change(input(), { target: { value: 'a hundred' } });
    fireEvent.keyDown(input(), { key: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
    // Rule 3: the entered text is still there, and the editor is still open.
    expect(input()).toHaveValue('a hundred');
    expect(screen.getByTestId('seat-2-autotopup-problem')).toHaveTextContent('not a number');
  });

  it('refuses more precision than a milliBB rather than rounding it away', () => {
    const onChange = renderChip(at(100));

    fireEvent.click(targetButton());
    fireEvent.change(input(), { target: { value: '62.5001' } });
    fireEvent.keyDown(input(), { key: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
    expect(input()).toHaveValue('62.5001');
    expect(screen.getByTestId('seat-2-autotopup-problem')).toHaveTextContent('3 decimal places');
  });

  /**
   * `Money.parseBB` accepts "0" and "-5": a negative BB amount is legitimate elsewhere, so
   * the parser is right and the chip is what has to refuse. An enabled policy with a
   * non-positive target makes `applySeatAutoTopUps` return `STACK_NOT_POSITIVE` at the next
   * deal, which aborts Start Hand for the whole table — see the `TableRoot` test that plays
   * a second hand after a refused target.
   */
  it('refuses a target of 0, keeping the text and dispatching nothing', () => {
    const onChange = renderChip(at(100));

    fireEvent.click(targetButton());
    fireEvent.change(input(), { target: { value: '0' } });
    fireEvent.keyDown(input(), { key: 'Enter' });

    // The parser itself is happy with it; the chip is not.
    expect(Money.parseBB('0')).toEqual({ ok: true, value: 0 });
    expect(onChange).not.toHaveBeenCalled();
    expect(input()).toHaveValue('0');
    // The server's own verdict, verbatim inside the Korean frame.
    expect(screen.getByTestId('seat-2-autotopup-problem')).toHaveTextContent('STACK_NOT_POSITIVE');
  });

  it('refuses a negative target, keeping the text and dispatching nothing', () => {
    const onChange = renderChip(at(100));

    fireEvent.click(targetButton());
    fireEvent.change(input(), { target: { value: '-5' } });
    fireEvent.keyDown(input(), { key: 'Enter' });

    expect(Money.parseBB('-5')).toEqual({ ok: true, value: Money.fromBB(-5) });
    expect(onChange).not.toHaveBeenCalled();
    expect(input()).toHaveValue('-5');
    expect(screen.getByTestId('seat-2-autotopup-problem')).toHaveTextContent('STACK_NOT_POSITIVE');

    // The editor is still open on the refused text, and the stored target is untouched
    // behind it: nothing was written and the switch was not flipped.
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(targetButton()).toHaveTextContent('100 BB');
    expect(chip()).toHaveAttribute('data-enabled', 'true');
  });

  it('refuses a non-positive target for a seat that is switched OFF too', () => {
    // The switch is not the guard: a target stored while the seat is off becomes live the
    // moment the user switches it back on.
    const onChange = renderChip(at(100, false));

    fireEvent.click(targetButton());
    fireEvent.change(input(), { target: { value: '0' } });
    fireEvent.keyDown(input(), { key: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(chip()).toHaveAttribute('data-enabled', 'false');
    expect(targetButton()).toHaveTextContent('100 BB');
  });

  it('clears the problem once a valid target is committed', () => {
    const onChange = renderChip(at(100));

    fireEvent.click(targetButton());
    fireEvent.change(input(), { target: { value: '' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(screen.getByTestId('seat-2-autotopup-problem')).toBeInTheDocument();

    fireEvent.change(input(), { target: { value: '80' } });
    fireEvent.keyDown(input(), { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith({ seat: 2, policy: at(80), targetText: '80' });
    expect(screen.queryByTestId('seat-2-autotopup-problem')).not.toBeInTheDocument();
  });
});
