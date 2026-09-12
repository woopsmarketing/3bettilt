import { expect, test, type Page } from '@playwright/test';
import { koPath, koUrl } from './helpers.js';

/*
 * WP-2 — the theme and the header, checked in a real browser because neither can be proved
 * anywhere else.
 *
 * A unit test can show that the toggle writes `data-theme`; it cannot show that the CSS
 * cascade in `globals.css` actually re-points 15 tokens, that the blocking `<head>` script
 * lands before the first paint, or that the 13x13 chart — the site's core object — is still
 * legible once the palette flips. Those are all facts about a browser applying a stylesheet,
 * so they are measured from computed styles here, never from a screenshot (build spec §41).
 */

const STORAGE_KEY = 'fishtilt-theme';

/** WCAG relative luminance of a computed `rgb(...)` / `rgba(...)` string. */
function luminanceOf(colour: string): number {
  const parts = colour.match(/[\d.]+/gu);
  if (parts === null) throw new Error(`unparseable colour: ${colour}`);
  const [r, g, b] = parts.slice(0, 3).map((value) => {
    const channel = Number(value) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastOf(foreground: string, background: string): number {
  const [hi, lo] = [luminanceOf(foreground), luminanceOf(background)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** Seed an explicit choice the way a returning visitor's browser would have it. */
async function withStoredTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key as string, value as string);
    },
    [STORAGE_KEY, theme],
  );
}

/*
 * The OS preference is stated explicitly in every theme test below, never inherited.
 * Playwright's default context reports `prefers-color-scheme: light`, so a test that says
 * nothing is silently testing the light branch — which is exactly how a theme test ends up
 * proving the opposite of what its name claims.
 */
test.describe('WP-2 — 테마 전환 (OS가 다크를 요청)', () => {
  test.use({ colorScheme: 'dark' });

  test('paints dark, and leaves data-theme unset so the OS preference still decides', async ({
    page,
  }) => {
    await page.goto(koPath('/'));
    // Nothing stored means nothing stamped: that is what hands the choice to
    // `prefers-color-scheme` for a visitor who never touched the toggle (and for one with
    // JavaScript off, for whom the script never runs at all).
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBeUndefined();
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(luminanceOf(background)).toBeLessThan(0.05);
  });

  test('the toggle flips the whole palette, not just one element', async ({ page }) => {
    await page.goto(koPath('/'));
    const before = await page.evaluate(() => ({
      body: getComputedStyle(document.body).backgroundColor,
      ink: getComputedStyle(document.body).color,
    }));

    await page.getByRole('button', { name: '밝은 테마로 바꾸기' }).click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const after = await page.evaluate(() => ({
      body: getComputedStyle(document.body).backgroundColor,
      ink: getComputedStyle(document.body).color,
    }));

    expect(after.body).not.toBe(before.body);
    expect(after.ink).not.toBe(before.ink);
    expect(luminanceOf(after.body)).toBeGreaterThan(0.7);
    // The body text still clears AA after the flip — the whole point of redefining the tokens
    // in pairs rather than inverting one of them.
    expect(contrastOf(after.ink, after.body)).toBeGreaterThanOrEqual(4.5);

    // And the button now offers the other direction.
    await expect(page.getByRole('button', { name: '어두운 테마로 바꾸기' })).toBeVisible();
  });

  test('the choice survives the full page load this site navigates with', async ({ page }) => {
    await page.goto(koPath('/'));
    await page.getByRole('button', { name: '밝은 테마로 바꾸기' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Every link in this app is a real navigation, not client-side routing, so "does it
    // persist" is a question about storage plus the head script — not about React state.
    await page.getByLabel('주요 메뉴').getByRole('link', { name: '블로그' }).click();
    await expect(page).toHaveURL(koUrl('/blog'));
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});

test.describe('WP-2 — 테마 전환 (OS가 라이트를 요청)', () => {
  test.use({ colorScheme: 'light' });

  test('a stored choice is applied before the first paint, not after hydration', async ({
    page,
  }) => {
    await withStoredTheme(page, 'light');
    // `commit` returns as soon as the navigation commits — before load, before hydration. If
    // the attribute is already there, it was stamped by the blocking script in `<head>`, which
    // is the whole no-flash mechanism.
    await page.goto(koPath('/learn'), { waitUntil: 'commit' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Belt and braces: the script really is in `<head>`, ahead of the body.
    const html = await page.content();
    const head = html.slice(0, html.indexOf('</head>'));
    expect(head).toContain(STORAGE_KEY);
  });

  test('an explicit dark choice beats an OS that asks for light', async ({ page }) => {
    await withStoredTheme(page, 'dark');
    await page.goto(koPath('/'));

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(luminanceOf(background)).toBeLessThan(0.05);
  });

  test('gets light without anyone touching the toggle, and with nothing stamped', async ({
    page,
  }) => {
    await page.goto(koPath('/'));

    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBeUndefined();
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(luminanceOf(background)).toBeGreaterThan(0.7);
    // ... and the body ink still clears AA against it, on the branch nobody chose.
    const ink = await page.evaluate(() => getComputedStyle(document.body).color);
    expect(contrastOf(ink, background)).toBeGreaterThanOrEqual(4.5);
  });
});

test.describe('WP-2 — 13x13 표는 라이트 모드에서도 그대로 읽힌다', () => {
  /*
   * The site's core object, and the one ruling 104 named: the in-range label used to be drawn
   * in `ground-900`, the PAGE colour, which inverts with the theme and turns near-white on
   * orange. This measures the cells as the browser actually paints them, in both themes.
   */
  for (const theme of ['dark', 'light'] as const) {
    test(`in-range and out-of-range cells stay legible and distinct — ${theme}`, async ({
      page,
    }) => {
      // An explicit stored choice, so the assertion does not depend on the OS preference the
      // test runner happens to report.
      await withStoredTheme(page, theme);
      await page.goto(koPath('/tools/range'));

      const grid = page.getByRole('group', { name: /레인지 표/u }).first();
      await expect(grid).toBeVisible();

      const cells = await grid.evaluate((element) => {
        const read = (button: Element) => {
          const style = getComputedStyle(button);
          return { colour: style.color, background: style.backgroundColor };
        };
        const buttons = Array.from(element.querySelectorAll('button'));
        const inRange = buttons.find((button) =>
          (button.getAttribute('aria-label') ?? '').includes('레인지 포함'),
        );
        const outOfRange = buttons.find((button) =>
          (button.getAttribute('aria-label') ?? '').includes('레인지 밖'),
        );
        if (inRange === undefined || outOfRange === undefined) {
          throw new Error('the range page rendered no in-range / out-of-range cells');
        }
        return { inRange: read(inRange), outOfRange: read(outOfRange) };
      });

      // Each cell's own key is readable on its own fill.
      expect(
        contrastOf(cells.inRange.colour, cells.inRange.background),
        `in-range label in the ${theme} theme`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastOf(cells.outOfRange.colour, cells.outOfRange.background),
        `out-of-range label in the ${theme} theme`,
      ).toBeGreaterThanOrEqual(4.5);
      // ... and the two fills are still telling different stories at a glance.
      expect(
        contrastOf(cells.inRange.background, cells.outOfRange.background),
        `in-range vs out-of-range fill in the ${theme} theme`,
      ).toBeGreaterThanOrEqual(2.5);
    });
  }

  test('a primary button label is readable on the brand fill in the light theme', async ({
    page,
  }) => {
    // The brand fill is written at eighteen call sites, all of which name `text-ink-on-brand`.
    // The mistake this guards against is `text-text-100` — the PAGE ink, near-black in the
    // light theme, which would render every primary button on the site as black on dark red.
    await withStoredTheme(page, 'light');
    await page.goto(koPath('/practice/range-quiz'));

    const measured = await page.evaluate(() => {
      // Controls only: the header wordmark's decorative brand square is also `.bg-brand-600` and
      // sits earlier in the DOM, but it has no label to read.
      const button = document.querySelector('a.bg-brand-600, button.bg-brand-600');
      if (button === null) return null;
      const style = getComputedStyle(button);
      return { colour: style.color, background: style.backgroundColor };
    });
    expect(measured, 'no brand-filled control on this page to measure').not.toBeNull();
    if (measured === null) return;
    expect(contrastOf(measured.colour, measured.background)).toBeGreaterThanOrEqual(4.5);
  });
});

/*
 * The AA gap WP-2 could not close from inside its file boundary, measured in a real browser on
 * a real hover rather than from the token table alone. `hover:bg-brand-500` used to put the
 * label on the identity red `#ff334d` — 3.60:1. The unit test proves the TOKEN clears 4.5:1;
 * this proves the button is actually wired to it, in both themes, after a real pointer move.
 */
for (const theme of ['dark', 'light'] as const) {
  test(`a primary button stays readable while hovered — ${theme}`, async ({ page }) => {
    await withStoredTheme(page, theme);
    await page.goto(koPath('/'));
    // The button carries `transition-colors`, so a computed style read straight after the
    // pointer moves can land mid-interpolation. Killing transitions makes the read the final
    // colour; the hover RULE, which is what this test is about, is untouched.
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });

    const cta = page.locator('a.bg-brand-600').first();
    await expect(cta).toBeVisible();

    const resting = await cta.evaluate((el) => getComputedStyle(el).backgroundColor);
    await cta.hover();
    const hovered = await cta.evaluate((el) => ({
      colour: getComputedStyle(el).color,
      background: getComputedStyle(el).backgroundColor,
    }));

    // The hover has to actually change the fill, or this test would pass on a button that
    // simply never reacts.
    expect(hovered.background).not.toBe(resting);
    expect(contrastOf(hovered.colour, hovered.background)).toBeGreaterThanOrEqual(4.5);
    // …and it must still be the brand red getting brighter, not a retreat to a neutral.
    const [r, g, b] = (hovered.background.match(/\d+/gu) ?? []).map(Number) as [
      number,
      number,
      number,
    ];
    expect(r, 'the hovered fill is no longer red-dominant').toBeGreaterThan(Math.max(g, b) + 60);
  });
}

test.describe('WP-2 — 헤더', () => {
  test('carries six primary destinations, /blog among them', async ({ page }) => {
    // FISHTILT_STATE ruling 102. Twenty articles — fifteen per cent of the site — used to hang
    // off a footer link and one homepage section.
    await page.goto(koPath('/'));
    const nav = page.getByLabel('주요 메뉴');
    await expect(nav.getByRole('link')).toHaveCount(6);
    await expect(nav.getByRole('link', { name: '블로그' })).toHaveAttribute(
      'href',
      koPath('/blog'),
    );
  });

  test('keeps /hands and /about in the footer, not the header', async ({ page }) => {
    // The header is a starting point, not an index of the site.
    await page.goto(koPath('/'));
    await expect(page.getByLabel('주요 메뉴').getByRole('link', { name: '핸드 목록' })).toHaveCount(
      0,
    );
    await expect(
      page.getByLabel('바닥글 메뉴').getByRole('link', { name: '핸드 목록' }),
    ).toHaveCount(1);
    await expect(page.getByLabel('바닥글 메뉴').getByRole('link', { name: '소개' })).toHaveCount(1);
  });

  test('lists /blog exactly once in the footer, despite also being in the header', async ({
    page,
  }) => {
    // `FOOTER_NAV_IDS` spreads `PRIMARY_NAV_IDS`; promoting `blog` without removing the extra
    // literal would have rendered it twice.
    await page.goto(koPath('/'));
    await expect(page.getByLabel('바닥글 메뉴').getByRole('link', { name: '블로그' })).toHaveCount(
      1,
    );
  });

  test('marks the section the reader is in, on the real prerendered HTML', async ({ page }) => {
    /*
     * This is what a unit test genuinely cannot check: `usePathname` reports the route
     * TEMPLATE while Next prerenders a dynamic page, and the browser reports the concrete
     * path after hydration. Both have to produce the same mark, or the markup changes under
     * React on hydration.
     */
    for (const [path, label] of [
      [koPath('/blog/pot-odds-quick'), '블로그'],
      [koPath('/learn/poker-range'), '배우기'],
      [koPath('/glossary/pot-odds'), '포커 용어'],
      [koPath('/tools/range'), '핸드레인지'],
      [koPath('/tools/equity'), '무료 도구'],
      [koPath('/practice/range-quiz'), '퀴즈'],
    ] as const) {
      await page.goto(path);
      const nav = page.getByLabel('주요 메뉴');
      await expect(nav.getByRole('link', { name: label }), path).toHaveAttribute(
        'aria-current',
        'page',
      );
      // Exactly one, even where two nav paths prefix the current one (`/tools/range`).
      await expect(nav.locator('[aria-current="page"]'), path).toHaveCount(1);
    }
  });

  test('marks nothing in the nav on a page that belongs to no section', async ({ page }) => {
    await page.goto(koPath('/about'));
    await expect(page.getByLabel('주요 메뉴').locator('[aria-current="page"]')).toHaveCount(0);
  });
});

test.describe('WP-2 — 파비콘', () => {
  test('serves an SVG icon and links it from every page', async ({ page }) => {
    const response = await page.goto('/icon.svg');
    expect(response?.status()).toBe(200);
    expect(response?.headers()['content-type']).toContain('image/svg+xml');

    await page.goto(koPath('/'));
    const icons = page.locator('link[rel="icon"]');
    await expect(icons).not.toHaveCount(0);
    expect(await icons.first().getAttribute('href')).toContain('icon');
  });

  test('serves the Apple touch icon and links it too', async ({ page }) => {
    // WP-2 left this out for want of a raster tool; WP-2b rendered it with the Playwright
    // chromium this suite already runs on. Apple's convention is a full-bleed opaque square —
    // iOS applies its own mask — which is why this one is not simply `icon.svg` resized.
    const response = await page.goto('/apple-icon.png');
    expect(response?.status()).toBe(200);
    expect(response?.headers()['content-type']).toContain('image/png');

    await page.goto(koPath('/'));
    const apple = page.locator('link[rel="apple-touch-icon"]');
    await expect(apple).toHaveCount(1);
    expect(await apple.first().getAttribute('href')).toContain('apple-icon');
  });
});

test.describe('본문 건너뛰기 링크 (WCAG 2.4.1)', () => {
  /*
   * The Stage-2 review measured the gap: the first Tab stop on every page was the wordmark,
   * so a keyboard-only visitor who does not use a screen reader walked six nav links, search,
   * the theme toggle and the hamburger before reaching the article — on every page. A screen
   * reader user could already jump by landmark; this is the half of that audience `<main>`
   * does nothing for.
   *
   * The second test is the one that matters. A skip link that scrolls but does not MOVE focus
   * is the classic non-fix: it looks right, and the very next Tab throws the reader back into
   * the header they were escaping. Asserting the anchor exists would not catch that, so the
   * test presses the key and then asks the document who has focus.
   */
  test('is the first thing a keyboard reaches, on a content page', async ({ page }) => {
    await page.goto(koPath('/learn/holdem-basics'));
    await page.keyboard.press('Tab');

    const first = await page.evaluate(() => ({
      tag: document.activeElement?.tagName ?? '',
      href: document.activeElement?.getAttribute('href') ?? '',
      text: document.activeElement?.textContent?.trim() ?? '',
    }));
    expect(first.tag).toBe('A');
    expect(first.href).toBe('#main-content');
    expect(first.text).toBe('본문으로 건너뛰기');
  });

  test('is clipped away until it has focus, then lands on screen', async ({ page }) => {
    await page.goto(koPath('/learn/holdem-basics'));
    const link = page.getByRole('link', { name: '본문으로 건너뛰기' });

    /*
     * NOT `toBeVisible()` / `toBeHidden()`, and not a size check either. `sr-only` deliberately
     * leaves the element rendered and reachable — that is what makes it tabbable at all — and
     * removes it from sight with `clip-path`, so Playwright still considers it visible and it
     * still has a box. The property that decides whether a sighted reader sees it is the clip,
     * so the clip is what this asserts, in both states.
     */
    const clip = () => link.evaluate((el) => getComputedStyle(el).clipPath);
    expect(await clip(), 'the skip link is painted before anyone focuses it').toBe('inset(50%)');

    await page.keyboard.press('Tab');
    expect(await clip(), 'focusing the skip link must unclip it').toBe('none');

    const box = await link.boundingBox();
    expect(box?.x ?? -1, 'the focused skip link sits off the left edge').toBeGreaterThanOrEqual(0);
    expect(box?.y ?? -1, 'the focused skip link sits above the viewport').toBeGreaterThanOrEqual(0);
    expect(box?.width ?? 0, 'the focused skip link is too small to read').toBeGreaterThan(80);

    /*
     * The 44px this link is exempted from elsewhere. `responsive-a11y.spec.ts` skips controls
     * that are clipped away, because a finger cannot aim at something the browser is not
     * painting — and this is the one control that relies on that exclusion. So the size rule
     * is enforced here instead, in the only state a pointer could ever reach it in. The
     * exemption buys nothing; it just moves the measurement to where it means something.
     */
    expect(
      box?.height ?? 0,
      'the focused skip link is under the 44px target size',
    ).toBeGreaterThanOrEqual(44);
  });

  test('actually moves focus into the content, not just the scroll position', async ({ page }) => {
    await page.goto(koPath('/learn/holdem-basics'));
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    const landed = await page.evaluate(() => document.activeElement?.id ?? '');
    expect(landed, 'focus stayed on the link — the skip link scrolls but does not skip').toBe(
      'main-content',
    );

    /* And from there the next Tab goes forward into the article, never back into the nav. */
    await page.keyboard.press('Tab');
    const inMain = await page.evaluate(
      () =>
        document.querySelector('main')?.contains(document.activeElement) === true ||
        document.getElementById('main-content')?.contains(document.activeElement) === true,
    );
    expect(inMain, 'the Tab after the skip landed outside the content').toBe(true);
  });
});

test.describe('WP-S3-15 — 모바일 메뉴 (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  const openMenu = async (page: Page) => {
    await page.getByRole('button', { name: '메뉴 열기' }).click();
    const panel = page.getByRole('navigation', { name: '주요 메뉴 (모바일)' });
    await expect(panel).toBeVisible();
    return panel;
  };

  test('the six destinations are in the panel, /blog visible, every row at least 44px', async ({
    page,
  }) => {
    await page.goto(koPath('/'));
    // Closed: the desktop nav is display:none here and the panel is not in the DOM at all.
    await expect(page.getByRole('navigation', { name: '주요 메뉴 (모바일)' })).toHaveCount(0);
    const panel = await openMenu(page);

    for (const label of ['배우기', '핸드레인지', '무료 도구', '퀴즈', '블로그', '포커 용어']) {
      const link = panel.getByRole('link', { name: label, exact: true });
      await expect(link, label).toBeVisible();
      const box = await link.boundingBox();
      expect(box?.height ?? 0, `${label} row height`).toBeGreaterThanOrEqual(44);
    }
    // And the pages the desktop header leaves to the footer are one tap away on a phone.
    await expect(panel.getByRole('link', { name: '소개', exact: true })).toBeVisible();
    await expect(panel.getByRole('link', { name: '핸드 목록', exact: true })).toBeVisible();
  });

  test('opening moves focus into the panel; Escape closes it and returns focus to the button', async ({
    page,
  }) => {
    await page.goto(koPath('/'));
    const panel = await openMenu(page);
    await expect(panel.getByRole('link').first()).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('navigation', { name: '주요 메뉴 (모바일)' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '메뉴 열기' })).toBeFocused();
  });

  test('Tab is trapped: past the last link it wraps to the close button, never into the page', async ({
    page,
  }) => {
    await page.goto(koPath('/'));
    const panel = await openMenu(page);
    const count = await panel.getByRole('link').count();
    // Focus starts on the first link; `count - 1` Tabs reach the last, one more must wrap.
    for (let i = 0; i < count - 1; i += 1) await page.keyboard.press('Tab');
    await expect(panel.getByRole('link').last()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: '메뉴 닫기' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(panel.getByRole('link').last()).toBeFocused();
  });

  test('marks the current section inside the panel', async ({ page }) => {
    await page.goto(koPath('/learn/poker-range'));
    const panel = await openMenu(page);
    await expect(panel.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(panel.getByRole('link', { name: '배우기', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('has no horizontal overflow with the panel open', async ({ page }) => {
    await page.goto(koPath('/'));
    await openMenu(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
