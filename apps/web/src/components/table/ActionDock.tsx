'use client';

/**
 * The fixed bottom action bar — the keyboard-first action path.
 *
 * Four rules hold in this file:
 *
 * 1. **The path is local and synchronous.** A keypress calls a `poker-core` function
 *    through the store and React re-renders. There is no `await`, no fetch, no server
 *    action and no database anywhere on it (`prompt` D1).
 * 2. **No poker fact is computed here.** Legality, the call amount, the min/max raise,
 *    the pot and the whole preview come from `view.phase.actor` and `previewWager`, which
 *    are projections of the engine's own state (`prompt` D2). The only money expression
 *    in this file is `Money.isZero(call.amount)` for the CHECK/CALL split, and that
 *    agrees with `legal.canCheck` by construction.
 * 3. **No float reaches the engine.** The raise editor's text goes through
 *    `Money.parseBB` and nothing else; `wagerCommand` turns the resulting `MilliBB` into
 *    the BET or RAISE command (`CLAUDE.md` rule 1).
 * 4. **User input is never destroyed.** A refused entry stays on screen with the engine's
 *    own reason and bounds beside it (`CLAUDE.md` rule 3).
 *
 * Buttons and hotkeys are the same thing: both run a `DockAction` out of the single
 * `actions` table below, so a guard can never be true for the mouse and false for the
 * keyboard.
 *
 * **Language.** Labels are Korean; the hotkey letters `F C R A Z N` and `BB` stay Latin,
 * because they are physical key positions and international poker vocabulary rather than
 * words. An engine string — `wagerBlockedBy`, an `EngineError` code and message — is
 * rendered VERBATIM inside a Korean sentence (`CLAUDE.md` rule 3): the user sees the
 * engine's own verdict, never a paraphrase of it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, Ref } from 'react';
import { Money } from '@gto-self/shared';
import type { MilliBB } from '@gto-self/shared';
import {
  POT_FRACTION_SHORTCUTS,
  previewWager,
  wagerCommand,
  wagerToForPotFraction,
} from '@gto-self/poker-core';
import type { HandView, LegalActions, RaisePreview } from '@gto-self/poker-core';
import { canStartHand } from '../../lib/table/tableStore.js';
import { resolveTypedKey } from '../../lib/table/keys.js';
import { useTableStore } from './TableStoreProvider.js';

const bb = (amount: MilliBB): string => Money.formatBB(amount, { maxDecimals: 3 });
const bbUnit = (amount: MilliBB): string => Money.formatBB(amount, { maxDecimals: 3, unit: true });

/** The keys this dock owns. `Enter` / `Esc` belong to the editor, not to this table. */
type HotkeyId = 'F' | 'C' | 'R' | 'A' | 'Z' | 'N';

const HOTKEY_IDS: readonly HotkeyId[] = ['F', 'C', 'R', 'A', 'Z', 'N'];

interface DockAction {
  readonly label: string;
  readonly detail: string | undefined;
  /** True when the action can be taken right now. Drives BOTH `disabled` and the key. */
  readonly enabled: boolean;
  readonly run: () => void;
}

/**
 * True for anything the user could be typing into. The hotkey layer is a window listener,
 * so without this guard the session-setup fields and the raise editor would fold the
 * hand. Duck-typed rather than `instanceof HTMLElement`, which is unreliable across
 * realms and under happy-dom.
 *
 * Exported because it is the table's ONE answer to "is this keystroke the user typing?".
 * `TableRoot`'s `Esc` listener reuses it rather than growing a second convention.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as (HTMLElement & { isContentEditable?: boolean }) | null;
  if (element === null || typeof element.tagName !== 'string') return false;
  if (element.isContentEditable === true) return true;
  const tag = element.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

interface DockButtonProps {
  readonly hotkey: HotkeyId;
  readonly action: DockAction;
  readonly buttonRef?: Ref<HTMLButtonElement>;
}

function DockButton({ hotkey, action, buttonRef }: DockButtonProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={!action.enabled}
      onClick={() => {
        // Same guard the keyboard uses. A disabled button cannot fire this anyway; the
        // check is here so the two paths are provably identical.
        if (action.enabled) action.run();
      }}
      data-testid={`dock-${hotkey}`}
      data-legal={action.enabled ? 'true' : 'false'}
      className={`flex min-w-[5rem] flex-col items-start justify-center rounded-md border px-2.5 py-1 text-left ${
        action.enabled
          ? 'border-ink-500 bg-surface-700 text-ink-100 hover:border-actor-500'
          : 'border-surface-700 bg-surface-800 text-ink-700'
      }`}
    >
      {/* Hotkey and label share ONE line: the legend is unobtrusive and the dock costs a
          line less of the viewport it must never be pushed out of. */}
      <span className="flex items-baseline gap-1.5">
        <kbd className="tabular text-[0.65rem] tracking-widest text-ink-500">{hotkey}</kbd>
        <span className="text-sm font-medium">{action.label}</span>
      </span>
      <span className="tabular h-[0.85rem] text-[0.65rem] leading-[0.85rem] text-ink-500">
        {action.detail ?? ''}
      </span>
    </button>
  );
}

