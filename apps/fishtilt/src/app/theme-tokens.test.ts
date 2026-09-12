/**
 * @vitest-environment node
 *
 * Node, not the project's happy-dom default, for the same reason as `src/lib/routes.test.ts`:
 * this file resolves a path off `import.meta.url`, which is an `http:` URL under happy-dom and
 * rejected by `fileURLToPath`. Nothing here touches the DOM.
 *
 * ---------------------------------------------------------------------------------------
 * What this file is for
 * ---------------------------------------------------------------------------------------
 * `src/app/globals.css` carries a long contrast audit in a comment. A comment is a claim, and
 * a claim that nothing checks rots the first time somebody nudges a hex value. This test
 * RECOMPUTES the whole audit from the file itself, in BOTH themes, using the WCAG
 * relative-luminance formula — so the numbers in that comment are a report of what the code
 * does rather than a promise about it.
 *
 * It also holds the three structural properties the light theme depends on:
 *
 *  1. every colour token has a light value — a forgotten one silently keeps its dark value and
 *     produces black-on-black in the light theme, which no contrast pair would catch because
 *     nobody thought to write the pair down;
 *  2. the two light blocks (the `prefers-color-scheme` one and the explicit `[data-theme]` one)
 *     are IDENTICAL, and the explicit dark block matches `@theme` — the palette is written out
 *     three times so that an explicit choice wins in both directions, and three copies is
 *     exactly the shape that drifts;
 *  3. the ink-on-fill tokens exist and are actually used, because the whole point of ruling 104
 *     is that a surface token must never be an ink on a saturated fill.
 *
 * For (3) it also reads the component sources. WP-2 could only reach the call sites through a
 * `.bg-brand-600 { --color-text-100: … }` rule in the stylesheet, so the test verified the rule.
 * WP-2b moved every call site to `text-ink-on-brand` and deleted the rule, so the test verifies
 * the call sites — the guarantee did not move with the mechanism.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** Comments stripped up front: this file's assertions are about what the stylesheet DOES, and
 *  `globals.css` documents itself heavily enough that a prose mention of `@font-face` or of a
 *  selector would otherwise read as the real thing. */
const CSS = readFileSync(fileURLToPath(new URL('./globals.css', import.meta.url)), 'utf8').replace(
  /\/\*[\s\S]*?\*\//gu,
  '',
);

const SRC_DIR = fileURLToPath(new URL('..', import.meta.url));

/** Every shipped (non-test) `.tsx` under `src/`, as [path relative to `src/`, source]. */
const COMPONENT_SOURCES: readonly (readonly [string, string])[] = (function walk(
  dir: string,
  prefix: string,
): (readonly [string, string])[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) return walk(join(dir, entry.name), rel);
    if (!entry.name.endsWith('.tsx') || entry.name.includes('.test.')) return [];
    return [[rel, readFileSync(join(dir, entry.name), 'utf8')] as const];
  });
})(SRC_DIR, '');

/**
 * The candidate class lists in a `.tsx`, for checking which utilities land on one element.
 *
 * A Tailwind class name can never contain a quote, a brace, a newline or a `$`, so splitting on
 * those characters guarantees that any single `className` value lies wholly inside one chunk and
 * that two SEPARATE values (the two branches of a ternary, say) never merge into one. The one
 * exception is a class list broken across lines with `+`, which this rejoins first.
 *
 * The limit worth stating: this sees one element's own classes, not its descendants'. The single
 * place in the app where an ink-on-fill token is needed on a descendant is pinned by name in
 * `OutsCalculator.test.tsx` instead.
 */
