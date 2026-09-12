import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { SeatIndex, SeatOccupancy } from '@gto-self/poker-core';
import { SeatOccupancyToggle } from './SeatOccupancyToggle.js';

function renderToggle(occupancy: SeatOccupancy) {
  const onToggle = vi.fn<(seat: SeatIndex) => void>();
  render(<SeatOccupancyToggle seat={2} occupancy={occupancy} onToggle={onToggle} />);
  return onToggle;
}

const toggle = () => screen.getByTestId('seat-2-occupancy-toggle');
const state = () => screen.getByTestId('seat-2-occupancy-state');
const wrapper = () => screen.getByTestId('seat-2-occupancy');

describe('SeatOccupancyToggle', () => {
  it('shows OFF for an ACTIVE seat', () => {
    renderToggle('ACTIVE');
    expect(wrapper()).toHaveAttribute('data-sitting-out', 'false');
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
    expect(state()).toHaveTextContent('끔');
  });

  it('shows ON for a SITTING_OUT seat', () => {
    renderToggle('SITTING_OUT');
    expect(wrapper()).toHaveAttribute('data-sitting-out', 'true');
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    expect(state()).toHaveTextContent('켬');
  });

  /**
   * ADR-0073 replaced R1 MINOR-12's "다음 핸드부터" label rather than deleting the concern
   * behind it. That label existed because the stored occupancy and the live hand could
   * disagree; a correction now rebases the live hand in the same commit, so they cannot. The
   * assertion is therefore STRONGER than the one it replaces: the state chip is only ever the
   * settled 켬/끔, and the pending wording must not reappear in either direction.
   */
  it('never claims a deferred effect, in either occupancy', () => {
    const { unmount } = render(
      <SeatOccupancyToggle seat={2} occupancy="ACTIVE" onToggle={vi.fn()} />,
    );
    expect(state()).toHaveTextContent('끔');
    expect(state()).not.toHaveTextContent('다음 핸드부터');
    unmount();

    render(<SeatOccupancyToggle seat={2} occupancy="SITTING_OUT" onToggle={vi.fn()} />);
    expect(state()).toHaveTextContent('켬');
    expect(state()).not.toHaveTextContent('다음 핸드부터');
  });

  it('calls onToggle with the seat on click, once per click', () => {
    const onToggle = renderToggle('ACTIVE');

    fireEvent.click(toggle());
    fireEvent.click(toggle());

    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(onToggle).toHaveBeenNthCalledWith(1, 2);
    expect(onToggle).toHaveBeenNthCalledWith(2, 2);
  });
});
