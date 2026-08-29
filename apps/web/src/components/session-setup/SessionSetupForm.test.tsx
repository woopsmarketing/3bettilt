/**
 * The setup form as a user meets it. The server actions are plain fakes, which is the
 * whole reason they are props: this test must never load `@gto-self/db`.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { CP_NL50_6MAX_ANTE, SEAT_INDEXES } from '@gto-self/poker-core';
import type {
  SearchPlayersResult,
  SessionFormValue,
  StartSessionResult,
} from '../../lib/session-setup/contract.js';
import { initialSessionForm } from '../../lib/session-setup/plan.js';
import { SessionSetupForm } from './SessionSetupForm.js';

const noMatches = (): Promise<SearchPlayersResult> => Promise.resolve({ ok: true, matches: [] });

/** Three seated players, Hero and button on seat 1: the smallest valid session. */
function validForm(): SessionFormValue {
  const base = initialSessionForm(CP_NL50_6MAX_ANTE);
  return {
    ...base,
    seats: base.seats.map((seat, index) =>
      index < 3
        ? { ...seat, nickname: `Villain ${index}`, isHero: index === 0 }
        : { ...seat, occupancy: 'EMPTY' as const, isHero: false },
    ),
  };
}

const startButton = () => screen.getByRole('button', { name: /start session/i });