function classChunks(source: string): readonly string[] {
  return source.replace(/['"]\s*\+\s*\n?\s*['"]/gu, ' ').split(/[`'"{}\n]|\$\{/u);
}

/** The balanced-brace body of the block introduced by `marker` (which must include its `{`). */
function blockBody(marker: string): string {
  const start = CSS.indexOf(marker);
  expect(start, `globals.css no longer contains \`${marker}\``).toBeGreaterThanOrEqual(0);
  let depth = 0;
  let i = start + marker.length - 1;
  const open = i;
  for (; i < CSS.length; i += 1) {
    if (CSS[i] === '{') depth += 1;
    else if (CSS[i] === '}') {
      depth -= 1;
      if (depth === 0) return CSS.slice(open + 1, i);
    }
  }
  throw new Error(`unbalanced braces after ${marker}`);
}

/** `--name: value` declarations in a block, with comments stripped. */
function declarations(body: string): Record<string, string> {
  const clean = body.replace(/\/\*[\s\S]*?\*\//gu, '');
  const out: Record<string, string> = {};
  for (const match of clean.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gu)) {
    out[match[1] as string] = (match[2] as string).replace(/\s+/gu, ' ').trim();
  }
  return out;
}

const THEME = declarations(blockBody('@theme {'));
const LIGHT_EXPLICIT = declarations(blockBody(":root[data-theme='light'] {"));
const DARK_EXPLICIT = declarations(blockBody(":root[data-theme='dark'] {"));
const LIGHT_PREFERS = declarations(blockBody(":root:not([data-theme='dark']) {"));

/** The palette a given theme actually resolves to: `@theme` is the dark base, and a theme
 *  block overrides the names it redeclares. */
const DARK: Record<string, string> = { ...THEME };
const LIGHT: Record<string, string> = { ...THEME, ...LIGHT_EXPLICIT };

const colourTokens = Object.keys(THEME).filter((name) => name.startsWith('--color-'));

// --- WCAG relative luminance ------------------------------------------------------------

function channels(hex: string): readonly [number, number, number] {
  const s = hex.trim().replace('#', '');
  expect(s, `not a 6-digit hex colour: ${hex}`).toMatch(/^[0-9a-f]{6}$/iu);
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255) as unknown as readonly [
    number,
    number,
    number,
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (b as number);
}

function contrast(palette: Record<string, string>, a: string, b: string): number {
  const first = palette[`--color-${a}`];
  const second = palette[`--color-${b}`];
  expect(first, `no token --color-${a}`).toBeDefined();
  expect(second, `no token --color-${b}`).toBeDefined();
  const [hi, lo] = [luminance(first as string), luminance(second as string)].sort((x, y) => y - x);
  return ((hi as number) + 0.05) / ((lo as number) + 0.05);
}

/** [ink, background, minimum ratio, what renders it] */
const AUDIT: readonly (readonly [string, string, number, string])[] = [
  ['text-100', 'ground-900', 4.5, '본문 on the page'],
  ['text-100', 'ground-800', 4.5, '본문 in a recessed well'],
  ['text-100', 'panel-700', 4.5, '본문 on a card (Panel, LinkCard)'],
  ['text-100', 'panel-600', 4.5, '본문 on a nested/floating surface (Term popover)'],
  ['text-300', 'ground-900', 4.5, 'card description / secondary copy'],
  ['text-300', 'panel-700', 4.5, 'card description on a card'],
  ['text-300', 'panel-600', 4.5, 'Term popover definition'],
  ['text-300', 'ground-800', 4.5, 'calculator result caption'],
  ['text-500', 'ground-900', 3.0, 'Breadcrumbs separator — LARGE/UI only, never body'],
  ['text-500', 'panel-700', 3.0, 'quiet meta on a card — LARGE/UI only'],
  ['brand-500', 'ground-900', 4.5, 'links, eyebrows, active nav item'],
  ['brand-500', 'panel-700', 4.5, 'LinkCard eyebrow'],
  ['brand-500', 'panel-600', 4.5, 'Term popover “자세히 보기”'],
  ['brand-500', 'ground-800', 4.5, 'accent inside a well'],
  ['ink-on-brand', 'brand-600', 4.5, 'primary button label on the brand fill'],
  ['ink-on-brand', 'brand-hover', 4.5, 'primary button label while the button is hovered'],
  ['brand-600', 'ground-900', 3.0, 'the brand fill as a UI boundary'],
  ['brand-hover', 'ground-900', 3.0, 'the hovered brand fill as a UI boundary'],
  ['line-500', 'ground-900', 3.0, 'every border on the page'],
  ['line-500', 'panel-700', 3.0, 'every border on a card'],
  ['line-500', 'panel-600', 3.0, 'Term popover border'],
  ['line-500', 'ground-800', 3.0, 'border inside a well'],
  ['suit-red-500', 'panel-600', 4.5, 'PokerCard heart/diamond ink on the card face'],
  ['suit-red-500', 'panel-700', 4.5, 'PokerCard on a panel'],
  ['suit-red-500', 'ground-900', 4.5, 'PokerCard on the page'],
  ['ink-on-action', 'act-raise-500', 4.5, 'RangeMatrix IN cell / CompareMatrix SHARED cell'],
  ['ink-on-action', 'act-call-500', 4.5, 'RangeCompareMatrix DIFFERS cell'],
  ['text-100', 'act-fold-500', 4.5, 'RangeMatrix OUT cell / CompareMatrix NEITHER cell'],
  ['act-raise-500', 'ground-900', 4.5, 'SelectedHandPanel “레인지에 포함” as TEXT'],
  ['act-raise-500', 'panel-700', 4.5, 'RangeShareLink status line as TEXT'],
  ['act-call-500', 'panel-700', 3.0, 'the correct-answer border in Quiz/MiniQuiz'],
  ['act-call-500', 'panel-600', 3.0, 'the correct-answer border on a nested surface'],
  // WP-S3-03: the brand-tint band (`Section tone="brand-tint"`, `CtaBand`) puts real text on
  // `brand-950`. `line-500` is deliberately NOT listed against it — it is 2.9:1 in the light
  // theme — which is why a brand-tint band draws no internal borders.
  ['text-100', 'brand-950', 4.5, 'CtaBand title on the brand-tint band'],
  ['text-300', 'brand-950', 4.5, 'CtaBand description on the brand-tint band'],
  ['brand-500', 'brand-950', 4.5, 'CtaBand secondary link on the brand-tint band'],
  ['brand-600', 'brand-950', 3.0, 'CtaBand primary button as a boundary on the band'],
  // `PositionDiagram`'s dealer button: page ink as a fill, page ground as its letter.
  ['ground-900', 'text-100', 4.5, 'PositionDiagram dealer button letter'],
];

describe('theme tokens — structure', () => {
  it('defines a light value for every colour token, so none silently keeps its dark one', () => {
    const missing = colourTokens.filter((name) => !(name in LIGHT_EXPLICIT));
    expect(missing, `no light value for: ${missing.join(', ')}`).toEqual([]);
  });

  it('the prefers-color-scheme light block and the explicit light block are identical', () => {
    // Two copies exist so that an explicit choice beats the OS preference in BOTH directions.
    // They must never disagree: a token fixed in one and not the other would mean the same
    // reader sees two different palettes depending on how they arrived at the theme.
    expect(LIGHT_PREFERS).toEqual(LIGHT_EXPLICIT);
  });

  it('the explicit dark block restates @theme exactly, token for token', () => {
    for (const [name, value] of Object.entries(DARK_EXPLICIT)) {
      if (name in THEME) {
        expect(THEME[name], `${name} disagrees with @theme`).toBe(value);
      } else {
        // A private `--ft-*` value, which lives outside `@theme` so it does not generate a
        // utility. It still has to exist in BOTH themes or one of them falls back silently.
        expect(LIGHT_EXPLICIT, `${name} has no light counterpart`).toHaveProperty(name);
      }
    }
    // ... and it restates every colour token, not just a convenient subset — otherwise
    // choosing dark from a light OS would leave some tokens on their light values.
    const missing = colourTokens.filter((name) => !(name in DARK_EXPLICIT));
    expect(missing, `explicit dark block omits: ${missing.join(', ')}`).toEqual([]);
  });

  it('both themes declare their own colour-scheme, so UA chrome follows the palette', () => {
    expect(CSS).toMatch(/:root\s*\{\s*color-scheme:\s*dark;/u);
    expect(blockBody(":root[data-theme='light'] {")).toContain('color-scheme: light');
    expect(blockBody(":root[data-theme='dark'] {")).toContain('color-scheme: dark');
    expect(blockBody(":root:not([data-theme='dark']) {")).toContain('color-scheme: light');
  });

  it('keeps the ink-on-fill tokens, which is what stops a surface colour being used as ink', () => {
    // Ruling 104. `text-ground-900` on a saturated fill inverts with the theme and turns
    // light-on-light; `text-text-100` on a saturated fill inverts the other way. Both are
    // replaced by a token that belongs to the FILL, so neither moves when the page does.
    expect(THEME['--color-ink-on-action']).toBeDefined();
    expect(THEME['--color-ink-on-brand']).toBeDefined();
    expect(LIGHT_EXPLICIT['--color-ink-on-action']).toBeDefined();
    expect(LIGHT_EXPLICIT['--color-ink-on-brand']).toBeDefined();
  });

  it('has no `.bg-brand-600` bridge rule — the call sites name the ink token themselves', () => {
    /*
     * WP-2 shipped `.bg-brand-600 { --color-text-100: var(--color-ink-on-brand); }` because the
     * call sites were outside its file boundary. WP-2b moved all eighteen of them, so the rule
     * is gone and must stay gone: a utility that means something different depending on an
     * ancestor is the action-at-a-distance the fill/ink token split exists to remove.
     *
     * The assertion this replaces checked the contrast the RULE produced. This one, plus the
     * two below, check the property that actually matters — that every brand fill is paired
     * with the ink token that belongs to it — so deleting the rule did not delete its guarantee.
     */
    expect(CSS).not.toMatch(/\.bg-brand-600\s*\{/u);
  });

  it('never pairs the brand fill with the page-ink token in any component', () => {
    const offenders = COMPONENT_SOURCES.flatMap(([file, source]) =>
      classChunks(source)
        .filter((chunk) => chunk.includes('bg-brand-600') && chunk.includes('text-text-100'))
        .map((chunk) => `${file}: ${chunk.trim()}`),
    );
    expect(
      offenders,
      'the brand fill must carry `text-ink-on-brand`; `text-text-100` is the PAGE ink and\n' +
        'renders near-black on dark red in the light theme:\n' +
        offenders.join('\n'),
    ).toEqual([]);
  });

  it('never uses `brand-500` as a fill under text — that is what `brand-hover` is for', () => {
    /*
     * The AA gap WP-2 could not close from inside its boundary: five primary buttons wrote
     * `bg-brand-600 hover:bg-brand-500`, putting the label on the identity red `#ff334d` while
     * hovered — 3.60:1, under the 4.5 body minimum. `brand-500` is the brand INK (links,
     * eyebrows, focus rings) and may not be darkened, so the hover moved to a dedicated fill.
     * This stops the pattern coming back by habit.
     */
    const offenders = COMPONENT_SOURCES.filter(([, source]) =>
      /\bbg-brand-500\b/u.test(source),
    ).map(([file]) => file);
    expect(offenders, `bg-brand-500 (incl. hover:) found in: ${offenders.join(', ')}`).toEqual([]);
  });

  it('leaves the identity red itself untouched', () => {
    // `brand-hover` was added so that `brand-500` would NOT have to move. If a later change
    // darkens the identity red to win a contrast argument, that argument was lost elsewhere.
    expect(THEME['--color-brand-500']).toBe('#ff334d');
    expect(DARK_EXPLICIT['--color-brand-500']).toBe('#ff334d');
  });

  it('tokenises the popover scrim, and declares it on ::backdrop too', () => {
    // `::backdrop` only started inheriting custom properties from its originating element
    // recently; without this the popover backdrop is transparent in older engines.
    expect(THEME['--color-scrim-900']).toBeDefined();
    expect(CSS).toMatch(/::backdrop\s*\{\s*--color-scrim-900:/u);
    expect(CSS).toContain(":root[data-theme='light'] ::backdrop");
    expect(CSS).toContain(":root[data-theme='dark'] ::backdrop");
  });

  it('names real Hangul faces in the sans stack instead of trusting browser fallback', () => {
    // Ruling 111: no webfont file, so the stack has to do the work.
    const stack = THEME['--font-sans'] as string;
    expect(stack).toContain('Apple SD Gothic Neo');
    expect(stack).toContain('Malgun Gothic');
    expect(stack).toContain('system-ui');
    expect(stack.trimEnd().endsWith('sans-serif')).toBe(true);
    // A webfont would be an `@font-face`; there must not be one.
    expect(CSS).not.toContain('@font-face');
  });

  it('sets Korean-appropriate leading on the type scale rather than Latin defaults', () => {
    expect(Number(THEME['--text-base--line-height'])).toBeGreaterThanOrEqual(1.7);
    expect(Number(THEME['--text-sm--line-height'])).toBeGreaterThanOrEqual(1.7);
    // Headings tighten as they grow, or a 36px h1 leaves a hole under it.
    expect(Number(THEME['--text-3xl--line-height'])).toBeLessThan(
      Number(THEME['--text-base--line-height']),
    );
  });

  it('routes the elevation shadow through an inner variable, or the theme cannot change it', () => {
    /*
     * Measured in the built stylesheet, not assumed: Tailwind BAKES a `--shadow-*` theme value
     * straight into the `.shadow-raised` utility, so redefining `--shadow-raised` under a
     * theme selector has no effect at all. Only an inner `var()` survives into the utility and
     * resolves at use time. This is the assertion that keeps somebody from "simplifying" the
     * indirection away and silently shipping the dark shadow on the light theme.
     */
    expect(THEME['--shadow-raised']).toContain('var(--ft-shadow-cast)');
    expect(THEME['--shadow-raised']).toContain('var(--ft-shadow-edge)');
    for (const name of ['--ft-shadow-cast', '--ft-shadow-edge']) {
      expect(LIGHT_EXPLICIT[name], `${name} missing from the light theme`).toBeDefined();
      expect(DARK_EXPLICIT[name], `${name} missing from the explicit dark theme`).toBeDefined();
      expect(LIGHT_EXPLICIT[name]).not.toBe(DARK_EXPLICIT[name]);
    }
  });

  it('exposes the content widths by role, at the Stage 3 values (D-S3-10)', () => {
    expect(THEME['--container-reading']).toBe('46rem');
    expect(THEME['--container-breakout']).toBe('60rem');
    expect(THEME['--container-grid']).toBe('68rem');
    expect(THEME['--container-shell']).toBe('78rem');
    expect(THEME['--container-matrix']).toBe('85rem');
    expect(THEME['--container-lead']).toBe('42rem');
    expect(THEME['--container-figure']).toBe('22rem');
  });

  it('names the Stage 3 type scale and the two-step section rhythm (D-S3-11)', () => {
    expect(THEME['--text-prose']).toBe('1.0625rem');
    expect(Number(THEME['--text-prose--line-height'])).toBeGreaterThanOrEqual(1.8);
    expect(THEME['--text-h2']).toMatch(/^clamp\(1\.5rem,/u);
    expect(THEME['--text-article-h1']).toBe('clamp(1.875rem, 1.2rem + 2.2vw, 2.75rem)');
    expect(THEME['--text-article-h1--line-height']).toBe('1.25');
    expect(THEME['--text-hero-h1']).toBe('clamp(2.25rem, 1.4rem + 3vw, 3.5rem)');
    expect(THEME['--text-hero-h1--line-height']).toBe('1.15');
    expect(THEME['--spacing-section']).toBe('3.5rem');
    expect(THEME['--spacing-section-lg']).toBe('5rem');
    // The Korean line-breaking utility exists and does both halves of the job.
    expect(CSS).toMatch(
      /@utility prose-ko\s*\{[^}]*word-break:\s*keep-all;[^}]*overflow-wrap:\s*anywhere;/u,
    );
  });

  it('has retired every off-token `max-w-*` literal from the shipped components', () => {
    /*
     * WP-S3-03 mapped the ten literals the Stage 3 baseline counted (`max-w-3xl`, `-4xl`,
     * `-6xl`, `-sm`, `-[42rem]`, `-[22rem]`, `-[20rem]`) onto the seven role tokens. Tailwind's
     * own `--container-*` scale is not banned from Tailwind, only from this app: a width
     * here must carry a reason, and `max-w-4xl` carries a number.
     */
    // Comments stripped first: `blog/[slug]/page.tsx` narrates the literal it retired.
    const offenders = COMPONENT_SOURCES.flatMap(([rel, src]) =>
      classChunks(src.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, ''))
        .filter((list) => /\bmax-w-(\[|xs\b|sm\b|md\b|lg\b|xl\b|\dxl\b|prose\b)/u.test(list))
        .map((list) => `${rel}: ${list.trim()}`),
    );
    expect(offenders).toEqual([]);
  });

  it('gives every long-form template the SAME column, and gives it as the token', () => {
    /*
     * The defect this pins actually shipped. WP-5 moved `blog/[slug]` off a `max-w-[42rem]`
     * literal onto `max-w-reading` while that token was 48rem, which widened one article
     * template and left the other four on the literal — the same MDX, through the same
     * renderer, at two different measures. Nothing failed, because the only column assertion
     * in the suite was `blog/[slug]`'s own, and the token test above checked that
     * `--container-reading` was DEFINED rather than what it was.
     *
     * So this asserts the invariant instead of the number: the five templates that render a
     * single column of Korean long-form all name the same token. A sixth long-form route must
     * join them, and a page that genuinely needs a different width brings a measurement and a
     * token of its own (ruling 113), never a bare literal.
     */
    const LONG_FORM = [
      'app/[locale]/learn/[slug]/page.tsx',
      'app/[locale]/glossary/[slug]/page.tsx',
      'app/[locale]/hands/[hand]/page.tsx',
      'app/[locale]/about/page.tsx',
    ];
    for (const path of LONG_FORM) {
      const entry = COMPONENT_SOURCES.find(([rel]) => rel === path);
      expect(entry, `${path} is missing — update this list if a template moved`).toBeDefined();
      const main = /<main className="([^"]*)"/u.exec(entry?.[1] ?? '')?.[1] ?? '';
      expect(main, `${path}: <main> should carry the reading column`).toContain('max-w-reading');
    }

    /*
     * WP-S3-06: the blog article template no longer puts the column on `<main>` — `<main>`
     * is a stack of `Section` bands and the reading column is the middle track of a
     * three-track grid inside a `breakout` band (`components/blog/BlogArticleShell.tsx`),
     * so figures and tables can span the band while prose keeps the measure. The invariant
     * is the same — the column is the TOKEN, `--container-reading`, not a literal — and it
     * is checked where the column now lives.
     */
    const BLOG_SHELL = 'components/blog/BlogArticleShell.tsx';
    const shell = COMPONENT_SOURCES.find(([rel]) => rel === BLOG_SHELL);
    expect(shell, `${BLOG_SHELL} is missing — the blog column moved again`).toBeDefined();
    expect(shell?.[1]).toContain('min(var(--container-reading),100%)');
    expect(shell?.[1]).not.toMatch(/max-w-\[/u);
  });

  it('keeps the page column on a token, never on an arbitrary-value literal', () => {
    /*
     * `mx-auto` + a `max-w-*` is the page-column idiom: centred, and therefore setting the
     * measure the reader actually reads at. That combination must name a token, because a
     * literal there is how the split above happened four times over.
     *
     * The rule is deliberately NOT "no `max-w-[` anywhere". Writing this the broad way failed
     * immediately on `HomeHeroVisual` and `OutsFigure`, and they were right and the test was
     * wrong: both are `w-full max-w-[Nrem]` on a drawing, the ordinary idiom for "fill the
     * parent but never exceed my intrinsic size". Same for `PageHero` and `SectionHeading`,
     * which cap a DESCRIPTION's line length inside a wider container. None of those is a page
     * column, and none is centred — so keying on `mx-auto` separates them with no allow-list
     * to maintain, which is the version that survives someone adding a sixth drawing.
     */
    const offenders = COMPONENT_SOURCES.flatMap(([rel, src]) =>
      classChunks(src)
        .filter((list) => /\bmx-auto\b/u.test(list) && /\bmax-w-\[/u.test(list))
        .map((list) => `${rel}: ${list.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe.each([
  ['dark', DARK],
  ['light', LIGHT],
])('theme tokens — contrast in the %s theme', (themeName, palette) => {
  it.each(AUDIT)('%s on %s clears %s:1 — %s', (ink, background, minimum, usage) => {
    const ratio = contrast(palette, ink, background);
    expect(
      Number(ratio.toFixed(2)),
      `${themeName}: ${ink} on ${background} is ${ratio.toFixed(2)}:1, below ${minimum}:1 (${usage})`,
    ).toBeGreaterThanOrEqual(minimum);
  });

  it('the 13x13 matrix separates an in-range cell from an out-of-range one', () => {
    /*
     * The site's core object. Colour is not the only carrier — every cell also holds its key
     * in an AA-contrasting ink, and the legend names each fill — but if the two fills are
     * nearly the same luminance the grid stops reading as a shape at a glance, which is the
     * entire reason the chart exists. 2.5:1 is the floor the shipped dark theme already
     * holds (2.79:1); the light theme is asserted against the same floor rather than a
     * weaker one.
     */
    expect(contrast(palette, 'act-raise-500', 'act-fold-500')).toBeGreaterThanOrEqual(2.5);
  });

  it('a card is visibly a card before its border is taken into account', () => {
    // The "밋밋함" this WP was opened to fix: `panel-700` used to differ from `ground-900` by
    // 1.06:1, so a card was a border and nothing else. 1.08:1 is not a WCAG threshold — it is
    // the floor below which the elevation ladder stops existing.
    expect(contrast(palette, 'panel-700', 'ground-900')).toBeGreaterThanOrEqual(1.08);
  });
});