export interface ActionDockProps {
  readonly view: HandView | null;
  /**
   * The Phase 7 mode gate. True while the card palette owns the keyboard, and then this
   * dock's hotkey layer is INERT — `A` is an ace, `C` is clubs, and neither reaches the
   * hand. It is state, not listener ordering: the palette and this dock read the same
   * boolean out of the same React commit, so exactly one of them can act on a keystroke.
   * The buttons are unaffected; a click is unambiguous and still works.
   */
  readonly hotkeysSuppressed?: boolean;
}

export function ActionDock({ view, hotkeysSuppressed = false }: ActionDockProps) {
  // `hand` is needed by `previewWager` / `wagerToForPotFraction`, which take engine state.
  // It is the SAME store commit `view` came from, so the two cannot disagree.
  const hand = useTableStore((state) => state.hand);
  const apply = useTableStore((state) => state.apply);
  const undo = useTableStore((state) => state.undo);
  const startHand = useTableStore((state) => state.startHand);
  const startable = useTableStore(canStartHand);

  const [raiseText, setRaiseText] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  /** Set by a submit attempt, so an empty field only complains once asked to confirm. */
  const [attempted, setAttempted] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const raiseButtonRef = useRef<HTMLButtonElement | null>(null);

  const legal: LegalActions | null =
    view !== null && view.phase.kind === 'AWAITING_ACTION' ? view.phase.actor.legal : null;
  const actor = view !== null && view.phase.kind === 'AWAITING_ACTION' ? view.phase.actor : null;
  const call = legal?.call ?? null;
  const wager = legal?.wager ?? null;
  const allIn = legal?.allIn ?? null;
  // The engine's own CHECK/CALL split: `legal.call` is null exactly when the call is zero.
  const isCheck = legal !== null && (call === null || Money.isZero(call.amount));

  /** Puts focus back on a control the window-level hotkey layer can still hear from. */
  const releaseEditor = useCallback(() => {
    const button = raiseButtonRef.current;
    if (button !== null && !button.disabled) button.focus();
    else inputRef.current?.blur();
  }, []);

  const openEditor = useCallback(() => {
    setEditorOpen(true);
    // The input is always mounted (disabled when no wager is legal), so no layout effect
    // is needed to reach it.
    const input = inputRef.current;
    if (input !== null) {
      input.focus();
      input.select();
    }
  }, []);

  const closeEditor = useCallback(() => {
    // The typed text is KEPT: `Esc` cancels the dispatch, it does not discard input.
    setEditorOpen(false);
    setAttempted(false);
    releaseEditor();
  }, [releaseEditor]);

  // ---------------------------------------------------------------------------
  // The raise preview. Every number below is the engine's.
  // ---------------------------------------------------------------------------
  const parsed = useMemo(() => Money.parseBB(raiseText), [raiseText]);
  const preview: RaisePreview | null = useMemo(() => {
    if (!parsed.ok || hand === null || actor === null) return null;
    return previewWager(hand.state, actor.seat, parsed.value);
  }, [parsed, hand, actor]);

  const showProblem = attempted || raiseText.trim() !== '';
  let problem: string | null = null;
  if (showProblem && wager !== null) {
    if (!parsed.ok) {
      problem =
        raiseText.trim() === ''
          ? '레이즈 금액(BB)을 입력하세요.'
          : // `parsed.error` is the parser's own reason, kept verbatim (rule 3).
            `금액을 읽을 수 없습니다 (${parsed.error}). 레이즈 금액은 9 또는 2.375 같은 BB 값입니다.`;
    } else if (preview !== null && !preview.legal && preview.error !== null) {
      // The engine's own code and message, unchanged; only the bounds sentence is ours.
      problem = `${preview.error.code}: ${preview.error.message} — 최소 ${bb(
        preview.minToAmount,
      )} BB, 최대 ${bb(preview.maxToAmount)} BB.`;
    }
  }
  const canSubmit = parsed.ok && preview !== null && preview.legal;

  const submitRaise = useCallback(() => {
    setAttempted(true);
    if (view === null || !parsed.ok) return;
    // Out of range is refused HERE, on the engine's own verdict, rather than dispatching
    // a known-illegal size to read the rejection back off the error banner.
    if (preview === null || !preview.legal) return;
    const command = wagerCommand(view, parsed.value);
    if (!command.ok) return;
    apply(command.value);
    // The amount was consumed by a successful action, so the field is no longer holding
    // input the user still needs.
    setRaiseText('');
    setEditorOpen(false);
    setAttempted(false);
    releaseEditor();
  }, [view, parsed, preview, apply, releaseEditor]);

  /** Fills the editor from the engine's sizing helper. No arithmetic happens here. */
  const applyShortcut = useCallback(
    (fraction: number) => {
      if (hand === null || actor === null) return;
      const suggestion = wagerToForPotFraction(hand.state, actor.seat, fraction, 'round');
      if (!suggestion.ok) return;
      // `formatBB(_, { maxDecimals: 3 })` round-trips every integer milliBB exactly, so
      // the text the user then confirms parses back to precisely this amount.
      setRaiseText(bb(suggestion.value.toAmount));
      setAttempted(false);
      setEditorOpen(true);
      inputRef.current?.focus();
    },
    [hand, actor],
  );

  // ---------------------------------------------------------------------------
  // The single action table. Buttons and hotkeys both read it.
  // ---------------------------------------------------------------------------
  const actions: Readonly<Record<HotkeyId, DockAction>> = {
    F: {
      label: '폴드',
      detail: undefined,
      enabled: legal?.canFold ?? false,
      run: () => apply({ kind: 'FOLD' }),
    },
    C: {
      label: isCheck ? '체크' : '콜',
      detail: call === null ? undefined : bbUnit(call.amount),
      enabled: legal !== null && (isCheck ? legal.canCheck : true),
      run: () => apply(isCheck ? { kind: 'CHECK' } : { kind: 'CALL' }),
    },
    R: {
      label: wager?.kind === 'BET' ? '벳' : '레이즈',
      detail:
        wager === null
          ? (legal?.wagerBlockedBy ?? undefined)
          : `${bb(wager.minToAmount)} – ${bb(wager.maxToAmount)}`,
      enabled: wager !== null,
      run: openEditor,
    },
    A: {
      label: '올인',
      detail: allIn === null ? undefined : bbUnit(allIn.toAmount),
      enabled: allIn !== null,
      run: () => apply({ kind: 'ALL_IN' }),
    },
    Z: {
      label: '되돌리기',
      detail: undefined,
      enabled: view?.canUndo ?? false,
      run: undo,
    },
    N: {
      label: '다음 핸드',
      detail: undefined,
      // Phase 8 owns Observe mode, dirty stacks and manual overrides. All `N` does here is
      // the store's real settle -> top up -> advance button -> deal, and only between
      // hands: `canStartHand` is false while a hand is live.
      enabled: startable,
      run: startHand,
    },
  };

  // ---------------------------------------------------------------------------
  // The hotkey layer: one window listener, added once and removed on unmount.
  // ---------------------------------------------------------------------------
  const onHotkey = (event: KeyboardEvent): void => {
    // Never steal a browser or OS chord (Cmd+R, Ctrl+Z, ...), and never repeat-fire an
    // action from a held key.
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
    // The mode gate. Nothing below runs while the card palette owns the keyboard.
    if (hotkeysSuppressed) return;
    if (isTypingTarget(event.target)) return;

    // `Escape` is a named key, not a hotkey letter: it is read straight off `event.key`
    // and never routed through the IME-resolver below, exactly as before.
    if (event.key.toLowerCase() === 'escape') {
      if (editorOpen) closeEditor();
      return;
    }
    // Resolves to the physical letter the user typed regardless of active input method —
    // see `lib/table/keys.ts`. A Korean IME (or any other) rewrites `event.key`, but never
    // `event.code`.
    const resolved = resolveTypedKey(event);
    if (resolved === null) return;
    const id = resolved.toUpperCase() as HotkeyId;
    if (!HOTKEY_IDS.includes(id)) return;

    // An illegal action is inert. The key is still swallowed so it cannot type into
    // something else, but nothing is dispatched "to see what the engine says".
    event.preventDefault();
    const action = actions[id];
    if (action.enabled) action.run();
  };

  const hotkeyRef = useRef(onHotkey);
  // No dependency array: the ref must hold THIS render's closure, so the listener always
  // sees the current view, legality and editor state.
  useEffect(() => {
    hotkeyRef.current = onHotkey;
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => hotkeyRef.current(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const onEditorKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitRaise();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeEditor();
    }
  };

  return (
    <section
      data-testid="action-dock"
      className="flex shrink-0 flex-col gap-1.5 border-t border-surface-700 bg-surface-900 px-3 py-2"
      aria-label="액션"
    >
      <div className="flex items-center gap-1.5">
        <DockButton hotkey="F" action={actions.F} />
        <DockButton hotkey="C" action={actions.C} />
        <DockButton hotkey="R" action={actions.R} buttonRef={raiseButtonRef} />
        <DockButton hotkey="A" action={actions.A} />
        <DockButton hotkey="Z" action={actions.Z} />
        <DockButton hotkey="N" action={actions.N} />

        <div className="ml-auto flex items-center gap-2">
          <label
            htmlFor="raise-to"
            className="text-[0.65rem] uppercase tracking-widest text-ink-500"
          >
            {wager?.kind === 'BET' ? '벳' : '레이즈'} (BB)
          </label>
          <input
            id="raise-to"
            ref={inputRef}
            data-testid="raise-input"
            // Deliberately `text`, not `number`: a number input silently discards "1.2.3"
            // and "abc", and this field must show the user exactly what they typed.
            type="text"
            inputMode="decimal"
            autoComplete="off"
            disabled={wager === null}
            value={raiseText}
            onChange={(event) => setRaiseText(event.target.value)}
            onKeyDown={onEditorKeyDown}
            onFocus={() => setEditorOpen(true)}
            placeholder={wager === null ? '—' : bb(wager.minToAmount)}
            className="tabular w-28 rounded-md border border-surface-600 bg-surface-800 px-2 py-1 text-sm text-ink-100 disabled:text-ink-700"
          />
          <button
            type="button"
            data-testid="raise-confirm"
            disabled={!canSubmit}
            onClick={submitRaise}
            className="rounded-md border border-good-500 px-3 py-1 text-xs font-semibold text-good-500 disabled:border-surface-600 disabled:text-ink-700"
          >
            확인
          </button>
        </div>
      </div>

      {editorOpen && wager !== null && actor !== null && (
        <div
          data-testid="raise-panel"
          className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md border border-surface-700 bg-surface-800 px-3 py-2 text-[0.7rem] text-ink-300"
        >
          <span className="tabular" data-testid="raise-preview-to">
            <span className="text-ink-500">레이즈 </span>
            {preview === null ? '—' : bbUnit(preview.toAmount)}
          </span>
          <span className="tabular" data-testid="raise-preview-additional">
            <span className="text-ink-500">추가 </span>
            {preview === null ? '—' : bbUnit(preview.additional)}
          </span>
          <span className="tabular" data-testid="raise-preview-min">
            <span className="text-ink-500">최소 </span>
            {bbUnit(wager.minToAmount)}
          </span>
          <span className="tabular" data-testid="raise-preview-max">
            <span className="text-ink-500">최대 </span>
            {bbUnit(wager.maxToAmount)}
          </span>
          <span className="tabular" data-testid="raise-preview-pot">
            <span className="text-ink-500">팟 </span>
            {bbUnit(actor.pot)}
            {preview === null ? '' : ` → ${bbUnit(preview.potAfter)}`}
          </span>

          <span className="ml-auto flex items-center gap-1">
            {POT_FRACTION_SHORTCUTS.map((fraction) => (
              <button
                key={fraction}
                type="button"
                data-testid={`raise-pot-${Math.round(fraction * 100)}`}
                // Keeps focus in the editor so `Enter` still confirms after a click.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyShortcut(fraction)}
                className="rounded border border-surface-600 px-2 py-0.5 text-[0.65rem] text-ink-300 hover:border-actor-500"
              >
                {Math.round(fraction * 100)}%
              </button>
            ))}
          </span>
        </div>
      )}

      {problem !== null && (
        <p data-testid="raise-problem" role="alert" className="text-[0.7rem] text-danger-500">
          {problem}
        </p>
      )}
    </section>
  );
}
