'use client';

/**
 * `ThemeToggle` — the header's dark/light switch.
 *
 * ## What it actually does
 *
 * It writes ONE thing: `document.documentElement.dataset.theme`. Everything visible follows
 * from `src/app/globals.css`, which redefines the same token names under
 * `:root[data-theme='…']`. There is no theme context, no provider, and no component anywhere
 * that branches on the theme — which is the point (FISHTILT_STATE ruling 103).
 *
 * ## Why the icons are both rendered
 *
 * This site navigates by full page load, so the toggle is server-rendered on every page. The
 * server cannot know which theme the reader chose — that lives in their `localStorage` — so
 * picking the icon from state would guarantee a hydration mismatch on the first paint after
 * every navigation. Instead BOTH icons are in the markup and `globals.css` shows exactly one,
 * keyed off the same `[data-theme]` / `prefers-color-scheme` cascade the palette uses. The
 * markup is therefore identical for every reader, and the icon is right before React has run
 * at all.
 *
 * ## Why the accessible name is state-driven anyway
 *
 * The label has to say what pressing the button will DO, not what the theme currently is, and
 * that sentence genuinely differs between the two states. It cannot be CSS-swapped the way the
 * icon is without leaving both strings in the accessibility tree. So the label starts as the
 * direction-neutral `테마 바꾸기` — the value the server renders, so hydration matches — and
 * becomes the specific sentence in an effect, once the browser can actually be asked what the
 * resolved theme is. Nothing is lost in the gap: before that effect runs there is no click
 * handler either.
 *
 * ## localStorage
 *
 * Reads happen in the blocking `<head>` script in `src/app/layout.tsx` (that is what prevents
 * the flash); this component only writes. Both sides are wrapped in `try/catch` because
 * `localStorage` does not merely come back empty in a private window or an embedded webview —
 * the property access itself throws. A throw must not take the button down with it, so the
 * failure mode is "the theme changes for this page load and is not remembered", never a
 * broken header.
 */
import { useCallback, useEffect, useState } from 'react';

export type ThemeName = 'light' | 'dark';

/** Duplicated as a literal inside `layout.tsx`'s inline script, which cannot import it.
 *  `ThemeToggle.test.tsx` asserts the two spellings agree. */
export const THEME_STORAGE_KEY = 'fishtilt-theme';

const LABEL_UNKNOWN = '테마 바꾸기';
const LABEL_TO_LIGHT = '밝은 테마로 바꾸기';
const LABEL_TO_DARK = '어두운 테마로 바꾸기';

const LIGHT_QUERY = '(prefers-color-scheme: light)';

/** The theme the page is actually painted in right now: an explicit choice if one was
 *  stamped, otherwise whatever the OS asked for. Mirrors `globals.css`'s cascade exactly. */
function resolveTheme(): ThemeName {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return window.matchMedia?.(LIGHT_QUERY).matches ? 'light' : 'dark';
}

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="3.6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 1.6v2.1M10 16.3v2.1M18.4 10h-2.1M3.7 10H1.6M15.94 4.06l-1.48 1.48M5.54 14.46l-1.48 1.48M15.94 15.94l-1.48-1.48M5.54 5.54 4.06 4.06"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="M16.5 12.4A7 7 0 0 1 7.6 3.5a7 7 0 1 0 8.9 8.9Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface ThemeToggleProps {
  readonly className?: string;
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeName | null>(null);

  useEffect(() => {
    setTheme(resolveTheme());

    // While no explicit choice exists the palette follows the OS, so the label has to as
    // well or it starts promising the wrong direction. Once a choice IS stamped,
    // `resolveTheme` reads that instead and the OS event becomes a no-op.
    const media = window.matchMedia?.(LIGHT_QUERY);
    if (!media) return undefined;
    const onChange = () => setTheme(resolveTheme());
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    const next: ThemeName = resolveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode, a blocked-storage webview, a full quota. The theme still changed for
      // this page load; it just will not be remembered on the next one.
    }
  }, []);

  const label = theme === null ? LABEL_UNKNOWN : theme === 'dark' ? LABEL_TO_LIGHT : LABEL_TO_DARK;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`flex h-11 w-11 items-center justify-center rounded-md text-text-300 outline-none transition-colors hover:text-text-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${className}`}
    >
      {/* Press-to-get-light: shown while the dark theme is the one being painted. */}
      <span className="theme-only-dark">
        <SunIcon />
      </span>
      <span className="theme-only-light">
        <MoonIcon />
      </span>
    </button>
  );
}
