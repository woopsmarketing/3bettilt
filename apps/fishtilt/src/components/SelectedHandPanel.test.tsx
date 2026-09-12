import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { handClassByKey, handClassSet } from '@gto-self/strategy-core';
import { SelectedHandPanel } from './SelectedHandPanel.js';

const AKS = handClassByKey('AKs');
const AKO = handClassByKey('AKo');
const KK = handClassByKey('KK');

describe('SelectedHandPanel', () => {
  it('renders a prompt when nothing is selected', () => {
    render(<SelectedHandPanel handClass={null} />);
    expect(
      screen.getByText('표에서 핸드를 선택하면 자세한 정보를 볼 수 있어요.'),
    ).toBeInTheDocument();
  });

  it('renders the Latin class key', () => {
    if (!AKS) throw new Error('AKs missing from HAND_CLASSES');
    render(<SelectedHandPanel handClass={AKS} />);
    expect(screen.getByText('AKs')).toBeInTheDocument();
  });

  it('renders the plain-Korean reading for a suited class, exactly as the audit example', () => {
    if (!AKS) throw new Error('AKs missing from HAND_CLASSES');
    render(<SelectedHandPanel handClass={AKS} />);
    expect(screen.getByText('같은 무늬의 A와 K')).toBeInTheDocument();
  });

  it('renders a distinct reading for the offsuit sibling', () => {
    if (!AKO) throw new Error('AKo missing from HAND_CLASSES');
    render(<SelectedHandPanel handClass={AKO} />);
    expect(screen.getByText('다른 무늬의 A와 K')).toBeInTheDocument();
  });

  it('renders two example cards with real accessible names', () => {
    if (!AKS) throw new Error('AKs missing from HAND_CLASSES');
    render(<SelectedHandPanel handClass={AKS} />);
    const group = screen.getByRole('group', { name: '예시 카드' });
    expect(group.querySelectorAll('[role="img"]')).toHaveLength(2);
  });

  it('renders the combo count and 1326-universe share, both read from the packages', () => {
    if (!AKS) throw new Error('AKs missing from HAND_CLASSES');
    const { container } = render(<SelectedHandPanel handClass={AKS} />);
    // AKs: 4 combos / 1326, 0.30%. Asserted against the container's full text because the
    // sentence legitimately spans several sibling text nodes and a <strong>.
    expect(screen.getByText('4가지')).toBeInTheDocument();
    expect(container.textContent).toContain('1,326가지');
    expect(container.textContent).toMatch(/0\.30%/);
  });

  it('renders a pair distinctly, spelling any face rank out (no bare-letter ambiguity)', () => {
    if (!KK) throw new Error('KK missing from HAND_CLASSES');
    render(<SelectedHandPanel handClass={KK} />);
    expect(screen.getByText('같은 숫자 두 장 (K 페어)')).toBeInTheDocument();
  });

  it('says nothing about range membership when no range is given', () => {
    if (!AKS) throw new Error('AKs missing from HAND_CLASSES');
    render(<SelectedHandPanel handClass={AKS} />);
    expect(screen.queryByText('지금 보고 있는 레인지에 포함되어 있어요')).not.toBeInTheDocument();
    expect(
      screen.queryByText('지금 보고 있는 레인지에는 포함되어 있지 않아요'),
    ).not.toBeInTheDocument();
  });

  it('states membership in words when a range is given — in range', () => {
    if (!AKS) throw new Error('AKs missing from HAND_CLASSES');
    render(<SelectedHandPanel handClass={AKS} range={handClassSet('AKs')} />);
    expect(screen.getByText('지금 보고 있는 레인지에 포함되어 있어요')).toBeInTheDocument();
  });

  it('states membership in words when a range is given — out of range', () => {
    if (!AKO) throw new Error('AKo missing from HAND_CLASSES');
    render(<SelectedHandPanel handClass={AKO} range={handClassSet('AKs')} />);
    expect(screen.getByText('지금 보고 있는 레인지에는 포함되어 있지 않아요')).toBeInTheDocument();
  });
});
