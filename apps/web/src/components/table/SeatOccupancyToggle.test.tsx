import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { SeatIndex, SeatOccupancy } from '@gto-self/poker-core';
import { SeatOccupancyToggle } from './SeatOccupancyToggle.js';

function renderToggle(occupancy: SeatOccupancy, pending = false) {
  const onToggle = vi.fn<(seat: SeatIndex) => void>();
  render(<SeatOccupancyToggle seat={2} occupancy={occupancy} pending={pending} onToggle={onToggle} />);
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

  it('shows ON for a SITTING_OUT seat with no hand holding it up', () => {
    renderToggle('SITTING_OUT');
    expect(wrapper()).toHaveAttribute('data-sitting-out', 'true');
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    expect(state()).toHaveTextContent('켬');
  });

  it('says "다음 핸드부터" while the current hand still has the seat dealt in', () => {
    renderToggle('SITTING_OUT', true);
    expect(state()).toHaveTextContent('다음 핸드부터');
  });

  it('says "다음 핸드부터" for a re-activated seat the current hand skipped', () => {
    // R1 MINOR-12: re-activation takes effect on the NEXT deal exactly as sitting out does,
    // so claiming '끔' here overstated it. The chip still reads as not-sitting-out.
    renderToggle('ACTIVE', true);
    expect(state()).toHaveTextContent('다음 핸드부터');
    expect(state()).not.toHaveTextContent('끔');
    expect(wrapper()).toHaveAttribute('data-sitting-out', 'false');
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
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
