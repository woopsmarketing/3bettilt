import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StartingHandExplorer } from './StartingHandExplorer.js';

function goTo(path: string) {
  window.history.pushState({}, '', path);
}

beforeEach(() => {
  goTo('/tools/starting-hand');
});

afterEach(() => {
  goTo('/tools/starting-hand');
});

describe('StartingHandExplorer', () => {
  it('defaults to "상위 X% 보기" at 15% and renders all 169 cells', async () => {
    render(<StartingHandExplorer />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '상위 X% 보기' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    expect(screen.getByRole('slider')).toHaveValue('15');
    expect(screen.getAllByRole('button', { name: /^[2-9TJQKA]{2}[so]? .*, 레인지/u }).length).toBe(
      169,
    );
  });

  it('highlights AA as included and the weakest classes as excluded at the default 15%', async () => {
    render(<StartingHandExplorer />);
    await waitFor(() => expect(screen.getByRole('slider')).toHaveValue('15'));
    expect(screen.getByRole('button', { name: /^AA .*, 레인지 포함/u })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^32o .*, 레인지 밖/u })).toBeInTheDocument();
  });

  it('moving the slider changes the highlighted set live', async () => {
    render(<StartingHandExplorer />);
    await waitFor(() => expect(screen.getByRole('slider')).toHaveValue('15'));

    // 32o is not included at 15% (asserted above); at 100% every class is included.
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '100' } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^32o .*, 레인지 포함/u })).toBeInTheDocument();
    });
  });

  it('switching to "강한 패 순서" hides the slider and shows a neutral, unhighlighted matrix', async () => {
    const user = userEvent.setup();
    render(<StartingHandExplorer />);
    await waitFor(() => expect(screen.getByRole('slider')).toHaveValue('15'));

    await user.click(screen.getByRole('button', { name: '강한 패 순서' }));

    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^AA /u })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /레인지/ })).not.toBeInTheDocument();
  });

  it('clicking a hand cell shows its rank, top-share and equity in the panel', async () => {
    const user = userEvent.setup();
    render(<StartingHandExplorer />);
    await waitFor(() => expect(screen.getByRole('slider')).toHaveValue('15'));

    await user.click(screen.getByRole('button', { name: /^AA .*,/u }));

    expect(screen.getByText('169개 중 1위')).toBeInTheDocument();
    expect(screen.getByText('85.20%')).toBeInTheDocument();
  });

  it('rank ordering is right at the extremes: AA is always included, 32o only at 100%', async () => {
    render(<StartingHandExplorer />);
    await waitFor(() => expect(screen.getByRole('slider')).toHaveValue('15'));

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '1' } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^AA .*, 레인지 포함/u })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /^32o .*, 레인지 밖/u })).toBeInTheDocument();
  });

  it('keeps the mode and percent in the URL, and reads them back on load', async () => {
    const user = userEvent.setup();
    render(<StartingHandExplorer />);
    await waitFor(() => expect(screen.getByRole('slider')).toHaveValue('15'));

    await user.click(screen.getByRole('button', { name: '강한 패 순서' }));
    await waitFor(() => {
      expect(window.location.search).toBe('?view=RANK&pct=15');
    });
  });

  it('reads view/pct from the URL on load', async () => {
    goTo('/tools/starting-hand?view=RANK&pct=40');
    render(<StartingHandExplorer />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '강한 패 순서' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('ignores a garbled query string and falls back to the default', async () => {
    goTo('/tools/starting-hand?view=NOPE&pct=9999');
    render(<StartingHandExplorer />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '상위 X% 보기' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    expect(screen.getByRole('slider')).toHaveValue('15');
  });

  it('never mentions GTO', async () => {
    render(<StartingHandExplorer />);
    await waitFor(() => expect(screen.getByRole('slider')).toHaveValue('15'));
    expect(document.body.textContent?.toUpperCase()).not.toContain('GTO');
  });
});
