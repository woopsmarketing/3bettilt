'use client';

/**
 * One seat's auto top-up preference, rendered under its `SeatCard`.
 *
 * Auto top-up is a SEAT preference, not one session-wide switch (real-user Alpha
 * feedback), so every occupied seat carries its own switch and its own target.
 *
 * It sits BESIDE `SeatCard` rather than inside it: that card's root element is a
 * `<button>`, and a button cannot contain another button.
 *
 * Three rules hold here:
 *
 * 1. **One click toggles.** Turning a seat on or off is the common action and costs
 *    exactly one click. Editing the target is the rarer one, and is inline.
 * 2. **No money is computed.** The chip parses the typed target with `Money.parseBB` at
 *    the boundary and passes the result through. It never adds, rounds, or predicts a
 *    resulting stack — `applySeatAutoTopUps` in `poker-core` is the only place top-up
 *    arithmetic lives (`CLAUDE.md` rule 1).
 * 3. **Nothing typed is discarded.** A target that will not parse — or that parses to an
 *    amount no seat can be topped up to — stays in the field with the problem shown next
 *    to it, and nothing is dispatched (`CLAUDE.md` rule 3).
 *
 * The `targetText` it reports is what the user actually typed. The server re-parses that
 * same text and its parse is the authoritative one; no client-computed money number is
 * ever transmitted.
 */
import { useCallback, useState } from 'react';
import { Money } from '@gto-self/shared';
import type { MilliBB } from '@gto-self/shared';
import type { AutoTopUpPolicy, SeatIndex } from '@gto-self/poker-core';

/** What the chip reports upward. The policy is for the store, the text is for the server. */
export interface SeatAutoTopUpChange {
  readonly seat: SeatIndex;
  readonly policy: AutoTopUpPolicy;
  /** Verbatim entered target in BB, or the current target round-tripped for a toggle. */
  readonly targetText: string;
}

export interface SeatAutoTopUpProps {
  readonly seat: SeatIndex;
  /** The seat's OWN policy, or `null` when it records none. */
  readonly policy: AutoTopUpPolicy | null;
  /**
   * The target a seat with none starts from: the TABLE's own `config.referenceStack`, so
   * NL50's 100 BB comes from the preset rather than from a number typed in here.
   */
  readonly defaultTarget: MilliBB;
  readonly onChange: (change: SeatAutoTopUpChange) => void;
}

/**
 * `maxDecimals: 3` is full milliBB, so this round-trips through `Money.parseBB` exactly:
 * the text a toggle sends parses back on the server to precisely the stored target.
 */
function targetText(amount: MilliBB): string {
  return Money.formatBB(amount, { maxDecimals: 3 });
}

/** A seat row holds one amount: `threshold` is the target (`session-service.ts`). */
function policyFor(enabled: boolean, target: MilliBB): AutoTopUpPolicy {
  return { enabled, targetStack: target, threshold: target };
}

export function SeatAutoTopUp({ seat, policy, defaultTarget, onChange }: SeatAutoTopUpProps) {
  const enabled = policy?.enabled ?? false;
  const target = policy?.targetStack ?? null;

  const [editing, setEditing] = useState(false);
  /** Verbatim, and never rewritten by this component. */
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const toggle = useCallback(() => {
    // A seat with no target of its own starts at the table's reference stack.
    const next = target ?? defaultTarget;
    onChange({ seat, policy: policyFor(!enabled, next), targetText: targetText(next) });
  }, [seat, enabled, target, defaultTarget, onChange]);

  const openEditor = useCallback(() => {
    setText(targetText(target ?? defaultTarget));
    setProblem(null);
    setEditing(true);
  }, [target, defaultTarget]);

  const commit = useCallback(() => {
    const parsed = Money.parseBB(text);
    if (!parsed.ok) {
      // The typed text STAYS in the field. Nothing is dispatched on a value nobody could
      // read, and nothing is guessed on the user's behalf.
      // `parsed.error` is the parser's own reason, shown verbatim (`CLAUDE.md` rule 3).
      setProblem(`목표치를 읽을 수 없습니다 (${parsed.error}). 목표치는 100 같은 BB 값입니다.`);
      return;
    }
    if (parsed.value <= 0) {
      // `Money.parseBB` accepts "0" and "-5" — a negative BB amount is legitimate
      // elsewhere — but a top-up TARGET is a stack, and a stack is positive. The server
      // refuses this exact value (`updateSeatAutoTopUp` in `session-service.ts`), and the
      // engine refuses it again at the next deal: an enabled policy with a non-positive
      // `targetStack` makes `applySeatAutoTopUps` return `STACK_NOT_POSITIVE`, which
      // aborts Start Hand for the WHOLE table until the poisoned seat is found. So the
      // chip refuses it here, exactly as the server does, and dispatches nothing.
      // The typed text stays in the field (`CLAUDE.md` rule 3); the engine's own code is
      // shown verbatim inside the Korean frame (ADR-0053).
      setProblem('목표치는 0보다 커야 합니다 (STACK_NOT_POSITIVE). 목표치는 100 같은 BB 값입니다.');
      return;
    }
    setProblem(null);
    setEditing(false);
    // Editing the target does NOT flip the switch: the two are separate decisions, and a
    // seat the user switched off must stay off until they switch it back on.
    onChange({ seat, policy: policyFor(enabled, parsed.value), targetText: text });
  }, [text, seat, enabled, onChange]);

  const cancel = useCallback(() => {
    // Cancel keeps the STORED target: nothing is dispatched and nothing is overwritten.
    setEditing(false);
    setProblem(null);
  }, []);

  return (
    <div
      data-testid={`seat-${seat}-autotopup`}
      data-enabled={enabled ? 'true' : 'false'}
      className="mt-1 flex w-full min-w-0 flex-wrap items-center gap-1 text-[0.6rem] uppercase tracking-wide"
    >
      <button
        type="button"
        data-testid={`seat-${seat}-autotopup-toggle`}
        aria-pressed={enabled}
        aria-label={`좌석 ${seat + 1} 자동 리바이`}
        onClick={toggle}
        className={`rounded px-1 font-semibold ${
          enabled ? 'bg-good-500 text-surface-900' : 'bg-surface-600 text-ink-500'
        }`}
      >
        자동
      </button>

      {editing ? (
        <input
          type="text"
          inputMode="decimal"
          autoFocus
          data-testid={`seat-${seat}-autotopup-input`}
          aria-label={`좌석 ${seat + 1} 자동 리바이 목표 (BB)`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              cancel();
            }
          }}
          className="tabular w-16 rounded border border-surface-600 bg-surface-900 px-1 text-ink-100"
        />
      ) : (
        <button
          type="button"
          data-testid={`seat-${seat}-autotopup-target`}
          aria-label={`좌석 ${seat + 1} 자동 리바이 목표 수정`}
          onClick={openEditor}
          className="tabular rounded px-1 text-ink-300 underline decoration-dotted"
        >
          {target === null ? '목표 없음' : `${targetText(target)} BB`}
        </button>
      )}

      <span
        data-testid={`seat-${seat}-autotopup-state`}
        className={enabled ? 'text-good-500' : 'text-ink-700'}
      >
        {enabled ? '✓' : '끔'}
      </span>

      {problem !== null && (
        <span
          data-testid={`seat-${seat}-autotopup-problem`}
          role="alert"
          className="w-full normal-case tracking-normal text-danger-500"
        >
          {problem}
        </span>
      )}
    </div>
  );
}
