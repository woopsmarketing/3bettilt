/**
 * `RangeShareLink` — the "링크 복사" button (build spec deliverable 2, §51): copies the
 * Range Explorer's current, shareable, absolute URL to the clipboard and says so.
 *
 * DEGRADATION, HONESTLY. `navigator.clipboard.writeText` needs a secure context and is not
 * guaranteed to exist or succeed (permissions can be denied, older/locked-down browsers may
 * not expose it at all). This component never silently fails and never claims success it did
 * not get:
 *
 *   1. `navigator.clipboard` exists -> try it; on success, say "복사했습니다".
 *   2. It throws, or is not present at all -> fall back to the legacy
 *      `document.execCommand('copy')` path (still widely supported, deprecated but not
 *      removed anywhere that matters here) via a temporary, off-screen `<textarea>`.
 *   3. That also fails or is unavailable -> give up on copying FOR the reader and instead
 *      reveal the URL itself in a selectable, read-only text field with its own instruction,
 *      so the reader can still get the link out by their own selection — never a dead
 *      button with no explanation.
 *
 * `href` is the only prop, deliberately — this component does not know about `RangeQuery`,
 * hero positions, or the URL builder in `features/range/url.ts`; the caller (`RangeExplorer`)
 * already knows the current absolute URL because it is the one syncing it via
 * `window.history`, so this component's whole job is the clipboard interaction and its
 * fallback, nothing about routing.
 */
import { useEffect, useRef, useState } from 'react';

export interface RangeShareLinkProps {
  /** The absolute (or root-relative) URL to copy — the caller decides what "current" means. */
  readonly href: string;
  readonly className?: string;
}

type CopyState = 'IDLE' | 'COPIED' | 'FALLBACK';

function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.left = '-1000px';
  document.body.appendChild(textarea);
  textarea.select();
  let succeeded: boolean;
  try {
    // `execCommand` is deprecated but still the only synchronous fallback path browsers
    // without (or denying) the async Clipboard API support; wrapped in try/catch because
    // some environments throw rather than returning `false`.
    succeeded = document.execCommand('copy');
  } catch {
    succeeded = false;
  }
  document.body.removeChild(textarea);
  return succeeded;
}

export function RangeShareLink({ href, className = '' }: RangeShareLinkProps) {
  const [state, setState] = useState<CopyState>('IDLE');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    };
  }, []);

  async function handleClick() {
    let copied = false;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(href);
        copied = true;
      } catch {
        copied = false;
      }
    }
    if (!copied) copied = legacyCopy(href);

    setState(copied ? 'COPIED' : 'FALLBACK');
    if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    if (copied) {
      resetTimer.current = setTimeout(() => setState('IDLE'), 2500);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void handleClick()}
        className="inline-flex h-11 items-center gap-1.5 rounded-md border border-line-500 bg-panel-600 px-3 text-sm font-semibold text-text-100 outline-none transition-colors duration-150 hover:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        링크 복사
      </button>

      {state === 'COPIED' ? (
        <p role="status" className="mt-1.5 text-xs text-act-raise-500">
          링크를 복사했습니다.
        </p>
      ) : null}

      {state === 'FALLBACK' ? (
        <div role="status" className="mt-1.5">
          <p className="text-xs text-text-300">
            자동 복사에 실패했습니다. 아래 링크를 직접 선택해서 복사해주세요.
          </p>
          <input
            type="text"
            readOnly
            value={href}
            aria-label="Range Explorer 링크"
            onFocus={(event) => event.currentTarget.select()}
            className="mt-1 w-full rounded-md border border-line-500 bg-panel-600 px-2 py-1.5 font-mono text-xs text-text-100 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      ) : null}
    </div>
  );
}
