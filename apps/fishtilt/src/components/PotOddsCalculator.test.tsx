import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { potOdds } from '@gto-self/learn-core';
import { PotOddsCalculator } from './PotOddsCalculator.js';

function goTo(path: string) {
  window.history.pushState({}, '', path);
}

beforeEach(() => {
  goTo('/tools/pot-odds');
});

afterEach(() => {
  goTo('/tools/pot-odds');
});

/*
 * The properties this suite exists to hold:
 *
 *   - the answer is on screen before anyone types (show first, explain after);
 *   - every figure rendered equals what `potOdds` returns for the same inputs — the test
 *     recomputes through the domain rather than hard-coding a percentage, so a change in
 *     `learn-core` cannot pass here while breaking the page;
 *   - a bad input produces a Korean explanation, never a silently corrected value;
 *   - the uncalled remainder is shown when it exists.
 */
function requiredEquityFor(pot: number, bet: number, call: number): string {
  const result = potOdds({
    potBeforeCallMbb: Money.fromBB(pot),
    villainBetMbb: Money.fromBB(bet),
    callAmountMbb: Money.fromBB(call),
  });
  if (!result.ok) throw new Error(`fixture is not a legal call: ${result.error}`);
  return `${(result.value.requiredEquity * 100).toFixed(1)}%`;
}

const potField = () => screen.getByLabelText('지금 팟에 있는 돈');
const betField = () => screen.getByLabelText('상대가 베팅한 금액');

/*
 * WP-Q2 / P2-M10. `content/blog/pot-odds-quick.mdx` walks a 9BB/6BB hand and links
 * `/tools/pot-odds?pot=9&bet=6`; the calculator seeded from its own constants and opened on
 * 10/5, so the article promised one example and the tool showed another. These fail against
 * the original component, which never read `window.location`.
 */
describe('PotOddsCalculator — deep links', () => {
  it('seeds the fields from ?pot=&bet=, matching the article that links here', async () => {
    goTo('/tools/pot-odds?pot=9&bet=6');
    render(<PotOddsCalculator />);
    await waitFor(() => expect(potField()).toHaveValue('9'));
    expect(betField()).toHaveValue('6');
    expect(screen.getByText(requiredEquityFor(9, 6, 6))).toBeInTheDocument();
  });

  it('takes each parameter on its own, leaving the default for the other', async () => {
    goTo('/tools/pot-odds?bet=6');
    render(<PotOddsCalculator />);
    await waitFor(() => expect(betField()).toHaveValue('6'));
    expect(potField()).toHaveValue('10');
  });

  it('falls back to the default for a malformed or out-of-range parameter, never throwing', async () => {
    goTo('/tools/pot-odds?pot=abc&bet=1e999');
    render(<PotOddsCalculator />);
    await waitFor(() => expect(potField()).toHaveValue('10'));
    expect(betField()).toHaveValue('5');
    expect(screen.getByText(requiredEquityFor(10, 5, 5))).toBeInTheDocument();
  });

  it('keeps the all-in call field in step with the bet it was seeded from', async () => {
    const user = userEvent.setup();
    goTo('/tools/pot-odds?pot=9&bet=6');
    render(<PotOddsCalculator />);
    await waitFor(() => expect(betField()).toHaveValue('6'));
    await user.click(screen.getByLabelText('내 스택이 모자라서 더 적게 콜해요 (올인)'));
    expect(screen.getByLabelText('내가 실제로 낼 수 있는 금액')).toHaveValue('6');
  });
});