describe('SessionSetupForm', () => {
  it('disables Start Session and states the reason while the form is incomplete', () => {
    render(
      <SessionSetupForm
        startSession={() => Promise.resolve({ ok: false, issues: [] })}
        searchPlayers={noMatches}
        onStarted={vi.fn()}
      />,
    );
    expect(startButton()).toBeDisabled();
    // The reason is the actual first problem, not "invalid form".
    expect(screen.getAllByText(/a seated player needs a nickname/i).length).toBeGreaterThan(0);
    expect(startButton()).toHaveAttribute('aria-describedby', 'start-session-reason');
  });

  it('enables Start Session on a valid form and submits the entered TEXT', async () => {
    const user = userEvent.setup();
    const startSession = vi.fn((_input: SessionFormValue): Promise<StartSessionResult> =>
      Promise.resolve({ ok: true, sessionId: 'sess-42' }),
    );
    const onStarted = vi.fn();
    render(
      <SessionSetupForm
        startSession={startSession}
        searchPlayers={noMatches}
        onStarted={onStarted}
        initialForm={validForm()}
      />,
    );

    expect(startButton()).toBeEnabled();
    expect(screen.queryByText(/needs a nickname/i)).not.toBeInTheDocument();

    await user.click(startButton());
    await waitFor(() => expect(onStarted).toHaveBeenCalledWith('sess-42'));

    const submitted = startSession.mock.calls[0]?.[0];
    expect(submitted).toBeDefined();
    if (submitted === undefined) return;
    expect(submitted.seats[0]?.nickname).toBe('Villain 0');
    // Stacks travel as TEXT: no client-computed money number is transmitted.
    expect(submitted.seats[0]?.stackText).toBe('100');
    expect(Object.keys(submitted.seats[0] ?? {})).not.toContain('stack');
  });

  it('blocks Start Session on an unparseable stack and KEEPS what the user typed', async () => {
    const user = userEvent.setup();
    render(
      <SessionSetupForm
        startSession={() => Promise.resolve({ ok: false, issues: [] })}
        searchPlayers={noMatches}
        onStarted={vi.fn()}
        initialForm={validForm()}
      />,
    );

    const stack = screen.getByLabelText('Seat 2 stack in BB');
    await user.clear(stack);
    await user.type(stack, '1o0');

    expect(stack).toHaveValue('1o0');
    expect(startButton()).toBeDisabled();
    expect(screen.getAllByText(/not a number/i).length).toBeGreaterThan(0);
  });

  it('shows the number of milliBB a valid stack means, without rewriting the field', async () => {
    const user = userEvent.setup();
    render(
      <SessionSetupForm
        startSession={() => Promise.resolve({ ok: false, issues: [] })}
        searchPlayers={noMatches}
        onStarted={vi.fn()}
        initialForm={validForm()}
      />,
    );
    const stack = screen.getByLabelText('Seat 2 stack in BB');
    await user.clear(stack);
    await user.type(stack, '93.701');
    expect(stack).toHaveValue('93.701');
    expect(screen.getByText('93701 milliBB')).toBeInTheDocument();
  });

  it('reuses an existing player when one is picked from the autocomplete', async () => {
    const user = userEvent.setup();
    const searchPlayers = vi.fn((): Promise<SearchPlayersResult> =>
      Promise.resolve({
        ok: true,
        matches: [{ id: 'p-known', nickname: 'Nemesis', kind: 'PREFIX' }],
      }),
    );
    const startSession = vi.fn((_input: SessionFormValue): Promise<StartSessionResult> =>
      Promise.resolve({ ok: true, sessionId: 'sess-1' }),
    );
    render(
      <SessionSetupForm
        startSession={startSession}
        searchPlayers={searchPlayers}
        onStarted={vi.fn()}
        initialForm={validForm()}
      />,
    );

    const nickname = screen.getByLabelText('Seat 3 nickname');
    await user.clear(nickname);
    await user.type(nickname, 'Neme');

    const option = await screen.findByRole('button', { name: /Nemesis/ });
    await user.click(option);

    expect(nickname).toHaveValue('Nemesis');
    expect(searchPlayers).toHaveBeenCalled();

    await user.click(startButton());
    await waitFor(() => expect(startSession).toHaveBeenCalled());
    const submitted = startSession.mock.calls[0]?.[0];
    expect(submitted).toBeDefined();
    if (submitted === undefined) return;
    expect(submitted.seats[2]?.existingPlayerId).toBe('p-known');
  });

  it('says so when no existing player matches', async () => {
    const user = userEvent.setup();
    render(
      <SessionSetupForm
        startSession={() => Promise.resolve({ ok: false, issues: [] })}
        searchPlayers={noMatches}
        onStarted={vi.fn()}
        initialForm={validForm()}
      />,
    );
    await user.type(screen.getByLabelText('Seat 3 nickname'), 'Someone');
    expect(await screen.findByText(/no existing player matches/i)).toBeInTheDocument();
  });

  it('SHOWS a server rejection instead of swallowing it', async () => {
    const user = userEvent.setup();
    render(
      <SessionSetupForm
        startSession={() =>
          Promise.resolve({
            ok: false,
            issues: [
              {
                seat: 1,
                field: 'nickname',
                message: 'that player no longer exists',
                code: 'NOT_FOUND',
              },
            ],
          })
        }
        searchPlayers={noMatches}
        onStarted={vi.fn()}
        initialForm={validForm()}
      />,
    );
    await user.click(startButton());
    expect((await screen.findAllByText(/that player no longer exists/i)).length).toBeGreaterThan(0);
    expect(screen.getByText('NOT_FOUND')).toBeInTheDocument();
  });

  it('SHOWS a thrown server error rather than failing silently', async () => {
    const user = userEvent.setup();
    render(
      <SessionSetupForm
        startSession={() => Promise.reject(new Error('database is locked'))}
        searchPlayers={noMatches}
        onStarted={vi.fn()}
        initialForm={validForm()}
      />,
    );
    await user.click(startButton());
    expect((await screen.findAllByText(/database is locked/i)).length).toBeGreaterThan(0);
  });

  it('offers all six seats, the three occupancy states, and an optional HUD block', () => {
    render(
      <SessionSetupForm
        startSession={() => Promise.resolve({ ok: false, issues: [] })}
        searchPlayers={noMatches}
        onStarted={vi.fn()}
        initialForm={validForm()}
      />,
    );
    for (const seat of SEAT_INDEXES) {
      expect(screen.getByLabelText(`Seat ${seat + 1} occupancy`)).toBeInTheDocument();
      expect(screen.getByLabelText(`Seat ${seat + 1} is Hero`)).toBeInTheDocument();
      expect(screen.getByLabelText(`Seat ${seat + 1} has the button`)).toBeInTheDocument();
    }
    // HUD entry exists, is collapsed, and is never required to start.
    const hud = screen.getAllByText(/HUD snapshot \(optional\)/i);
    expect(hud.length).toBe(3);
    expect(startButton()).toBeEnabled();
  });

  it('makes a second Hero impossible and moves Hero instead', async () => {
    const user = userEvent.setup();
    render(
      <SessionSetupForm
        startSession={() => Promise.resolve({ ok: false, issues: [] })}
        searchPlayers={noMatches}
        onStarted={vi.fn()}
        initialForm={validForm()}
      />,
    );
    await user.click(screen.getByLabelText('Seat 3 is Hero'));
    expect(screen.getByLabelText('Seat 3 is Hero')).toBeChecked();
    expect(screen.getByLabelText('Seat 1 is Hero')).not.toBeChecked();
    expect(startButton()).toBeEnabled();
  });

  it("surfaces the ENGINE's verdict when the table cannot deal a hand", async () => {
    const user = userEvent.setup();
    render(
      <SessionSetupForm
        startSession={() => Promise.resolve({ ok: false, issues: [] })}
        searchPlayers={noMatches}
        onStarted={vi.fn()}
        initialForm={validForm()}
      />,
    );
    await user.selectOptions(screen.getByLabelText('Seat 2 occupancy'), 'EMPTY');
    await user.selectOptions(screen.getByLabelText('Seat 3 occupancy'), 'EMPTY');
    expect(startButton()).toBeDisabled();
    expect(screen.getAllByText(/At least two dealt-in seats are needed/i).length).toBeGreaterThan(
      0,
    );
  });
});
