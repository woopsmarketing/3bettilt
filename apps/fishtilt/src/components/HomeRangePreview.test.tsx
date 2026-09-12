import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { comboCountOf, percentageOf, RFI_RANGES } from '@gto-self/strategy-core';
import {
  positionAccessibleName,
  RANGE_LABEL,
  UNSUPPORTED_REASON_LABEL,
} from '../features/range/index.js';
import { HomeRangePreview } from './HomeRangePreview.js';

/*
 * Every expected number here is computed from `strategy-core` inside the test, never typed
 * as a literal: the test proves the component SHOWS THE DATASET, and stays correct if the
 * dataset is ever regenerated.
 */
function comboText(range: Parameters<typeof comboCountOf>[0]): string {
  return `${comboCountOf(range).toLocaleString('ko-KR')}가지`;
}

describe('HomeRangePreview', () => {
  it('opens on a position that has data and states that position’s own numbers', () => {
    const btn = RFI_RANGES.BTN;
    if (btn === null) throw new Error('fixture: BTN has no range');
    render(<HomeRangePreview />);
    expect(screen.getByText(comboText(btn))).toBeInTheDocument();
    expect(screen.getByText(`${(percentageOf(btn) * 100).toFixed(1)}%`)).toBeInTheDocument();
  });

  it('keeps the label and the conditions visible beside the chart', () => {
    render(<HomeRangePreview />);
    expect(screen.getByText(new RegExp(RANGE_LABEL, 'u'))).toBeInTheDocument();
    expect(screen.getByText(/6인 · 100BB · 아무도 참여하지 않았을 때/u)).toBeInTheDocument();
  });

  it('changes the rendered matrix and the numbers when another position is pressed', async () => {
    const user = userEvent.setup();
    const btn = RFI_RANGES.BTN;
    const utg = RFI_RANGES.UTG;
    if (btn === null || utg === null) throw new Error('fixture: missing range');
    expect(comboCountOf(btn)).not.toBe(comboCountOf(utg));

    render(<HomeRangePreview />);
    expect(screen.getByText(comboText(btn))).toBeInTheDocument();
    expect(
      screen.getByRole('group', {
        name: `${positionAccessibleName('BTN')}의 ${RANGE_LABEL} 표`,
      }),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: positionAccessibleName('UTG') }));

    expect(screen.getByText(comboText(utg))).toBeInTheDocument();
    expect(screen.queryByText(comboText(btn))).not.toBeInTheDocument();
    expect(
      screen.getByRole('group', {
        name: `${positionAccessibleName('UTG')}의 ${RANGE_LABEL} 표`,
      }),
    ).toBeVisible();
  });

  it('exposes the selected position to assistive tech with aria-pressed', async () => {
    const user = userEvent.setup();
    render(<HomeRangePreview />);
    expect(screen.getByRole('button', { name: positionAccessibleName('BTN') })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: positionAccessibleName('CO') })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await user.click(screen.getByRole('button', { name: positionAccessibleName('CO') }));

    expect(screen.getByRole('button', { name: positionAccessibleName('CO') })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: positionAccessibleName('BTN') })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('announces the answer through a live region, and never the 169-cell grid', () => {
    const btn = RFI_RANGES.BTN;
    if (btn === null) throw new Error('fixture: BTN has no range');
    render(<HomeRangePreview />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(within(status).getByText(comboText(btn))).toBeInTheDocument();
    expect(within(status).queryByRole('group', { name: /레인지 표/u })).not.toBeInTheDocument();
  });

  it('explains a position with no data instead of drawing an empty grid', async () => {
    const user = userEvent.setup();
    expect(RFI_RANGES.BB).toBeNull();

    render(<HomeRangePreview />);
    await user.click(screen.getByRole('button', { name: positionAccessibleName('BB') }));

    expect(screen.getByText(UNSUPPORTED_REASON_LABEL.BB_HAS_NO_RFI_RANGE)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /레인지 표/u })).not.toBeInTheDocument();
    // Nothing that looks like a range: no combo count, no share.
    expect(screen.queryByText(/이 레인지에 포함됩니다/u)).not.toBeInTheDocument();
  });

  it('never renders the string GTO', () => {
    const { container } = render(<HomeRangePreview />);
    expect(container.textContent ?? '').not.toContain('GTO');
  });
});
