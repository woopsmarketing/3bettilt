import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { handClassByKey } from '@gto-self/strategy-core';
import { HAND_STRENGTH, handStrengthOf } from '@gto-self/learn-core';
import { StartingHandPanel } from './StartingHandPanel.js';

const AA = handClassByKey('AA');
const AKS = handClassByKey('AKs');
const WEAKEST_KEY = HAND_STRENGTH.entries[HAND_STRENGTH.entries.length - 1]?.key;

describe('StartingHandPanel', () => {
  it('renders the same prompt as SelectedHandPanel when nothing is selected', () => {
    render(<StartingHandPanel handClass={null} />);
    expect(
      screen.getByText('표에서 핸드를 선택하면 자세한 정보를 볼 수 있어요.'),
    ).toBeInTheDocument();
  });

  it('reuses SelectedHandPanel for the key, reading, cards and combo count', () => {
    if (!AKS) throw new Error('AKs missing from HAND_CLASSES');
    render(<StartingHandPanel handClass={AKS} />);
    expect(screen.getByText('AKs')).toBeInTheDocument();
    expect(screen.getByText('에이스 킹 수티드')).toBeInTheDocument();
    expect(screen.getByText('같은 무늬의 A와 K')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '예시 카드' })).toBeInTheDocument();
  });

  it('never shows the Range Explorer’s membership wording — there is no range on this page', () => {
    if (!AKS) throw new Error('AKs missing from HAND_CLASSES');
    render(<StartingHandPanel handClass={AKS} />);
    expect(screen.queryByText('지금 보고 있는 레인지에 포함되어 있어요')).not.toBeInTheDocument();
    expect(
      screen.queryByText('지금 보고 있는 레인지에는 포함되어 있지 않아요'),
    ).not.toBeInTheDocument();
  });

  it('shows AA at rank 1 of 169, its real cumulative share and its real equity', () => {
    if (!AA) throw new Error('AA missing from HAND_CLASSES');
    const entry = handStrengthOf(AA);
    render(<StartingHandPanel handClass={AA} />);
    expect(screen.getByText(`169개 중 ${entry.rank}위`)).toBeInTheDocument();
    expect(screen.getByText('상위 0.45%')).toBeInTheDocument();
    expect(screen.getByText('85.20%')).toBeInTheDocument();
  });

  it('shows the weakest class (rank 169) with a rank that matches the shipped data', () => {
    if (WEAKEST_KEY === undefined) throw new Error('HAND_STRENGTH.entries is empty');
    const weakest = handClassByKey(WEAKEST_KEY);
    if (!weakest) throw new Error(`${WEAKEST_KEY} missing from HAND_CLASSES`);
    render(<StartingHandPanel handClass={weakest} />);
    expect(screen.getByText(`169개 중 ${HAND_STRENGTH.entries.length}위`)).toBeInTheDocument();
    expect(screen.getByText('상위 100.00%')).toBeInTheDocument();
  });

  it('shows no tie note for any of the 169 classes — the shipped dataset has no exact ties', () => {
    if (!AKS) throw new Error('AKs missing from HAND_CLASSES');
    render(<StartingHandPanel handClass={AKS} />);
    expect(screen.queryByText(/공동 순위/)).not.toBeInTheDocument();
  });
});
