import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HUD_STAT_KEYS } from '@gto-self/player-core';
import { PlayerProfilePanel } from './PlayerProfilePanel.js';
import type {
  AddPlayerNoteAction,
  LoadPlayerProfileAction,
  PlayerProfileView,
  SaveHudSnapshotAction,
  SaveHudSnapshotInput,
} from '../../lib/table/contract.js';

function profile(overrides: Partial<PlayerProfileView> = {}): PlayerProfileView {
  return {
    playerId: 'player-1',
    nickname: 'Hero',
    displayAlias: null,
    archived: false,
    hud: null,
    externalHud: null,
    notes: [],
    warnings: [],
    ...overrides,
  };
}

describe('PlayerProfilePanel', () => {
  it('renders read-only when saveHudSnapshot/addNote are omitted (no forms shown)', async () => {
    const loadProfile: LoadPlayerProfileAction = vi.fn(async () => ({
      ok: true as const,
      profile: profile(),
    }));
    render(
      <PlayerProfilePanel
        playerId="player-1"
        nickname="Hero"
        loadProfile={loadProfile}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('player-profile')).toBeInTheDocument());
    expect(screen.queryByTestId('hud-edit-form')).not.toBeInTheDocument();
    expect(screen.queryByTestId('note-add-form')).not.toBeInTheDocument();
  });

  it('submits the HUD form and re-renders with the returned profile', async () => {
    const loadProfile: LoadPlayerProfileAction = vi.fn(async () => ({
      ok: true as const,
      profile: profile(),
    }));
    const updated = profile({
      hud: {
        recordedAt: 1_700_000_000_000,
        handSample: 500,
        stats: [{ key: 'VPIP', enteredText: '23.5' }],
      },
    });
    const saveHudSnapshot: SaveHudSnapshotAction = vi.fn(async () => ({
      ok: true as const,
      profile: updated,
    }));

    render(
      <PlayerProfilePanel
        playerId="player-1"
        nickname="Hero"
        loadProfile={loadProfile}
        saveHudSnapshot={saveHudSnapshot}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('hud-edit-form')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('hud-input-VPIP'), { target: { value: '23.5' } });
    fireEvent.change(screen.getByTestId('hud-input-handSample'), { target: { value: '500' } });
    fireEvent.click(screen.getByTestId('hud-save-button'));

    await waitFor(() => expect(saveHudSnapshot).toHaveBeenCalledTimes(1));
    expect(saveHudSnapshot).toHaveBeenCalledWith({
      playerId: 'player-1',
      stats: [{ key: 'VPIP', enteredText: '23.5' }],
      handSample: 500,
    });
    await waitFor(() => expect(screen.getByTestId('profile-hud')).toBeInTheDocument());
    expect(screen.getByTestId('profile-hud')).toHaveTextContent('23.5');
  });

  it('shows an inline error and does not lose the entered text on a validation failure', async () => {
    const loadProfile: LoadPlayerProfileAction = vi.fn(async () => ({
      ok: true as const,
      profile: profile(),
    }));
    const saveHudSnapshot: SaveHudSnapshotAction = vi.fn(async () => ({
      ok: false as const,
      message: 'stats[0].VPIP is not a valid percentage',
    }));

    render(
      <PlayerProfilePanel
        playerId="player-1"
        nickname="Hero"
        loadProfile={loadProfile}
        saveHudSnapshot={saveHudSnapshot}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('hud-edit-form')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('hud-input-VPIP'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByTestId('hud-save-button'));

    await waitFor(() =>
      expect(screen.getByTestId('hud-error')).toHaveTextContent('valid percentage'),
    );
  });

  it('submits the note form and appends the returned note', async () => {
    const loadProfile: LoadPlayerProfileAction = vi.fn(async () => ({
      ok: true as const,
      profile: profile(),
    }));
    const updated = profile({
      notes: [{ id: 'note-1', body: 'plays tight', createdAt: 1_700_000_000_000 }],
    });
    const addNote: AddPlayerNoteAction = vi.fn(async () => ({
      ok: true as const,
      profile: updated,
    }));

    render(
      <PlayerProfilePanel
        playerId="player-1"
        nickname="Hero"
        loadProfile={loadProfile}
        addNote={addNote}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('note-add-form')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('note-input'), { target: { value: 'plays tight' } });
    fireEvent.click(screen.getByTestId('note-add-button'));

    await waitFor(() =>
      expect(addNote).toHaveBeenCalledWith({
        playerId: 'player-1',
        body: 'plays tight',
      }),
    );
    await waitFor(() => expect(screen.getByText('plays tight')).toBeInTheDocument());
  });

  /**
   * All EIGHT `HudStatKey` members are reachable from the form.
   *
   * The four that were missing — `CBET_FLOP`, `FOLD_TO_CBET_FLOP`, `WTSD`, `WON_AT_SHOWDOWN` —
   * are exactly the postflop reads 상대 적응 · ADAPTIVE's rule table is keyed on, so with the
   * old four-field form a user could not hand-enter the readings that layer most wants. The
   * keys already validate server-side and the `player_hud_snapshot_stats` CHECK already
   * accepts them; no schema change was involved.
   */
  it('exposes all 8 HUD stat keys and submits every one the user filled in', async () => {
    expect(HUD_STAT_KEYS).toHaveLength(8);
    const loadProfile: LoadPlayerProfileAction = vi.fn(async () => ({
      ok: true as const,
      profile: profile(),
    }));
    const saveHudSnapshot: SaveHudSnapshotAction = vi.fn(async () => ({
      ok: true as const,
      profile: profile(),
    }));

    render(
      <PlayerProfilePanel
        playerId="player-1"
        nickname="Hero"
        loadProfile={loadProfile}
        saveHudSnapshot={saveHudSnapshot}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('hud-edit-form')).toBeInTheDocument());

    // Every key has an input, and every input takes a value.
    HUD_STAT_KEYS.forEach((key, index) => {
      const input = screen.getByTestId(`hud-input-${key}`);
      expect(input).toBeInTheDocument();
      fireEvent.change(input, { target: { value: String(10 + index) } });
    });
    fireEvent.change(screen.getByTestId('hud-input-handSample'), { target: { value: '250' } });
    fireEvent.click(screen.getByTestId('hud-save-button'));

    await waitFor(() => expect(saveHudSnapshot).toHaveBeenCalledTimes(1));
    expect(saveHudSnapshot).toHaveBeenCalledWith({
      playerId: 'player-1',
      stats: HUD_STAT_KEYS.map((key, index) => ({ key, enteredText: String(10 + index) })),
      handSample: 250,
    });
  });

  it('says what the hand-sample field is FOR, next to the field', async () => {
    const loadProfile: LoadPlayerProfileAction = vi.fn(async () => ({
      ok: true as const,
      profile: profile(),
    }));
    const saveHudSnapshot: SaveHudSnapshotAction = vi.fn(async () => ({
      ok: true as const,
      profile: profile(),
    }));
    render(
      <PlayerProfilePanel
        playerId="player-1"
        nickname="Hero"
        loadProfile={loadProfile}
        saveHudSnapshot={saveHudSnapshot}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('hud-edit-form')).toBeInTheDocument());

    // A reading with no sample carries no weight — the note has to say so, because a blank
    // box otherwise reads as optional detail.
    const note = screen.getByTestId('hud-sample-note');
    expect(note).toHaveTextContent('가중치');
    expect(note).toHaveTextContent('가중치 0');
  });
});

