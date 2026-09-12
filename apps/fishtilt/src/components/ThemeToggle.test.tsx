import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeToggle, THEME_STORAGE_KEY } from './ThemeToggle.js';

/** Vitest's cwd is the workspace root or the project root depending on how it was invoked;
 *  both are handled so this file does not depend on which. */
const APP_ROOT = process.cwd().endsWith(join('apps', 'fishtilt'))
  ? process.cwd()
  : join(process.cwd(), 'apps', 'fishtilt');

afterEach(() => {
  delete document.documentElement.dataset.theme;
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('ThemeToggle', () => {
  it('is a real button at the 44px target this repo holds itself to', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'button');
    expect(button.className).toContain('h-11');
    expect(button.className).toContain('w-11');
    // Keyboard users have to be able to see where they are.
    expect(button.className).toContain('focus-visible:outline');
  });

  it('renders BOTH icons, so the server markup does not depend on the reader’s theme', () => {
    /*
     * The hydration trap this avoids: the theme lives in the visitor's `localStorage`, the
     * server cannot read it, and this site navigates by full page load — so choosing the icon
     * from React state would mismatch on the first paint of every page. Both icons ship and
     * `globals.css` shows one, keyed off the same cascade as the palette.
     */
    const { container } = render(<ThemeToggle />);
    expect(container.querySelectorAll('svg')).toHaveLength(2);
    expect(container.querySelector('.theme-only-dark')).toBeInTheDocument();
    expect(container.querySelector('.theme-only-light')).toBeInTheDocument();
  });

  it('names what pressing it will DO, not what the theme currently is', async () => {
    document.documentElement.dataset.theme = 'dark';
    render(<ThemeToggle />);
    const button = await screen.findByRole('button', { name: '밝은 테마로 바꾸기' });
    expect(button).toBeInTheDocument();
  });

  it('names the other direction when the light theme is the one being painted', async () => {
    document.documentElement.dataset.theme = 'light';
    render(<ThemeToggle />);
    expect(await screen.findByRole('button', { name: '어두운 테마로 바꾸기' })).toBeInTheDocument();
  });

  it('flips data-theme on the document element, in both directions', async () => {
    const user = userEvent.setup();
    document.documentElement.dataset.theme = 'dark';
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button'));
    expect(document.documentElement.dataset.theme).toBe('light');

    await user.click(screen.getByRole('button'));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('remembers the choice, so it survives the full page load this site navigates with', async () => {
    const user = userEvent.setup();
    document.documentElement.dataset.theme = 'dark';
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button'));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('still switches the theme when localStorage THROWS, instead of taking the header down', async () => {
    /*
     * In a private window and inside some embedded webviews the storage call does not return
     * empty — it throws. An unhandled throw here would abort the click handler and leave the
     * button dead. The documented failure mode is "not remembered", never "not working".
     */
    const user = userEvent.setup();
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage is not available');
    });
    document.documentElement.dataset.theme = 'dark';
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button'));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('uses the same storage key the no-flash script in layout.tsx reads', () => {
    /*
     * The two cannot share an import: the script is serialised into HTML in `<head>` and runs
     * before any module does. So the literal is duplicated, and this is what keeps the two
     * spellings from drifting — a mismatch would not fail anything, it would just silently
     * stop remembering the theme.
     */
    const layout = readFileSync(join(APP_ROOT, 'src/app/layout.tsx'), 'utf8');
    expect(layout).toContain(`localStorage.getItem('${THEME_STORAGE_KEY}')`);
    // ... and it must still be the blocking, pre-paint kind, or the flash comes back.
    expect(layout).toContain('dangerouslySetInnerHTML');
    expect(layout).toContain('suppressHydrationWarning');
    // ... and it must swallow a throwing localStorage the same way this component does.
    expect(layout).toMatch(/try\{[\s\S]*catch\(e\)\{\}/u);
    // Only an explicit choice is ever stamped; with nothing stored the element keeps no
    // `data-theme` at all, which is what hands the decision to `prefers-color-scheme`.
    expect(layout).toContain("t==='light'||t==='dark'");
  });
});
