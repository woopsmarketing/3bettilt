/**
 * @vitest-environment node
 *
 * Node, not happy-dom, for the reason `theme-tokens.test.ts` gives: this file resolves paths
 * off `import.meta.url`, which happy-dom makes an `http:` URL that `fileURLToPath` rejects.
 * Nothing here renders.
 *
 * ---------------------------------------------------------------------------------------
 *
 * `global-error.tsx` is the one component that cannot import the stylesheet — it replaces the
 * root layout, and it exists to survive that layout failing, so depending on the module graph
 * or the CSS chunk that may be what broke would defeat it. The price is a literal copy of the
 * palette and the font stack inside the component, and a copy is exactly the thing that drifts:
 * somebody retunes `--color-brand-600` for contrast, every page follows, and the one page a
 * reader sees on the site's worst day quietly keeps the old red.
 *
 * So this file re-reads `globals.css` and asserts the copy still equals the source. It is the
 * same guarantee `ThemeToggle.test.tsx` makes for the storage key the no-flash script inlines,
 * for the same reason.
 *
 * It also pins the two properties the independent Stage-2 review found missing from the
 * prerendered `_global-error.html`: a `lang` and a Korean title of its own.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(fileURLToPath(new URL('./global-error.tsx', import.meta.url)), 'utf8');

const CSS = readFileSync(fileURLToPath(new URL('./globals.css', import.meta.url)), 'utf8').replace(
  /\/\*[\s\S]*?\*\//gu,
  '',
);

/** The value of `--name` inside the first block whose header contains `marker`. */
function token(marker: string, name: string): string {
  const start = CSS.indexOf(marker);
  expect(start, `globals.css no longer contains \`${marker}\``).toBeGreaterThanOrEqual(0);
  const body = CSS.slice(start);
  const match = new RegExp(`${name}\\s*:\\s*([^;]+);`, 'u').exec(body);
  expect(match, `\`${name}\` is not declared after \`${marker}\``).not.toBeNull();
  return (match?.[1] as string).replace(/\s+/gu, ' ').trim();
}

/** The declarations of the component's inline stylesheet, outside its light-theme branch and
 *  inside it — the copy is two palettes, and both have to be checked. */
const STYLE = (() => {
  const start = SOURCE.indexOf('const STYLE = `');
  expect(start, 'global-error.tsx no longer declares `STYLE`').toBeGreaterThanOrEqual(0);
  const open = SOURCE.indexOf('`', start);
  const close = SOURCE.indexOf('`;', open + 1);
  expect(close, 'the `STYLE` template literal is unterminated').toBeGreaterThan(open);
  return SOURCE.slice(open + 1, close);
})();

const LIGHT_BRANCH = (() => {
  const marker = '@media (prefers-color-scheme: light) {';
  const start = STYLE.indexOf(marker);
  expect(start, 'the inline stylesheet has no light-theme branch').toBeGreaterThanOrEqual(0);
  return STYLE.slice(start);
})();

const DARK_BRANCH = STYLE.slice(0, STYLE.indexOf('@media (prefers-color-scheme: light) {'));