describe('PlayerProfilePanel — external HUD section (WP-K)', () => {
  it('renders "no external HUD" when the player was never bulk-imported', async () => {
    const loadProfile: LoadPlayerProfileAction = vi.fn(async () => ({
      ok: true as const,
      profile: profile({ externalHud: null }),
    }));
    render(<PlayerProfilePanel playerId="player-1" nickname="Hero" loadProfile={loadProfile} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('profile-no-external-hud')).toBeInTheDocument());
  });

  it('shows every reported stat, and UNKNOWN — never 0% — for one the source never reported', async () => {
    const loadProfile: LoadPlayerProfileAction = vi.fn(async () => ({
      ok: true as const,
      profile: profile({
        externalHud: {
          recordedAt: 1_700_000_000_000,
          sampleN: null,
          stats: [
            { key: 'VPIP', enteredText: '29' },
            { key: 'FOLD_TO_CBET_ANY_STREET', enteredText: '26' },
            // WTSD/WSD deliberately absent, mirroring Ssallabd/Dre4mTe4m in `prompt`.
          ],
        },
      }),
    }));
    render(<PlayerProfilePanel playerId="player-1" nickname="Hero" loadProfile={loadProfile} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('profile-external-hud')).toBeInTheDocument());
    expect(screen.getByTestId('external-hud-stat-VPIP')).toHaveTextContent('29%');
    expect(screen.getByTestId('external-hud-stat-FOLD_TO_CBET_ANY_STREET')).toHaveTextContent('26%');
    expect(screen.getByTestId('external-hud-stat-WTSD')).toHaveTextContent('알 수 없음');
    expect(screen.getByTestId('external-hud-stat-WTSD')).not.toHaveTextContent('0%');
    expect(screen.getByTestId('external-hud-stat-WSD')).toHaveTextContent('알 수 없음');
  });
});

