import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { SearchPlayersResult } from '../../lib/session-setup/contract.js';
import { SeatPlayerSwapPanel, type SeatPlayerSwapResult, type SeatPlayerSwapSubmit } from './SeatPlayerSwapPanel.js';

/**
 * The "새 플레이어 추가" quickline is an ADDITIVE shortcut over `ExternalHudEntryFields`
 * (see that component's and this panel's own doc comments, ADR-0079/ADR-0076): it only ever
 * writes into the same `hudText` state the detailed ten-field form already owns. These tests
 * exercise the quickline itself and confirm the detailed form, the stack field, and the
 * `PLAYER_EXISTS` duplicate-nickname path are all untouched by its presence.
 */
function renderPanel(onSubmit?: (input: SeatPlayerSwapSubmit) => Promise<SeatPlayerSwapResult>) {
  const submit = onSubmit ?? vi.fn(async () => ({ ok: true }) as SeatPlayerSwapResult);
  const onClose = vi.fn();
  render(
    <SeatPlayerSwapPanel
      seat={0}
      seatEmpty={false}
      currentPlayerId={null}
      seatedPlayerSeats={{}}
      searchPlayers={vi.fn(async (): Promise<SearchPlayersResult> => ({ ok: true, matches: [] }))}
      onSubmit={submit}
      onClose={onClose}
    />,
  );
  return { submit, onClose };
}

const VALID_LINE = '24 19 8 62 31 55 47 11 27 52';

describe('SeatPlayerSwapPanel — quick HUD line', () => {
  it('applying a valid quickline populates the detailed ExternalHudEntryFields inputs', () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('seat-0-swap-mode-new'));

    fireEvent.change(screen.getByTestId('seat-0-swap-hud-quickline'), {
      target: { value: VALID_LINE },
    });
    fireEvent.click(screen.getByTestId('seat-0-swap-hud-quickline-apply'));

    expect(screen.getByTestId('seat-0-swap-hud-VPIP')).toHaveValue('24');
    expect(screen.getByTestId('seat-0-swap-hud-PFR')).toHaveValue('19');
    expect(screen.getByTestId('seat-0-swap-hud-WSD')).toHaveValue('52');
    expect(screen.queryByTestId('seat-0-swap-hud-quickline-error')).toBeNull();
  });

  it('pressing Enter in the quickline input applies it too', () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('seat-0-swap-mode-new'));

    fireEvent.change(screen.getByTestId('seat-0-swap-hud-quickline'), {
      target: { value: VALID_LINE },
    });
    fireEvent.keyDown(screen.getByTestId('seat-0-swap-hud-quickline'), { key: 'Enter' });

    expect(screen.getByTestId('seat-0-swap-hud-VPIP')).toHaveValue('24');
  });

  it('an invalid quickline shows the Korean error and does NOT populate the detailed fields', () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('seat-0-swap-mode-new'));

    fireEvent.change(screen.getByTestId('seat-0-swap-hud-quickline'), {
      target: { value: '24 19 8' },
    });
    fireEvent.click(screen.getByTestId('seat-0-swap-hud-quickline-apply'));

    const error = screen.getByTestId('seat-0-swap-hud-quickline-error');
    expect(error).toHaveAttribute('role', 'alert');
    expect(error.textContent).toMatch(/개 값이 필요합니다/);
    expect(screen.getByTestId('seat-0-swap-hud-VPIP')).toHaveValue('');
  });

  it('renders a live preview list as the user types, without touching the detailed fields', () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('seat-0-swap-mode-new'));

    fireEvent.change(screen.getByTestId('seat-0-swap-hud-quickline'), {
      target: { value: VALID_LINE },
    });

    const preview = screen.getByTestId('seat-0-swap-hud-quickline-preview');
    expect(preview).toHaveTextContent('24%');
    expect(preview).toHaveTextContent('52%');
    // Not yet applied — the detailed field is still blank.
    expect(screen.getByTestId('seat-0-swap-hud-VPIP')).toHaveValue('');
  });

  it('shows "-" as unknown in the preview and omits it from the applied fields', () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('seat-0-swap-mode-new'));

    fireEvent.change(screen.getByTestId('seat-0-swap-hud-quickline'), {
      target: { value: '24 - 8 62 31 55 47 11 27 52' },
    });

    const preview = screen.getByTestId('seat-0-swap-hud-quickline-preview');
    expect(preview).toHaveTextContent('알 수 없음');

    fireEvent.click(screen.getByTestId('seat-0-swap-hud-quickline-apply'));
    expect(screen.getByTestId('seat-0-swap-hud-PFR')).toHaveValue('');
  });

  it('still allows typing directly into the detailed ten-field form', () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('seat-0-swap-mode-new'));

    fireEvent.change(screen.getByTestId('seat-0-swap-hud-VPIP'), { target: { value: '33' } });
    expect(screen.getByTestId('seat-0-swap-hud-VPIP')).toHaveValue('33');
  });

  it('leaves the PLAYER_EXISTS duplicate-nickname flow unaffected', async () => {
    const submit = vi.fn(
      async (): Promise<SeatPlayerSwapResult> => ({
        ok: false,
        message: 'PLAYER_EXISTS: nickname taken',
        code: 'PLAYER_EXISTS',
      }),
    );
    renderPanel(submit);
    fireEvent.click(screen.getByTestId('seat-0-swap-mode-new'));

    fireEvent.change(screen.getByTestId('seat-0-swap-nickname'), { target: { value: 'Nobody' } });
    fireEvent.click(screen.getByTestId('seat-0-swap-submit'));

    expect(await screen.findByTestId('seat-0-swap-exists')).toBeInTheDocument();
    expect(screen.getByTestId('seat-0-swap-error')).toHaveTextContent('PLAYER_EXISTS');
    // The refusal switches the panel back to PICK mode with the typed name pre-searched.
    expect(screen.getByTestId('seat-0-swap-mode-pick')).toHaveAttribute('aria-pressed', 'true');
  });
});
