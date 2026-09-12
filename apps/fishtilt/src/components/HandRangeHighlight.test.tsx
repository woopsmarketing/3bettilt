import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { handClassByKey } from '@gto-self/strategy-core';
import { handClassAccessibleName } from '../features/range/index.js';
import { HandRangeHighlight } from './HandRangeHighlight.js';

/** A cell's accessible name, built from the shared copy the matrix itself uses. */
function cellName(key: string): string {
  const handClass = handClassByKey(key);
  if (handClass === undefined) throw new Error(`fixture: no such hand class ${key}`);
  return handClassAccessibleName(handClass);
}

describe('HandRangeHighlight', () => {
  it('opens with the given hand class already selected', () => {
    render(<HandRangeHighlight handKey="AKs" label="핸드 레인지 표" />);
    expect(screen.getByRole('button', { name: cellName('AKs') })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('renders no membership legend — this is not a range query', () => {
    render(<HandRangeHighlight handKey="AKs" label="핸드 레인지 표" />);
    expect(screen.queryByText('레인지에 포함되는 핸드')).not.toBeInTheDocument();
  });

  it('moving to another cell updates the selection, not the seeded hand', async () => {
    const user = userEvent.setup();
    render(<HandRangeHighlight handKey="AKs" label="핸드 레인지 표" />);
    await user.click(screen.getByRole('button', { name: cellName('AA') }));
    expect(screen.getByRole('button', { name: cellName('AA') })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: cellName('AKs') })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
