import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { makeCard, type Card } from '@gto-self/shared';
import type { ExactEquity } from '@gto-self/learn-core';
import { EQUITY_HERO_LABEL, EQUITY_TIE_LABEL, EQUITY_VILLAIN_LABEL } from '../features/tools/equity.js';
import { EquityCalculator } from './EquityCalculator.js';

const heroGroup = () => screen.getByRole('group', { name: '내 핸드 카드 선택' });
const villainGroup = () => screen.getByRole('group', { name: '상대 핸드 카드 선택' });
const boardGroup = () => screen.getByRole('group', { name: '보드 카드 선택' });

async function pick(user: ReturnType<typeof userEvent.setup>, group: HTMLElement, notation: string) {
  await user.click(within(group).getByRole('button', { name: `${notation} 선택` }));
}

/** A deliberately incomplete `ExactEquity` fixture — only the fields this component and
 *  `equity.ts`'s copy functions actually read are filled with real, self-consistent
 *  numbers. Used only to control WHEN a computation resolves and WHAT it resolves to, in
 *  tests that are about the async seam and the stale-result race, not about the real
 *  engine's own arithmetic (which `equity.test.ts` already pins with real fixtures). */
function fakeEquity(overrides: {
  readonly heroCards: readonly [Card, Card];
  readonly villainCards: readonly [Card, Card];
  readonly heroWinBps: number;
  readonly tieBps: number;
  readonly villainWinBps: number;
}): ExactEquity {
  return {
    heroCards: overrides.heroCards,
    villainCards: overrides.villainCards,
    board: [],
    wins: overrides.heroWinBps,
    ties: overrides.tieBps,
    losses: overrides.villainWinBps,
    runouts: 10000,
    unseenCards: 48,
    winProb: overrides.heroWinBps / 10000,
    tieProb: overrides.tieBps / 10000,
    loseProb: overrides.villainWinBps / 10000,
    equity: (overrides.heroWinBps + overrides.tieBps / 2) / 10000,
    heroWinBps: overrides.heroWinBps,
    tieBps: overrides.tieBps,
    villainWinBps: overrides.villainWinBps,
    method: 'EXACT',
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('EquityCalculator', () => {
  it('puts the answer above the pickers in the DOM, not only on screen', () => {
    /*
     * `docs/reports/REVIEW_BEGINNER_UX_SEO.md` M8: 결과 used to sit BELOW every picker, so at
     * 375px the reader could not see the number while changing the cards that produce it.
     * Asserted on DOM order rather than on CSS, because that is the half a screen reader and
     * the tab order follow — a `flex-order` trick would satisfy the eye and not this.
     */
    render(<EquityCalculator />);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings.indexOf('결과')).toBe(0);
    expect(headings.indexOf('결과')).toBeLessThan(headings.indexOf('카드를 선택하세요'));
  });

  it('opens with a worked example already evaluated: AA vs KK preflop', async () => {
    render(<EquityCalculator />);
    expect(await screen.findByText('정확 계산')).toBeInTheDocument();
    expect(screen.getByText(EQUITY_HERO_LABEL)).toBeInTheDocument();
    expect(screen.getByText(EQUITY_TIE_LABEL)).toBeInTheDocument();
    expect(screen.getByText(EQUITY_VILLAIN_LABEL)).toBeInTheDocument();

    const percents = await screen.findAllByText(/^\d{1,3}\.\d%$/u);
    expect(percents.length).toBe(3);

    const heroPercent = Number(percents[0]?.textContent?.replace('%', ''));
    const villainPercent = Number(percents[2]?.textContent?.replace('%', ''));
    // AA is a strict card-for-card favourite over KK — true of the real engine's own
    // output, whatever its exact magnitude.
    expect(heroPercent).toBeGreaterThan(villainPercent);
  });

  it('shows the enumeration count once resolved, and the beginner "computed, not estimated" sentence', async () => {
    render(<EquityCalculator />);
    expect(await screen.findByText(/카드 조합을 모두 계산했습니다\.$/u)).toBeInTheDocument();
    expect(screen.getByText(/1,712,304/u)).toBeInTheDocument();
    expect(screen.getByText(/같은 상황을 가능한 카드 조합으로 모두 계산한 결과입니다\./u)).toBeInTheDocument();
  });

  it('shows a real pending state and does not block first paint on the computation', () => {
    // A computation that never resolves — this proves the loading state is rendered on
    // first paint rather than only appearing after the (normally near-instant) real engine
    // call happens to finish.
    render(<EquityCalculator computeEquity={() => new Promise<ExactEquity>(() => {})} />);
    expect(screen.getByText('계산 중입니다')).toBeInTheDocument();
    // The card pickers are already interactive — first paint was not blocked waiting on it.
    expect(within(heroGroup()).getByRole('button', { name: '스페이드 A 선택됨' })).toBeEnabled();
  });

  it('prevents a duplicate card: once picked on one side, it is disabled everywhere else', async () => {
    const user = userEvent.setup();
    render(<EquityCalculator />);
    await user.click(screen.getByRole('button', { name: '카드 초기화' }));
    await pick(user, heroGroup(), '스페이드 Q');

    expect(within(villainGroup()).getByRole('button', { name: '스페이드 Q 사용됨' })).toBeDisabled();
    expect(within(boardGroup()).getByRole('button', { name: '스페이드 Q 사용됨' })).toBeDisabled();
  });

  it('reset clears all three pickers back to an incomplete, empty state', async () => {
    const user = userEvent.setup();
    render(<EquityCalculator />);
    await user.click(screen.getByRole('button', { name: '카드 초기화' }));

    expect(screen.getByText('내 핸드 카드를 2장 더 선택해주세요.')).toBeInTheDocument();
    expect(screen.getByText('상대 핸드 카드를 2장 더 선택해주세요.')).toBeInTheDocument();
    expect(within(heroGroup()).getByRole('button', { name: '스페이드 A 선택' })).toBeEnabled();
    expect(within(villainGroup()).getByRole('button', { name: '스페이드 A 선택' })).toBeEnabled();
  });

  it('swap exchanges hero and opponent hands', async () => {
    const user = userEvent.setup();
    render(<EquityCalculator />);
    await user.click(screen.getByRole('button', { name: '카드 초기화' }));
    await pick(user, heroGroup(), '스페이드 A');
    await pick(user, heroGroup(), '하트 A');
    await pick(user, villainGroup(), '스페이드 K');
    await pick(user, villainGroup(), '하트 K');

    await user.click(screen.getByRole('button', { name: '핸드 바꾸기' }));

    expect(within(heroGroup()).getByRole('button', { name: '스페이드 K 선택됨' })).toBeInTheDocument();
    expect(within(heroGroup()).getByRole('button', { name: '하트 K 선택됨' })).toBeInTheDocument();
    expect(within(villainGroup()).getByRole('button', { name: '스페이드 A 선택됨' })).toBeInTheDocument();
    expect(within(villainGroup()).getByRole('button', { name: '하트 A 선택됨' })).toBeInTheDocument();
  });

  it('blocks a 1-card and a 2-card board with a clear Korean explanation, never a silent guess', async () => {
    const user = userEvent.setup();
    render(<EquityCalculator />);
    await pick(user, boardGroup(), '스페이드 2');
    expect(
      await screen.findByText(/보드는 0장\(프리플랍\), 3장\(플랍\), 4장\(턴\), 5장\(리버\)/u),
    ).toBeInTheDocument();
    expect(screen.getByText(/지금 보드에 1장이 선택되어 있어서/u)).toBeInTheDocument();

    await pick(user, boardGroup(), '다이아몬드 3');
    expect(screen.getByText(/지금 보드에 2장이 선택되어 있어서/u)).toBeInTheDocument();
  });

  it('becomes computable again once the board reaches 3 cards', async () => {
    const user = userEvent.setup();
    render(<EquityCalculator />);
    await pick(user, boardGroup(), '스페이드 2');
    await pick(user, boardGroup(), '다이아몬드 3');
    await pick(user, boardGroup(), '하트 4');

    expect(screen.queryByText(/보드는 0장\(프리플랍\)/u)).not.toBeInTheDocument();
    expect(await screen.findByText('정확 계산')).toBeInTheDocument();
  });

  it('never says "GTO"', async () => {
    render(<EquityCalculator />);
    await screen.findByText('정확 계산');
    expect(document.body.textContent?.toUpperCase()).not.toContain('GTO');
  });

  it('never lets a stale, slower computation overwrite a newer, faster one', async () => {
    const user = userEvent.setup();
    const hero: readonly [Card, Card] = [makeCard('A', 's'), makeCard('A', 'h')];
    const slowVillain: readonly [Card, Card] = [makeCard('Q', 's'), makeCard('Q', 'h')];
    const fastVillain: readonly [Card, Card] = [makeCard('J', 's'), makeCard('J', 'h')];

    const slow = deferred<ExactEquity>();
    const fast = deferred<ExactEquity>();
    const calls: string[] = [];

    /** Keyed by the villain hand's actual card values (order-independent), not by call
     *  order — the component also fires a call on MOUNT for the default AA-vs-KK worked
     *  example, and that call must not be confused with the two this test cares about. Any
     *  call this test does not recognise (the initial KK one included) resolves immediately
     *  with a harmless placeholder so it can never block the test. */
    function keyOf(cards: readonly Card[]): string {
      return [...cards].sort((a, b) => a - b).join(',');
    }
    const slowKey = keyOf(slowVillain);
    const fastKey = keyOf(fastVillain);

    const computeEquity = (
      _requestHero: readonly Card[],
      requestVillain: readonly Card[],
      _board: readonly Card[],
    ) => {
      const key = keyOf(requestVillain);
      if (key === slowKey) {
        calls.push('slow');
        return slow.promise;
      }
      if (key === fastKey) {
        calls.push('fast');
        return fast.promise;
      }
      const [v0, v1] = requestVillain;
      return Promise.resolve(
        fakeEquity({
          heroCards: hero,
          villainCards: [v0 ?? hero[0], v1 ?? hero[1]],
          heroWinBps: 5000,
          tieBps: 0,
          villainWinBps: 5000,
        }),
      );
    };

    render(<EquityCalculator computeEquity={computeEquity} />);

    // Build hero = AA, villain = QQ — the first (soon-to-be-stale) READY selection.
    await user.click(screen.getByRole('button', { name: '카드 초기화' }));
    await pick(user, heroGroup(), '스페이드 A');
    await pick(user, heroGroup(), '하트 A');
    await pick(user, villainGroup(), '스페이드 Q');
    await pick(user, villainGroup(), '하트 Q');
    expect(calls).toEqual(['slow']);

    // Before the slow call resolves, change villain to JJ — a second, newer READY selection.
    // Deselect BOTH queens first (not swap one for one) so the intermediate states are
    // genuinely non-READY, exercising the cancellation path honestly rather than landing on
    // an accidental Q-J combo along the way.
    await user.click(within(villainGroup()).getByRole('button', { name: '스페이드 Q 선택됨' })); // deselect
    await user.click(within(villainGroup()).getByRole('button', { name: '하트 Q 선택됨' })); // deselect
    await pick(user, villainGroup(), '스페이드 J');
    await pick(user, villainGroup(), '하트 J');
    expect(calls).toEqual(['slow', 'fast']);

    // Resolve the FAST (second) request first — as if the network/worker genuinely answered
    // out of order — then resolve the SLOW (first, now-stale) one afterwards.
    fast.resolve(
      fakeEquity({
        heroCards: hero,
        villainCards: fastVillain,
        heroWinBps: 10000,
        tieBps: 0,
        villainWinBps: 0,
      }),
    );
    expect(await screen.findByText('100.0%')).toBeInTheDocument();

    slow.resolve(
      fakeEquity({
        heroCards: hero,
        villainCards: slowVillain,
        heroWinBps: 5000,
        tieBps: 0,
        villainWinBps: 5000,
      }),
    );
    // Give the (now-irrelevant) resolved promise a turn of the microtask queue.
    await Promise.resolve();
    await Promise.resolve();

    // The stale QQ answer (50.0%) must never appear — the fresh JJ answer (100.0%) stands.
    expect(screen.queryByText('50.0%')).not.toBeInTheDocument();
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });
});
