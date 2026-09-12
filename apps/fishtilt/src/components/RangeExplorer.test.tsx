import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { positionAccessibleName, RANGE_PROVENANCE_SENTENCE } from '../features/range/index.js';
import { RangeExplorer } from './RangeExplorer.js';

function goTo(path: string) {
  window.history.pushState({}, '', path);
}

beforeEach(() => {
  goTo('/tools/range');
});

afterEach(() => {
  goTo('/tools/range');
});

describe('RangeExplorer', () => {
  it('defaults to BTN, RFI, 100BB and renders a real 169-cell matrix', async () => {
    render(<RangeExplorer />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: positionAccessibleName('BTN') })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    // 100BB / First In are no longer buttons (WP-S3-19, B-M3): the conditions block states them.
    expect(screen.getByRole('region', { name: '조건' })).toHaveTextContent('100BB');
    expect(
      screen.getAllByRole('button', { name: /^[2-9TJQKA]{2}[so]? .*,/u }).length,
    ).toBeGreaterThan(100);
  });

  it('shows the conditions and the always-visible methodology disclosure', async () => {
    render(<RangeExplorer />);
    await waitFor(() => {
      // Once in the conditions statement (B-M3) and once in the summary's condition line.
      expect(screen.getAllByText(/6인 · 100BB · 아무도 참여하지 않았을 때/).length).toBeGreaterThan(
        0,
      );
    });
    expect(screen.getByText('이 기준은 무엇인가요?')).toBeInTheDocument();
  });

  /*
   * WP-Q2 / P1-F7. The disclosure used to say the table was "여러 무료 포커 교육 자료를 참고해
   * 정리한" — a breadth of sourcing the data does not have. `strategy-core`'s own comment says
   * UTG/HJ/CO/BTN are transcribed verbatim from ONE public chart and that only SB is
   * recomputed here. This pins the corrected wording where it renders, and pins the specific
   * overstatement out.
   */
  it('describes the range with the one shared sentence, and claims no corroboration', async () => {
    render(<RangeExplorer />);
    await waitFor(() => {
      expect(screen.getByText(RANGE_PROVENANCE_SENTENCE, { exact: false })).toBeInTheDocument();
    });
    expect(document.body.textContent).not.toContain('여러 무료 포커 교육 자료');
    expect(document.body.textContent).not.toContain('다른 두 자료');
  });

  it('switching position updates the matrix and the URL, without a full navigation', async () => {
    const user = userEvent.setup();
    render(<RangeExplorer />);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: positionAccessibleName('BTN') }),
      ).toBeInTheDocument(),
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
    await waitFor(() => {
      expect(window.location.search).toBe('?hero=CO&spot=RFI&stack=100');
    });
  });

  it('reads hero/spot/stack from the URL on load', async () => {
    goTo('/tools/range?hero=SB&spot=RFI&stack=100');
    render(<RangeExplorer />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: positionAccessibleName('SB') })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  });

  it('ignores a garbled query string and falls back to the default', async () => {
    goTo('/tools/range?hero=NOPE&stack=9999');
    render(<RangeExplorer />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: positionAccessibleName('BTN') })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    expect(screen.getByRole('region', { name: '조건' })).toHaveTextContent('100BB');
  });

  it('selecting BB is honest, not a fabricated range', async () => {
    const user = userEvent.setup();
    render(<RangeExplorer />);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: positionAccessibleName('BTN') }),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: positionAccessibleName('BB') }));

    expect(
      await screen.findByText(/빅블라인드는 첫 번째로 오픈하는 자리가 아닙니다/),
    ).toBeInTheDocument();
    // The matrix is still there in its neutral (no-range-context) form, still explorable.
    expect(screen.getAllByRole('button', { name: /^AA .*(,|$)/u }).length).toBeGreaterThan(0);
  });

  it('clicking a hand cell shows its detail in the selected-hand panel', async () => {
    const user = userEvent.setup();
    render(<RangeExplorer />);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: positionAccessibleName('BTN') }),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: /^AKs .*,/u }));

    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(screen.getAllByText('AKs').length).toBeGreaterThan(0);
  });

  it('never mentions GTO', async () => {
    render(<RangeExplorer />);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: positionAccessibleName('BTN') }),
      ).toBeInTheDocument(),
    );
    expect(document.body.textContent?.toUpperCase()).not.toContain('GTO');
  });

  describe('Compare mode', () => {
    async function enterCompareMode() {
      const user = userEvent.setup();
      render(<RangeExplorer />);
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: positionAccessibleName('BTN') }),
        ).toBeInTheDocument(),
      );
      await user.click(screen.getByRole('button', { name: '다른 위치와 비교' }));
      return user;
    }

    it('defaults the compare target to UTG when hero is BTN, per the build spec example pair', async () => {
      await enterCompareMode();
      const group = screen.getByRole('group', { name: '비교할 위치' });
      expect(group).toHaveTextContent('UTG');
      // Hero (BTN) is not offered as its own compare target.
      const positionButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.textContent === 'BTN');
      // The position filter's own BTN button still exists (aria-pressed true); it must not
      // also appear inside the compare-target group.
      for (const button of positionButtons) {
        expect(button.closest('[aria-label="비교할 위치"]')).toBeNull();
      }
    });

    it('shows a real difference view once both sides resolve to real ranges', async () => {
      await enterCompareMode();
      expect(await screen.findByText(/에만 있는 조합/)).toBeInTheDocument();
      expect(screen.getByText('왜 넓이가 다를까요?')).toBeInTheDocument();
    });

    /*
     * WP-Q2 / P1-F2. Two defects in one card.
     *
     * It asserted that opening wider does not lose money — a profitability claim with no
     * dataset behind it, and the exact claim `content/blog/btn-why-wide.mdx` refuses. And its
     * mechanism ("앞사람들이 이미 폴드했을 가능성이 높아") was wrong for the spot it renders
     * on: these are RFI ranges, where everyone before hero has folded BY DEFINITION at every
     * seat, so that probability is the one quantity that does NOT vary across the comparison.
     *
     * This test fails against the original card on all three counts.
     */
    it('explains the width difference without a profitability claim or the folded-already mechanism', async () => {
      await enterCompareMode();
      await screen.findByText(/에만 있는 조합/);
      const body = document.body.textContent ?? '';

      expect(body).not.toContain('손해를 보지 않기 때문');
      expect(body).not.toContain('폴드했을 가능성이 높아');

      // What it says instead: the folded-already condition is shared, what differs is who is
      // still to act behind, and the site refuses the "이득" reading outright.
      expect(body).toContain('뒤에 아직 행동할 사람이 몇 명 남아 있는지');
      expect(body).toContain('이득이라거나');
      expect(body).toContain('범위 밖');
    });

    it('picking a different compare position changes the difference numbers', async () => {
      const user = await enterCompareMode();
      const before = (await screen.findByText(/에만 있는 조합/)).textContent;

      await user.click(
        within(screen.getByRole('group', { name: '비교할 위치' })).getByRole('button', {
          name: positionAccessibleName('SB'),
        }),
      );

      await waitFor(() => {
        const after = screen.getByText(/에만 있는 조합/).textContent;
        expect(after).not.toBe(before);
      });
    });

    it('never fabricates a difference view when one side is unsupported (BB)', async () => {
      const user = userEvent.setup();
      render(<RangeExplorer />);
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: positionAccessibleName('BTN') }),
        ).toBeInTheDocument(),
      );
      await user.click(screen.getByRole('button', { name: positionAccessibleName('BB') }));
      await user.click(screen.getByRole('button', { name: '다른 위치와 비교' }));

      expect(await screen.findByText('차이를 비교할 수 없습니다')).toBeInTheDocument();
    });
  });
});
