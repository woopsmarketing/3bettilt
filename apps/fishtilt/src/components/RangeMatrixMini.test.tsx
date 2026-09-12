import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { COMBO_COUNT, RFI_RANGES, comboCountOf, percentageOf } from '@gto-self/strategy-core';
import { positionAccessibleName } from '../features/range/index.js';
import { RangeMatrixMini } from './RangeMatrixMini.js';

describe('RangeMatrixMini', () => {
  it('states the range size the packages compute, never a literal', () => {
    const utg = RFI_RANGES.UTG;
    expect(utg).not.toBeNull();
    if (utg === null) return;
    render(<RangeMatrixMini positions={['UTG']} showSelection={false} />);
    expect(
      screen.getByText(`${comboCountOf(utg).toLocaleString('ko-KR')}가지`),
    ).toBeInTheDocument();
    expect(screen.getByText(`${(percentageOf(utg) * 100).toFixed(1)}%`)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(COMBO_COUNT.toLocaleString('ko-KR'), 'u')),
    ).toBeInTheDocument();
  });

  it('keeps the conditions visible beside the chart (audit §6)', () => {
    render(<RangeMatrixMini positions={['BTN']} showSelection={false} />);
    expect(screen.getByText('학습용 기본 레인지')).toBeInTheDocument();
    expect(screen.getByText(/6인 · 100BB · 아무도 참여하지 않았을 때/u)).toBeInTheDocument();
  });

  it('renders no position toggle when only one position is offered', () => {
    render(<RangeMatrixMini positions={['BTN']} showSelection={false} />);
    expect(screen.queryByRole('group', { name: '자리 선택' })).not.toBeInTheDocument();
  });

  it('switches the chart when the reader presses another position', async () => {
    const user = userEvent.setup();
    const utg = RFI_RANGES.UTG;
    const btn = RFI_RANGES.BTN;
    if (utg === null || btn === null) throw new Error('fixture');
    render(<RangeMatrixMini positions={['UTG', 'BTN']} initial="UTG" showSelection={false} />);
    expect(
      screen.getByText(`${comboCountOf(utg).toLocaleString('ko-KR')}가지`),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: positionAccessibleName('BTN'), pressed: false }),
    );
    expect(
      screen.getByText(`${comboCountOf(btn).toLocaleString('ko-KR')}가지`),
    ).toBeInTheDocument();
  });

  it('shows the tapped hand’s detail when selection is on', async () => {
    const user = userEvent.setup();
    render(<RangeMatrixMini positions={['BTN']} />);
    expect(
      screen.getByText('표에서 핸드를 선택하면 자세한 정보를 볼 수 있어요.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^AKs /u }));
    expect(screen.getByText('에이스 킹 수티드')).toBeInTheDocument();
  });

  it('explains the big blind instead of drawing an empty or borrowed chart', () => {
    expect(RFI_RANGES.BB).toBeNull();
    render(<RangeMatrixMini positions={['BB']} showSelection={false} />);
    expect(
      screen.getByText(/빅블라인드는 첫 번째로 오픈하는 자리가 아닙니다/u),
    ).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /레인지/u })).not.toBeInTheDocument();
  });

  it('throws rather than rendering an empty chart when given no position', () => {
    expect(() => render(<RangeMatrixMini positions={[]} />)).toThrow(/at least one position/u);
  });
});