describe('PlayerProfilePanel — editing one field keeps the other seven (review R1 MAJOR 4)', () => {
  const ALL_EIGHT = [
    { key: 'VPIP', enteredText: '23.5' },
    { key: 'PFR', enteredText: '18' },
    { key: 'THREE_BET', enteredText: '7.25' },
    { key: 'FOLD_TO_THREE_BET', enteredText: '55' },
    { key: 'CBET_FLOP', enteredText: '61' },
    { key: 'FOLD_TO_CBET_FLOP', enteredText: '44.5' },
    { key: 'WTSD', enteredText: '27' },
    { key: 'WON_AT_SHOWDOWN', enteredText: '52' },
  ] as const;

  const seeded = () =>
    profile({
      hud: { recordedAt: 1_700_000_000_000, handSample: 500, stats: [...ALL_EIGHT] },
    });

  it('pre-fills every field with the VERBATIM text the user originally entered', async () => {
    const loadProfile: LoadPlayerProfileAction = vi.fn(async () => ({
      ok: true as const,
      profile: seeded(),
    }));
    render(
      <PlayerProfilePanel
        playerId="player-1"
        nickname="Hero"
        loadProfile={loadProfile}
        saveHudSnapshot={vi.fn()}
        addNote={vi.fn()}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('hud-edit-form')).toBeInTheDocument());

    for (const stat of ALL_EIGHT) {
      // Verbatim, not a re-rendered parse of it (CLAUDE.md rule 3): '18' must not come back
      // as '18.00', and '7.25' must not be rounded.
      expect(screen.getByTestId(`hud-input-${stat.key}`)).toHaveValue(stat.enteredText);
    }
    expect(screen.getByTestId('hud-input-handSample')).toHaveValue('500');
  });

  it('submits all eight when only one was changed', async () => {
    // THE DEFECT: the form used to start empty, so a one-field edit appended a snapshot
    // containing ONLY that field and the other seven vanished from the effective profile
    // and from the ADAPTIVE model. The rows survived at rest (insert-only), so nothing was
    // destroyed — but the player's model silently lost seven readings.
    const loadProfile: LoadPlayerProfileAction = vi.fn(async () => ({
      ok: true as const,
      profile: seeded(),
    }));
    const saveHudSnapshot = vi.fn(async (_input: SaveHudSnapshotInput) => ({
      ok: true as const,
      profile: seeded(),
    }));
    render(
      <PlayerProfilePanel
        playerId="player-1"
        nickname="Hero"
        loadProfile={loadProfile}
        saveHudSnapshot={saveHudSnapshot as unknown as SaveHudSnapshotAction}
        addNote={vi.fn()}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('hud-edit-form')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('hud-input-VPIP'), { target: { value: '31' } });
    fireEvent.submit(screen.getByTestId('hud-edit-form'));

    await waitFor(() => expect(saveHudSnapshot).toHaveBeenCalledTimes(1));
    const sent = saveHudSnapshot.mock.calls[0]?.[0];

    expect(sent?.stats).toHaveLength(8);
    expect(sent?.stats.find((stat) => stat.key === 'VPIP')?.enteredText).toBe('31');
    // The seven untouched readings go up unchanged, with their original text.
    for (const stat of ALL_EIGHT.filter((entry) => entry.key !== 'VPIP')) {
      expect(sent?.stats.find((entry) => entry.key === stat.key)?.enteredText).toBe(
        stat.enteredText,
      );
    }
  });

  it('leaves a key the snapshot never had genuinely empty, and does not submit it', async () => {
    const loadProfile: LoadPlayerProfileAction = vi.fn(async () => ({
      ok: true as const,
      profile: profile({
        hud: {
          recordedAt: 1_700_000_000_000,
          handSample: null,
          stats: [{ key: 'VPIP', enteredText: '23.5' }],
        },
      }),
    }));
    const saveHudSnapshot = vi.fn(async (_input: SaveHudSnapshotInput) => ({
      ok: true as const,
      profile: profile(),
    }));
    render(
      <PlayerProfilePanel
        playerId="player-1"
        nickname="Hero"
        loadProfile={loadProfile}
        saveHudSnapshot={saveHudSnapshot as unknown as SaveHudSnapshotAction}
        addNote={vi.fn()}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('hud-edit-form')).toBeInTheDocument());

    expect(screen.getByTestId('hud-input-WTSD')).toHaveValue('');
    // An unknown hand count stays BLANK. Seeding it as '0' would invent a sample size.
    expect(screen.getByTestId('hud-input-handSample')).toHaveValue('');

    fireEvent.submit(screen.getByTestId('hud-edit-form'));
    await waitFor(() => expect(saveHudSnapshot).toHaveBeenCalledTimes(1));
    const sent = saveHudSnapshot.mock.calls[0]?.[0];
    expect(sent?.stats.map((stat) => stat.key)).toEqual(['VPIP']);
  });
});

