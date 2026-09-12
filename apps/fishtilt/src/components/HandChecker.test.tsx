import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { makeCard } from '@gto-self/shared';
import { evaluateHandRank } from '../features/tools/handRank.js';
import { HandChecker } from './HandChecker.js';

const holeGroup = () => screen.getByRole('group', { name: '핸드 카드 선택' });
const boardGroup = () => screen.getByRole('group', { name: '보드 카드 선택' });

async function pick(user: ReturnType<typeof userEvent.setup>, group: HTMLElement, notation: string) {
  await user.click(within(group).getByRole('button', { name: `${notation} 선택` }));
}

describe('HandChecker', () => {
  it('opens with a worked example already evaluated — two pair, aces and kings', () => {
    render(<HandChecker />);
    expect(screen.getByText('투페어')).toBeInTheDocument();
    expect(screen.getByText('에이스와 킹 투페어')).toBeInTheDocument();
    expect(screen.getByText('9개 족보 중 7번째로 강한 족보입니다.')).toBeInTheDocument();
    expect(screen.getAllByText(/키커 \(Kicker\)/u).length).toBeGreaterThan(0);
  });

  it('shows every selected card as 사용됨 when both hole cards contribute', () => {
    render(<HandChecker />);
    expect(screen.getAllByText('사용됨').length).toBe(5);
    expect(screen.queryByText('사용 안 됨')).not.toBeInTheDocument();
  });

  it('shows the best five cards on their own', () => {
    render(<HandChecker />);
    expect(screen.getByRole('group', { name: '카드' })).toBeInTheDocument();
  });

  it('prevents a duplicate card: once picked on one side, it is disabled on the other', async () => {
    const user = userEvent.setup();
    render(<HandChecker />);
    await user.click(screen.getByRole('button', { name: '카드 초기화' }));
    await pick(user, holeGroup(), '스페이드 Q');
    // The exact same card is now unavailable in the BOARD picker, without being clicked
    // there at all.
    const boardCopy = within(boardGroup()).getByRole('button', { name: '스페이드 Q 사용됨' });
    expect(boardCopy).toBeDisabled();
  });

  it('reset clears both pickers back to an incomplete, empty state', async () => {
    const user = userEvent.setup();
    render(<HandChecker />);
    await user.click(screen.getByRole('button', { name: '카드 초기화' }));
    expect(
      screen.getByText(/카드를 더 선택하면 족보를 확인할 수 있어요\./u),
    ).toBeInTheDocument();
    expect(screen.getByText(/지금은 0장을 골랐습니다\. 5장 더 선택해주세요\./u)).toBeInTheDocument();
    // Every card is selectable again on both sides.
    expect(within(holeGroup()).getByRole('button', { name: '스페이드 A 선택' })).toBeEnabled();
    expect(within(boardGroup()).getByRole('button', { name: '스페이드 A 선택' })).toBeEnabled();
  });

  it('counts down as cards are added, one at a time', async () => {
    const user = userEvent.setup();
    render(<HandChecker />);
    await user.click(screen.getByRole('button', { name: '카드 초기화' }));
    await pick(user, holeGroup(), '스페이드 A');
    expect(screen.getByText(/지금은 1장을 골랐습니다\. 4장 더 선택해주세요\./u)).toBeInTheDocument();
    await pick(user, holeGroup(), '스페이드 K');
    expect(screen.getByText(/지금은 2장을 골랐습니다\. 3장 더 선택해주세요\./u)).toBeInTheDocument();
  });

  it('evaluates a real full house picked entirely through the UI, and names the ranks in order', async () => {
    const user = userEvent.setup();
    render(<HandChecker />);
    await user.click(screen.getByRole('button', { name: '카드 초기화' }));
    await pick(user, holeGroup(), '하트 A');
    await pick(user, holeGroup(), '다이아몬드 A');
    await pick(user, boardGroup(), '스페이드 A');
    await pick(user, boardGroup(), '클럽 K');
    await pick(user, boardGroup(), '다이아몬드 K');
    expect(screen.getByText('풀하우스')).toBeInTheDocument();
    expect(screen.getByText('에이스 풀하우스, 킹 포함')).toBeInTheDocument();
  });

  it('says the board plays alone when a 5-card board already beats both hole cards', async () => {
    const user = userEvent.setup();
    render(<HandChecker />);
    await user.click(screen.getByRole('button', { name: '카드 초기화' }));
    await pick(user, holeGroup(), '스페이드 2');
    await pick(user, holeGroup(), '다이아몬드 3');
    await pick(user, boardGroup(), '하트 T');
    await pick(user, boardGroup(), '하트 J');
    await pick(user, boardGroup(), '하트 Q');
    await pick(user, boardGroup(), '하트 K');
    await pick(user, boardGroup(), '하트 A');
    expect(screen.getByText('로열 플러시 (Royal Flush)')).toBeInTheDocument();

    /*
     * The note's WORDING belongs to `features/tools/handRank.ts` and is pinned by that
     * module's own tests; what this component test owns is that the component actually puts
     * the engine's note on screen. Transcribing the sentence here made this file a second,
     * silently-stale copy of it — which is exactly what happened when WP-Q2 corrected the
     * note (`docs/reports/WP_P1_POKER_CORRECTNESS_REVIEW.md` F11): the copy moved and this
     * assertion kept pinning the old words. Derived from the same call the component makes,
     * so it stays an assertion rather than a transcription.
     */
    const expected = evaluateHandRank(
      [makeCard('2', 's'), makeCard('3', 'd')],
      [makeCard('T', 'h'), makeCard('J', 'h'), makeCard('Q', 'h'), makeCard('K', 'h'), makeCard('A', 'h')],
    );
    if (expected.status === 'INCOMPLETE') throw new Error('fixture: seven cards must evaluate');
    expect(expected.note, 'the board-plays case must carry a teaching note').not.toBeNull();
    expect(screen.getByText(expected.note ?? '')).toBeInTheDocument();

    // Both hole cards are marked as NOT used, in text as well as by opacity.
    expect(screen.getAllByText('사용 안 됨')).toHaveLength(2);
  });

  it('puts the answer above the pickers in the DOM, not only on screen', () => {
    /*
     * `docs/reports/REVIEW_BEGINNER_UX_SEO.md` M8: 결과 used to sit BELOW every picker, so at
     * 375px the reader could not see the number while changing the cards that produce it.
     * Asserted on DOM order rather than on CSS, because that is the half a screen reader and
     * the tab order follow — a `flex-order` trick would satisfy the eye and not this.
     */
    render(<HandChecker />);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings.indexOf('결과')).toBe(0);
    expect(headings.indexOf('결과')).toBeLessThan(headings.indexOf('카드를 선택하세요'));
  });

  it('never says "GTO"', () => {
    render(<HandChecker />);
    expect(document.body.textContent?.toUpperCase()).not.toContain('GTO');
  });
});