describe('PotOddsCalculator', () => {
  it('shows a finished answer before the reader touches anything', () => {
    render(<PotOddsCalculator />);
    expect(potField()).toHaveValue('10');
    expect(betField()).toHaveValue('5');
    expect(screen.getByText(requiredEquityFor(10, 5, 5))).toBeInTheDocument();
    expect(screen.getByText(requiredEquityFor(10, 5, 5))).toHaveTextContent('25.0%');
  });

  it('recomputes from the domain when the pot changes', async () => {
    const user = userEvent.setup();
    render(<PotOddsCalculator />);
    await user.clear(potField());
    await user.type(potField(), '20');
    expect(screen.getByText(requiredEquityFor(20, 5, 5))).toBeInTheDocument();
  });

  it('states the pot after the call, the one-in-N form and the odds form', () => {
    render(<PotOddsCalculator />);
    // "콜한 뒤의 팟" appears twice on purpose: once as the headline figure and once as the
    // line of the worked calculation that produces it.
    expect(screen.getAllByText('콜한 뒤의 팟')).toHaveLength(2);
    expect(screen.getAllByText('20 BB').length).toBeGreaterThan(0);
    expect(screen.getByText('4.0번 중 1번')).toBeInTheDocument();
    expect(screen.getByText('3.0 : 1')).toBeInTheDocument();
  });

  it('writes out the calculation with the reader’s own numbers', () => {
    render(<PotOddsCalculator />);
    expect(screen.getByText('계산 과정')).toBeInTheDocument();
    expect(screen.getByText('10 + 5 + 5 = 20 BB')).toBeInTheDocument();
    expect(screen.getByText('5 ÷ 20 = 25.0%')).toBeInTheDocument();
  });

  it('sets the bet from a pot fraction, showing the exact amount it used', async () => {
    const user = userEvent.setup();
    render(<PotOddsCalculator />);
    await user.click(screen.getByRole('button', { name: '1/3 팟' }));
    // 10 BB / 3 is 3.3333... BB; the field shows the milliBB the calculator actually used.
    expect(betField()).toHaveValue('3.333');
    expect(screen.getByText(requiredEquityFor(10, 3.333, 3.333))).toBeInTheDocument();
  });

  it('explains a non-numeric entry instead of ignoring it', async () => {
    const user = userEvent.setup();
    render(<PotOddsCalculator />);
    await user.clear(betField());
    await user.type(betField(), '다섯');
    expect(screen.getByRole('alert')).toHaveTextContent('숫자만 입력할 수 있습니다');
    expect(screen.getByText('아직 계산할 수 없습니다')).toBeInTheDocument();
  });

  it('refuses a fourth decimal rather than rounding it away behind the reader', async () => {
    const user = userEvent.setup();
    render(<PotOddsCalculator />);
    await user.clear(betField());
    await user.type(betField(), '2.3755');
    expect(screen.getByRole('alert')).toHaveTextContent('소수점은 셋째 자리까지만');
    expect(betField()).toHaveValue('2.3755');
  });

  it('renders the domain’s own reason when the numbers are not a call', async () => {
    const user = userEvent.setup();
    render(<PotOddsCalculator />);
    await user.clear(betField());
    await user.type(betField(), '0');
    expect(screen.getByText('이 상황은 계산할 수 없습니다')).toBeInTheDocument();
    expect(screen.getByText(/콜 금액은 0보다 커야 합니다/u)).toBeInTheDocument();
  });

  it('rejects a negative pot with the domain’s reason, not a clamped zero', async () => {
    const user = userEvent.setup();
    render(<PotOddsCalculator />);
    await user.clear(potField());
    await user.type(potField(), '-4');
    expect(potField()).toHaveValue('-4');
    expect(screen.getByText(/팟에 들어 있는 돈은 0보다 작을 수 없습니다/u)).toBeInTheDocument();
  });

  it('shows the uncalled remainder when the caller is all-in for less', async () => {
    const user = userEvent.setup();
    render(<PotOddsCalculator />);
    await user.click(screen.getByLabelText(/내 스택이 모자라서/u));
    const callField = screen.getByLabelText('내가 실제로 낼 수 있는 금액');
    await user.clear(callField);
    await user.type(callField, '2');

    expect(screen.getByText('상대에게 돌아가는 금액')).toBeInTheDocument();
    expect(screen.getByText('3 BB')).toBeInTheDocument();
    expect(screen.getByText(requiredEquityFor(10, 5, 2))).toBeInTheDocument();
  });

  it('refuses a call larger than the bet instead of trimming it', async () => {
    const user = userEvent.setup();
    render(<PotOddsCalculator />);
    await user.click(screen.getByLabelText(/내 스택이 모자라서/u));
    const callField = screen.getByLabelText('내가 실제로 낼 수 있는 금액');
    await user.clear(callField);
    await user.type(callField, '9');
    expect(callField).toHaveValue('9');
    expect(screen.getByText(/콜 금액이 상대의 베팅보다 클 수는 없습니다/u)).toBeInTheDocument();
  });

  it('answers the same price in outs, and says what that comparison assumes', () => {
    render(<PotOddsCalculator />);
    expect(screen.getByText('그래서 아웃이 몇 장 필요한가요?')).toBeInTheDocument();
    expect(screen.getByText(/뒤에 추가 베팅이 없다고 가정/u)).toBeInTheDocument();
  });

  it('never says "GTO"', () => {
    render(<PotOddsCalculator />);
    expect(document.body.textContent?.toUpperCase()).not.toContain('GTO');
  });
});