/** Every colour the copy uses, in the half of the stylesheet it appears in. */
function hexesIn(css: string): readonly string[] {
  return [...css.matchAll(/#[0-9a-f]{3,8}\b/giu)].map((m) => m[0].toLowerCase());
}

describe('global-error.tsx', () => {
  it('copies the DARK palette from the real tokens, value for value', () => {
    /*
     * Left is what the component paints; right is the token it is standing in for. A failure
     * here means the site's palette moved and this page did not follow it.
     */
    const pairs: readonly (readonly [string, string, string])[] = [
      ['background', '#090a0d', '--color-ground-900'],
      ['page ink', '#f5f6f7', '--color-text-100'],
      ['muted ink', '#9aa1ac', '--color-text-300'],
      ['brand fill', '#d71e36', '--color-brand-600'],
      ['ink on brand fill', '#ffffff', '--color-ink-on-brand'],
      ['border', '#616c7a', '--color-line-500'],
    ];
    for (const [role, copied, name] of pairs) {
      expect(token('@theme {', name), `${role}: the dark copy in global-error.tsx is stale`).toBe(
        copied,
      );
      expect(DARK_BRANCH, `${role}: \`${copied}\` is not actually used`).toContain(copied);
    }
  });

  it('copies the LIGHT palette from the real tokens, value for value', () => {
    const pairs: readonly (readonly [string, string, string])[] = [
      ['background', '#f2f4f7', '--color-ground-900'],
      ['page ink', '#10141a', '--color-text-100'],
      ['muted ink', '#566070', '--color-text-300'],
      ['brand fill', '#a01230', '--color-brand-600'],
      ['border', '#808a96', '--color-line-500'],
    ];
    for (const [role, copied, name] of pairs) {
      expect(
        token(":root[data-theme='light'] {", name),
        `${role}: the light copy in global-error.tsx is stale`,
      ).toBe(copied);
      expect(LIGHT_BRANCH, `${role}: \`${copied}\` is not actually used`).toContain(copied);
    }
  });

  it('introduces no colour that is not one of those tokens', () => {
    /*
     * The pair lists above catch a token that MOVED. This catches the other direction — a
     * seventh colour typed straight into the component, which no pair would ever mention.
     */
    const allowed = new Set([
      '#090a0d',
      '#f5f6f7',
      '#9aa1ac',
      '#d71e36',
      '#ffffff',
      '#616c7a',
      '#f2f4f7',
      '#10141a',
      '#566070',
      '#a01230',
      '#808a96',
    ]);
    expect([...new Set(hexesIn(STYLE))].filter((hex) => !allowed.has(hex))).toEqual([]);
  });

  it('copies the site font stacks rather than inventing one', () => {
    /*
     * The owner's font decision is a system stack that names the real Hangul faces (ruling
     * 111). A fallback page that dropped `Malgun Gothic` would render Korean in whatever the
     * browser guessed, on the one page where legibility matters most.
     */
    for (const name of ['--font-sans', '--font-mono']) {
      const stack = token('@theme {', name);
      const faces = stack.split(',').map((face) => face.trim());
      expect(faces.length, `${name} is suspiciously short`).toBeGreaterThan(3);
      for (const face of faces) {
        expect(STYLE, `${name}: global-error.tsx omits \`${face}\``).toContain(face);
      }
    }
  });

  it('declares its own language and its own Korean title', () => {
    /*
     * The two defects the Stage-2 review found in the prerendered `_global-error.html`. This
     * component replaces the root layout, so `lang="ko"` is not inherited from anywhere — if
     * it is not written here, the document has no language at all.
     */
    expect(SOURCE).toContain('<html lang="ko">');
    const title = /<title>([^<]+)<\/title>/u.exec(SOURCE)?.[1];
    expect(title, 'global-error.tsx renders no <title>').toBeDefined();
    expect(title, 'the fallback page must be titled in Korean').toMatch(/[가-힣]/u);
    expect(title).toContain('3BetTilt');
  });

  it('keeps itself free of app imports, which are what it exists to survive', () => {
    /*
     * Comments stripped first: this file's own header explains WHY it does not import
     * `globals.css`, and a substring search would read that explanation as the thing it
     * forbids. The assertion is about the import statements, not the prose.
     */
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
    const specifiers = [
      ...code.matchAll(/^\s*import\s+(?:[^;]*?from\s+)?['"]([^'"]+)['"]\s*;/gmu),
    ].map((m) => m[1]);
    expect(
      specifiers,
      'global-error.tsx must import nothing — not the module graph that just failed, and not\n' +
        'the stylesheet, which is among the suspects when the root layout throws',
    ).toEqual([]);
  });
});