/**
 * WP-3 / ADR-0076 — the quick external-HUD fix.
 *
 * Three properties are pinned here, and each one is a rule the design contract states in its
 * own words: the form is PRE-FILLED but the save is an APPEND and says so; a blank field is an
 * ABSENT row and never a `0`; and the manual-HUD form stays a separate form (ADR-0069), not a
 * merged one.
 */
describe('PlayerProfilePanel — external HUD quick edit', () => {
  const externalProfile = () =>
    profile({
      externalHud: {
        recordedAt: 1_700_000_000_000,
        sampleN: null,
        stats: [
          { key: 'VPIP', enteredText: '24.5' },
          { key: 'PFR', enteredText: '18' },
        ],
      },
    });

  const loader = () =>
    vi.fn<LoadPlayerProfileAction>(async () => ({ ok: true as const, profile: externalProfile() }));

  it('stays read-only when no save action is supplied', async () => {
    render(
      <PlayerProfilePanel
        playerId="player-1"
        nickname="Hero"
        loadProfile={loader()}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('player-profile')).toBeInTheDocument());
    expect(screen.queryByTestId('external-hud-edit-form')).not.toBeInTheDocument();
  });

  it('pre-fills from the latest snapshot and says the save APPENDS a new one', async () => {
    const saveExternalHud = vi.fn(async () => ({ ok: true as const, appended: true }));
    render(
      <PlayerProfilePanel
        playerId="player-1"
        nickname="Hero"
        loadProfile={loader()}
        saveExternalHud={saveExternalHud}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('external-hud-edit-form')).toBeInTheDocument());

    // Verbatim, not re-formatted (`CLAUDE.md` rule 3).
    expect(screen.getByTestId('external-hud-input-VPIP')).toHaveValue('24.5');
    expect(screen.getByTestId('external-hud-input-PFR')).toHaveValue('18');
    // A pre-filled form otherwise reads as an in-place edit; this table is insert-only.
    expect(screen.getByTestId('external-hud-append-notice')).toHaveTextContent('덮어쓰지 않고');
    expect(screen.getByTestId('external-hud-append-notice')).toHaveTextContent('새 스냅샷');
  });

  it('OMITS a blank field rather than sending it as 0, and reports the append', async () => {
    const saveExternalHud = vi.fn(async () => ({ ok: true as const, appended: true }));
    render(
      <PlayerProfilePanel
        playerId="player-1"
        nickname="Hero"
        loadProfile={loader()}
        saveExternalHud={saveExternalHud}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('external-hud-edit-form')).toBeInTheDocument());

    // Clearing PFR means "we no longer have this reading", NOT "this player never raises".
    fireEvent.change(screen.getByTestId('external-hud-input-PFR'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('external-hud-input-WTSD'), { target: { value: '28' } });
    fireEvent.click(screen.getByTestId('external-hud-save-button'));

    await waitFor(() => expect(saveExternalHud).toHaveBeenCalledTimes(1));
    expect(saveExternalHud).toHaveBeenCalledWith({ VPIP: '24.5', WTSD: '28' });
    expect(await screen.findByTestId('external-hud-result')).toHaveTextContent('추가했습니다');
  });

  it('says plainly when an identical entry appended nothing', async () => {
    const saveExternalHud = vi.fn(async () => ({ ok: true as const, appended: false }));
    render(
      <PlayerProfilePanel
        playerId="player-1"
        nickname="Hero"
        loadProfile={loader()}
        saveExternalHud={saveExternalHud}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('external-hud-edit-form')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('external-hud-save-button'));

    expect(await screen.findByTestId('external-hud-result')).toHaveTextContent(
      '새로 추가하지 않았습니다',
    );
  });

  it('shows a refusal and keeps the typed text', async () => {
    const saveExternalHud = vi.fn(async () => ({
      ok: false as const,
      message: 'INVALID_INPUT: VPIP must be between 0 and 100',
    }));
    render(
      <PlayerProfilePanel
        playerId="player-1"
        nickname="Hero"
        loadProfile={loader()}
        saveExternalHud={saveExternalHud}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('external-hud-edit-form')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('external-hud-input-VPIP'), { target: { value: '250' } });
    fireEvent.click(screen.getByTestId('external-hud-save-button'));

    expect(await screen.findByTestId('external-hud-error')).toHaveTextContent('INVALID_INPUT');
    expect(screen.getByTestId('external-hud-input-VPIP')).toHaveValue('250');
  });

  it('keeps the manual HUD form separate from the external one (ADR-0069)', async () => {
    const saveExternalHud = vi.fn(async () => ({ ok: true as const, appended: true }));
    const saveHudSnapshot: SaveHudSnapshotAction = vi.fn(async () => ({
      ok: true as const,
      profile: externalProfile(),
    }));
    render(
      <PlayerProfilePanel
        playerId="player-1"
        nickname="Hero"
        loadProfile={loader()}
        saveHudSnapshot={saveHudSnapshot}
        saveExternalHud={saveExternalHud}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('external-hud-edit-form')).toBeInTheDocument());

    expect(screen.getByTestId('hud-edit-form')).toBeInTheDocument();
    expect(screen.getByTestId('external-hud-edit-form')).not.toContainElement(
      screen.getByTestId('hud-edit-form'),
    );
    // The two forms address different keys: `CBET_FLOP` is manual-only, `STEAL` external-only.
    expect(screen.getByTestId('hud-input-CBET_FLOP')).toBeInTheDocument();
    expect(screen.getByTestId('external-hud-input-STEAL')).toBeInTheDocument();
  });
});
