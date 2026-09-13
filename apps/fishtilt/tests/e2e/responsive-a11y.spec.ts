import { expect, test, type Locator, type Page } from '@playwright/test';
import { koPath } from './helpers.js';

/*
 * WP-O1 (responsive) + WP-O2 (accessibility) regression net.
 *
 * Everything here asserts a RULE that must hold for every surface, at every width, forever —
 * never one element on one page (`docs/FISHTILT_STATE.md` ruling 26). The surface list is a
 * fixed set of route SHAPES rather than a slice of the content registry, so publishing another
 * lesson or article cannot silently shrink what is covered, and no assertion depends on how
 * much of the product happens to exist today.
 *
 * Findings are taken from the DOM, never from a screenshot: `scrollWidth` vs `clientWidth` and
 * `getBoundingClientRect()`. A downscaled full-page image is not evidence of a layout bug
 * (build spec §41).
 */

const VIEWPORTS = [1440, 1280, 1024, 768, 430, 390, 360] as const;

/** The surfaces the responsive brief names, plus one lesson page — the lesson is the only
 *  place the 13x13 chart appears INSIDE an article column rather than on a full-width page,
 *  which is the narrowest box the matrix ever has to live in. */
const SURFACES: readonly (readonly [string, string])[] = [
  ['홈', koPath('/')],
  ['핸드레인지', koPath('/tools/range')],
  ['시작 패', koPath('/tools/starting-hand')],
  ['승률', koPath('/tools/equity')],
  ['팟 오즈', koPath('/tools/pot-odds')],
  ['아웃', koPath('/tools/outs')],
  ['핸드 체커', koPath('/tools/hand-checker')],
  ['배우기 목록', koPath('/learn')],
  ['레슨', koPath('/learn/poker-range')],
  ['블로그 목록', koPath('/blog')],
  ['용어 목록', koPath('/glossary')],
  ['검색', koPath('/search')],
  ['레인지 퀴즈', koPath('/practice/range-quiz')],
  ['핸드 순위 퀴즈', koPath('/practice/hand-ranking-quiz')],
  ['시작 패 퀴즈', koPath('/practice/starting-hand-quiz')],
];

/** The page's own horizontal overflow, measured on the document element. `+1` of slack:
 *  sub-pixel layout can leave `scrollWidth` a hair over `clientWidth` on a page that fits. */
async function horizontalOverflow(
  page: Page,
): Promise<{ scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

test.describe('WP-O1 — 페이지는 어떤 화면 폭에서도 가로로 넘치지 않는다', () => {
  for (const width of VIEWPORTS) {
    test(`no page-level horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 500 ? 800 : 900 });
      for (const [name, path] of SURFACES) {
        await page.goto(path);
        const { scrollWidth, clientWidth } = await horizontalOverflow(page);
        expect(
          scrollWidth,
          `${name} (${path}) overflows horizontally at ${width}px: scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`,
        ).toBeLessThanOrEqual(clientWidth + 1);
      }
    });
  }
});

test.describe('WP-O1 — 표가 스크롤되지, 페이지가 스크롤되는 것이 아니다', () => {
  /*
   * The trade the 13x13 chart makes on a phone: 13 columns of 44px cells cannot fit a 360px
   * screen, so the MATRIX scrolls inside its own wrapper and the cells stay legible and
   * tappable, while the page around it never gains horizontal scroll. Both halves are
   * asserted — a matrix that stopped scrolling would be as broken as a page that started.
   */
  for (const path of ['/tools/range', '/learn/poker-range', '/'].map((sitePath) =>
    koPath(sitePath),
  )) {
    test(`the matrix scrolls inside its own wrapper on ${path}, the page does not`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto(path);

      const grid = page.getByRole('group', { name: /레인지 표|핸드 레인지 표/u }).first();
      await expect(grid).toBeVisible();

      const measured = await grid.evaluate((el) => {
        const scroller = el.parentElement;
        return {
          gridWidth: el.getBoundingClientRect().width,
          scrollerScrollWidth: scroller?.scrollWidth ?? 0,
          scrollerClientWidth: scroller?.clientWidth ?? 0,
          overflowX: scroller === null ? '' : getComputedStyle(scroller).overflowX,
        };
      });

      expect(measured.overflowX).toMatch(/auto|scroll/u);
      expect(measured.scrollerScrollWidth).toBeGreaterThan(measured.scrollerClientWidth);

      const { scrollWidth, clientWidth } = await horizontalOverflow(page);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });
  }
});

test.describe('WP-O1 — 모바일에서 손가락으로 누를 수 있는 크기', () => {
  /*
   * 44px minimum, measured on the real box.
   *
   * TWO exclusions, both structural rules rather than an allowlist of the elements that
   * happen to fail today:
   *
   *  - a control that is CLIPPED AWAY paints nothing, so there is nothing on screen to aim a
   *    finger at. This is the skip link (`src/app/layout.tsx`), which is `sr-only` until it
   *    takes keyboard focus. The exclusion is written as "the browser is painting none of
   *    this element" rather than "skip the skip link", and it does not launder a too-small
   *    control: `theme-and-header.spec.ts` measures that same link once it is FOCUSED and
   *    holds it to this very 44px, which is the only state a pointer could ever reach it in;
   *  - a control wrapped in a `<label>` is tapped through that label, so the label's box is
   *    the target (the pot-odds all-in checkbox is a 20px box inside a 44px label);
   *  - a `.stretched-link` (a card's title link) is tapped through its card: its `::after`
   *    covers the nearest positioned ancestor (`globals.css`), so that ancestor's box is the
   *    target, exactly as a label's is;
   *  - a control that SHARES ITS LINE with ordinary text is inline-in-a-sentence — a
   *    `<Term>` trigger, a prose link. WCAG carries an explicit inline exception for exactly
   *    these: their height is the line box of the surrounding paragraph, and forcing 44px
   *    would make one line's target overlap the next line's. `display: inline` cannot be the
   *    test — a browser blockifies `display: inline` on a `<button>` to `inline-block`, so
   *    `Term`'s carefully-inline trigger reports as `inline-block`. What is checked instead
   *    is whether the control's own block container holds any text in the SAME inline
   *    formatting context that is not itself inside a control. A row of filter buttons has
   *    none and stays in scope; a sentence with a glossary word in it has plenty.
   */
  const MIN_TARGET = 44;

  for (const width of [430, 390, 360] as const) {
    test(`every standalone control is at least 44px tall at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      const failures: string[] = [];

      for (const [name, path] of SURFACES) {
        await page.goto(path);
        const small = await page.evaluate((min) => {
          const CONTROL =
            'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"]';

          /** Does this control sit inside running text, sharing its line with it? */
          const isInlineInText = (el: Element): boolean => {
            let block = el.parentElement;
            while (block !== null && getComputedStyle(block).display.startsWith('inline')) {
              block = block.parentElement;
            }
            if (block === null) return false;
            const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
            let free = '';
            while (walker.nextNode()) {
              let ancestor = walker.currentNode.parentElement;
              let sameLine = true;
              while (ancestor !== null && ancestor !== block) {
                if (
                  ancestor.matches(CONTROL) ||
                  !getComputedStyle(ancestor).display.startsWith('inline')
                ) {
                  sameLine = false;
                  break;
                }
                ancestor = ancestor.parentElement;
              }
              if (sameLine) free += walker.currentNode.textContent ?? '';
            }
            return free.trim() !== '';
          };

          const out: { sel: string; name: string; h: number }[] = [];
          for (const el of Array.from(document.querySelectorAll<HTMLElement>(CONTROL))) {
            const style = getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') continue;
            // Clipped to nothing — `sr-only`'s `clip-path: inset(50%)`, or the older
            // `clip: rect(0,0,0,0)`. The box still has a size; none of it is painted.
            if (style.clipPath === 'inset(50%)' || style.clip === 'rect(0px, 0px, 0px, 0px)') {
              continue;
            }
            const box = el.getBoundingClientRect();
            if (box.width === 0 || box.height === 0) continue;
            const label = el.closest('label');
            let stretched: HTMLElement | null = null;
            if (el.classList.contains('stretched-link')) {
              stretched = el.parentElement;
              while (stretched !== null && getComputedStyle(stretched).position === 'static') {
                stretched = stretched.parentElement;
              }
            }
            const height = Math.max(
              box.height,
              label?.getBoundingClientRect().height ?? 0,
              stretched?.getBoundingClientRect().height ?? 0,
            );
            if (height + 0.5 >= min) continue;
            if (isInlineInText(el)) continue;
            out.push({
              sel: el.tagName.toLowerCase(),
              name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40),
              h: Math.round(height * 10) / 10,
            });
          }
          return out;
        }, MIN_TARGET);

        for (const item of small) {
          failures.push(`${name} (${path}): <${item.sel}> "${item.name}" is ${item.h}px tall`);
        }
      }

      expect(failures, failures.join('\n')).toEqual([]);
    });
  }
});

test.describe('WP-O2 — 이름 없는 컨트롤도, 중복된 id도 없다', () => {
  test('every interactive control on every surface has an accessible name', async ({ page }) => {
    const failures: string[] = [];
    for (const [name, path] of SURFACES) {
      await page.goto(path);
      const nameless = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of Array.from(
          document.querySelectorAll<HTMLElement>(
            'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"]',
          ),
        )) {
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          const labelled =
            (el.getAttribute('aria-label') ?? '').trim() !== '' ||
            el.getAttribute('aria-labelledby') !== null ||
            (el.textContent ?? '').trim() !== '' ||
            ((el as HTMLInputElement).labels?.length ?? 0) > 0 ||
            (el.getAttribute('title') ?? '').trim() !== '';
          if (!labelled) out.push(el.outerHTML.slice(0, 100));
        }
        return out;
      });
      for (const item of nameless) failures.push(`${name} (${path}): ${item}`);
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  test('no element id appears twice on a page', async ({ page }) => {
    /*
     * The bug this would have caught: `CardPicker` used a fixed `card-picker-suit-<suit>` id,
     * so `/tools/equity` (three pickers) and `/tools/hand-checker` (two) emitted duplicates and
     * every `aria-labelledby` on the second and third picker resolved back to the FIRST
     * picker's suit headings. A duplicate id silently redirects any labelling reference, so
     * this is checked everywhere rather than only where a picker happens to be today.
     */
    const failures: string[] = [];
    for (const [name, path] of SURFACES) {
      await page.goto(path);
      const duplicates = await page.evaluate(() => {
        const seen = new Map<string, number>();
        for (const el of Array.from(document.querySelectorAll('[id]'))) {
          seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
        }
        return Array.from(seen.entries())
          .filter(([, count]) => count > 1)
          .map(([id, count]) => `${id} x${count}`);
      });
      for (const item of duplicates) failures.push(`${name} (${path}): ${item}`);
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });
});

test.describe('WP-O2 — 표의 칸과 자리 버튼은 읽어줄 이름을 가진다', () => {
  test('every one of the 169 cells announces its key and a Korean reading', async ({ page }) => {
    /*
     * `AKs` announced on its own is three Latin letters read out one at a time, which leaves a
     * 169-button grid unusable by ear. The rule: the name STARTS with the key the cell shows
     * (ADR-0053 — the notation is never replaced) and then carries Korean.
     */
    await page.goto(koPath('/tools/range'));
    const grid = page.getByRole('group', { name: /레인지 표/u }).first();
    await expect(grid).toBeVisible();

    const bad = await grid.evaluate((el) => {
      const out: string[] = [];
      const cells = Array.from(el.querySelectorAll('button'));
      if (cells.length !== 169) out.push(`expected 169 cells, found ${cells.length}`);
      for (const cell of cells) {
        const key = (cell.textContent ?? '').trim();
        const name = cell.getAttribute('aria-label') ?? '';
        if (!name.startsWith(`${key} `))
          out.push(`"${key}" -> "${name}" (key missing or not first)`);
        else if (!/[가-힣]/u.test(name.slice(key.length)))
          out.push(`"${key}" -> "${name}" (no reading)`);
      }
      return out;
    });
    expect(bad, bad.join('\n')).toEqual([]);
  });

  for (const path of ['/tools/range', '/', '/learn/poker-range'].map((sitePath) =>
    koPath(sitePath),
  )) {
    test(`position buttons on ${path} announce the Korean name, not the bare abbreviation`, async ({
      page,
    }) => {
      /*
       * `docs/FISHTILT_STATE.md` ruling 65. ADR-0053 keeps the abbreviation as the visible
       * label; what a screen reader says must be the name it stands for, and the page must
       * explain it once near the control.
       */
      await page.goto(path);
      const group = page.getByRole('group', { name: /자리 선택|내 위치/u }).first();
      await expect(group).toBeVisible();

      const buttons = await group.evaluate((el) =>
        Array.from(el.querySelectorAll('button')).map((button) => ({
          text: (button.textContent ?? '').trim(),
          name: button.getAttribute('aria-label') ?? '',
        })),
      );
      expect(buttons.length).toBeGreaterThan(0);
      for (const button of buttons) {
        expect(button.text, 'the visible label stays the abbreviation (ADR-0053)').toMatch(
          /^[A-Z]{2,3}$/u,
        );
        expect(button.name, `"${button.text}" announces no Korean name`).toMatch(/[가-힣]/u);
        expect(button.name).toContain(button.text);
      }

      // ... and the explanation is on screen NEAR THE CONTROL, for a reader who is not using
      // a screen reader. Scoped to the control's own block, not the whole page: a gloss three
      // sections away is not what ruling 65 asked for.
      const nearby = await group.evaluate((el) => (el.parentElement as HTMLElement).innerText);
      for (const button of buttons) {
        expect(nearby, `no visible gloss beside the ${button.text} button`).toMatch(
          new RegExp(`${button.text}\\s+[가-힣]`, 'u'),
        );
      }
    });
  }
});

test.describe('WP-Q3/M8 — 375px에서 카드를 고르는 동안 결과가 화면에 남아 있다', () => {
  /*
   * `docs/reports/REVIEW_BEGINNER_UX_SEO.md` M8. `/tools/equity` and `/tools/hand-checker`
   * were `grid grid-cols-1` at every width with 결과 BELOW the pickers — three 52-card
   * pickers on the equity page, roughly 36 rows of buttons at 375px between the last card
   * tapped and the answer. The two calculators whose whole value is "change a card, watch the
   * number move" were the two where you could not watch it move.
   *
   * The requirement is behavioural, so the test is measured in a real browser at a real
   * 375px viewport with `toBeInViewport()` and bounding boxes — never from a screenshot
   * (build spec §41 / the VISUAL QA rule).
   *
   * It asserts the property for EVERY picker on the page, not for one card, because the two
   * halves of the fix fail in opposite places and a single tap only ever catches one of them:
   *
   *  - result BELOW the pickers (the shipped defect) fails at the FIRST picker — the answer
   *    is a whole page further down. It would pass a test that only taps the last row of the
   *    last picker, because there the answer happens to sit just underneath.
   *  - result above the pickers but NOT sticky fails at the LAST picker — the answer has
   *    scrolled off the top by the time the reader reaches the cards.
   *
   * The answer itself is asserted, not just the panel's chrome, and each surface's taps keep
   * the selection COMPUTABLE: a one-card board on `/tools/equity` is deliberately blocked
   * (0, 3, 4 or 5 only), and a panel showing "아직 계산할 수 없습니다" would satisfy a
   * panel-only assertion while proving nothing about watching the number move.
   */
  interface ResultSurface {
    readonly name: string;
    readonly path: string;
    /** Every card picker on the page, in DOM order. */
    readonly pickers: readonly string[];
    /** Cards to tap for real, in the last picker, leaving a computable selection. */
    readonly cards: readonly string[];
    /** The answer itself, inside the result panel, which must stay on screen throughout. */
    readonly answer: (result: Locator) => Locator;
  }

  const SURFACES_WITH_A_RESULT: readonly ResultSurface[] = [
    {
      name: '승률 계산기',
      path: koPath('/tools/equity'),
      pickers: ['내 핸드 카드 선택', '상대 핸드 카드 선택', '보드 카드 선택'],
      cards: ['클럽 2', '클럽 3', '클럽 4'],
      // Hero / 비김 / 상대, in DOM order — `.first()` is hero's own percentage.
      answer: (result) => result.getByText(/^\d{1,3}\.\d%$/).first(),
    },
    {
      name: '핸드 체커',
      path: koPath('/tools/hand-checker'),
      pickers: ['핸드 카드 선택', '보드 카드 선택'],
      // The page opens on a 3-card board; a fourth keeps the hand evaluable (6 cards) and
      // does not change the best five, so the reading below stays the right expectation.
      cards: ['클럽 2'],
      answer: (result) => result.getByText('에이스와 킹 투페어'),
    },
  ];

  for (const surface of SURFACES_WITH_A_RESULT) {
    test(`${surface.name} keeps 결과 on screen from every picker at 375px`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(surface.path);

      const result = page
        .locator('section')
        .filter({ has: page.getByRole('heading', { level: 2, name: '결과', exact: true }) })
        .first();
      await expect(result).toBeVisible();
      const answer = surface.answer(result);
      await expect(answer).toBeVisible();

      // Reaching for the deepest card of each picker in turn — the reading position a
      // beginner is actually in while changing that side of the question.
      for (const label of surface.pickers) {
        await page
          .getByRole('group', { name: label })
          .getByRole('button')
          .last()
          .scrollIntoViewIfNeeded();
        await expect(result, `결과 left the screen from ${label}`).toBeInViewport();
        await expect(answer, `the answer left the screen from ${label}`).toBeInViewport();
      }

      const picker = page.getByRole('group', { name: surface.pickers.at(-1) as string });
      for (const card of surface.cards) {
        await picker.getByRole('button', { name: `${card} 선택`, exact: true }).click();
        // The click landed on the card, not on the panel stuck over it. The button renames
        // itself on selection, so this is a fresh locator rather than the one just clicked.
        await expect(
          picker.getByRole('button', { name: `${card} 선택됨`, exact: true }),
        ).toHaveAttribute('aria-pressed', 'true');
      }

      // The answer, not just the panel's chrome, is on screen after the last tap.
      await expect(result).toBeInViewport();
      await expect(answer).toBeInViewport();

      const box = await result.boundingBox();
      expect(box, 'the result panel must have a box').not.toBeNull();
      if (box === null) return;
      // Actually within the viewport, and not so tall that it leaves no room to pick with.
      expect(box.y).toBeLessThan(667);
      expect(box.y + box.height).toBeGreaterThan(0);
      expect(box.height).toBeLessThan(667 * 0.6);
    });
  }
});

/*
 * WP-S3-17 — the accessibility contract the QA pass verified by hand, pinned as rules.
 *
 * Same discipline as above: every assertion is a RULE over a fixed set of route shapes,
 * read from the DOM, never from a screenshot. `A11Y_SURFACES` adds the content templates
 * the responsive list does not carry (an article, a hand story, a term, a hand, about,
 * a search result page) because those are where heading order and landmarks are most
 * likely to drift — an MDX author can type `####` under an `##`.
 */
const A11Y_SURFACES: readonly (readonly [string, string])[] = [
  ...SURFACES,
  ['검색 가이드', koPath('/blog/aks-vs-ako')],
  ['핸드 스토리', koPath('/blog/qq-vs-72o-flop-227')],
  ['용어', koPath('/glossary/three-bet')],
  ['핸드', koPath('/hands/aks')],
  ['도구 목록', koPath('/tools')],
  ['소개', koPath('/about')],
  ['검색 결과', koPath('/search?q=3벳')],
];

test.describe('WP-S3-17 — 랜드마크와 제목 구조', () => {
  test('every surface has one h1, one main, one header, one footer, and every nav is named', async ({
    page,
  }) => {
    const failures: string[] = [];
    for (const [name, path] of A11Y_SURFACES) {
      await page.goto(path);
      const found = await page.evaluate(() => {
        const visible = (el: Element) => getComputedStyle(el).display !== 'none';
        const navs = Array.from(document.querySelectorAll('nav')).filter(visible);
        return {
          h1: Array.from(document.querySelectorAll('h1')).filter(visible).length,
          main: document.querySelectorAll('main').length,
          header: document.querySelectorAll('header').length >= 1,
          footer: document.querySelectorAll('footer').length,
          unnamedNavs: navs
            .filter((n) => !n.getAttribute('aria-label') && !n.getAttribute('aria-labelledby'))
            .map((n) => n.outerHTML.slice(0, 80)),
        };
      });
      if (found.h1 !== 1) failures.push(`${name} (${path}): ${found.h1} h1`);
      if (found.main !== 1) failures.push(`${name} (${path}): ${found.main} <main>`);
      if (!found.header) failures.push(`${name} (${path}): no <header>`);
      if (found.footer !== 1) failures.push(`${name} (${path}): ${found.footer} <footer>`);
      for (const nav of found.unnamedNavs) failures.push(`${name} (${path}): unnamed <nav> ${nav}`);
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  test('heading levels inside <main> never skip (h2 → h4) on any surface', async ({ page }) => {
    const failures: string[] = [];
    for (const [name, path] of A11Y_SURFACES) {
      await page.goto(path);
      const skipped = await page.evaluate(() => {
        const main = document.querySelector('main');
        if (main === null) return ['no <main>'];
        const out: string[] = [];
        let prev = 0;
        for (const h of Array.from(main.querySelectorAll('h1,h2,h3,h4,h5,h6'))) {
          if (getComputedStyle(h).display === 'none') continue;
          const level = Number(h.tagName[1]);
          if (prev > 0 && level > prev + 1) {
            out.push(`h${prev} → h${level} "${(h.textContent ?? '').trim().slice(0, 40)}"`);
          }
          prev = level;
        }
        return out;
      });
      for (const item of skipped) failures.push(`${name} (${path}): ${item}`);
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });
});

test.describe('WP-S3-17 — 건너뛰기 링크, 장식 그림, 줄어든 모션', () => {
  test('the first Tab stop is the skip link, it becomes visible, and Enter moves focus into the content', async ({
    page,
  }) => {
    await page.goto(koPath('/'));
    await page.keyboard.press('Tab');
    const link = page.getByRole('link', { name: '본문으로 건너뛰기' });
    await expect(link).toBeFocused();
    // Painted, not just focused: a skip link nobody can see is the bug the layout comment names.
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
  });

  test('every <img> has alt and every top-level <svg> is hidden, presentational, or a named image', async ({
    page,
  }) => {
    const failures: string[] = [];
    for (const [name, path] of A11Y_SURFACES) {
      await page.goto(path);
      const bad = await page.evaluate(() => {
        const out: string[] = [];
        for (const img of Array.from(document.querySelectorAll('img'))) {
          if (!img.hasAttribute('alt'))
            out.push(`<img src="${img.getAttribute('src') ?? ''}"> without alt`);
        }
        for (const svg of Array.from(document.querySelectorAll('svg'))) {
          if (svg.parentElement?.closest('svg')) continue;
          if (svg.closest('[aria-hidden="true"]')) continue;
          const role = svg.getAttribute('role');
          const named = svg.getAttribute('aria-label') || svg.getAttribute('aria-labelledby');
          if (role === 'presentation' || role === 'none') continue;
          if (role === 'img' && named) continue;
          out.push(`<svg> inside ${(svg.parentElement?.outerHTML ?? '').slice(0, 70)}`);
        }
        return out;
      });
      for (const item of bad) failures.push(`${name} (${path}): ${item}`);
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  test('with prefers-reduced-motion every transition collapses to (near) zero', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(koPath('/'));
    const slow = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('a, button, summary'))
          .map((el) => getComputedStyle(el).transitionDuration)
          .filter((d) => d.split(',').some((v) => parseFloat(v) > 0.001)).length,
    );
    expect(slow).toBe(0);
  });
});

test.describe('WP-S3-17 — 넓은 표는 표 안에서 스크롤되고, 셀은 단어 중간에서 꺾이지 않는다', () => {
  /*
   * A five-column `DataTable` at 320px: the wrapper scrolls (`[data-scroller]`), the page
   * does not, and a header or row-header cell is never broken inside a word — the "UT / G"
   * and "19.15 / %" the 320px screenshots showed before WP-S3-17.
   */
  for (const width of [320, 360] as const) {
    test(`/blog/next-best-after-aa at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await page.goto(koPath('/blog/next-best-after-aa'));
      const scrollers = page.locator('.table-scroll > [data-scroller]');
      expect(await scrollers.count()).toBeGreaterThan(0);
      const measured = await scrollers.first().evaluate((el) => ({
        overflowX: getComputedStyle(el).overflowX,
        wrappedHeaders: Array.from(el.querySelectorAll('th')).filter((th) => {
          const cs = getComputedStyle(th);
          if (cs.whiteSpace === 'nowrap') return false;
          // A word-only wrap is fine; a break inside a Latin/number token is not. The
          // TEXT RUN of a header that holds a single token must be one line — measured on
          // a Range over the text, because a `<th>` box stretches to the tallest cell in
          // its row and would report two lines for "순위" beside a two-line neighbour.
          const oneToken = !/\s/u.test((th.textContent ?? '').trim());
          const range = document.createRange();
          range.selectNodeContents(th);
          const lines = range.getBoundingClientRect().height / parseFloat(cs.lineHeight);
          return oneToken && lines > 1.5;
        }).length,
      }));
      expect(measured.overflowX).toMatch(/auto|scroll/u);
      expect(measured.wrappedHeaders).toBe(0);
      // WP-S3-19 (review B-M5): the visible caption — the "6인 · 100BB · First In" provenance
      // line — wraps to the column and is never clipped or painted over by the scroll fade:
      // it lies outside the `.table-scroll` box, fits its own width, and ends inside the
      // viewport.
      const captions = page.locator('[data-table-caption]');
      expect(await captions.count()).toBeGreaterThan(0);
      const caption = await captions.first().evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return {
          insideFade: el.closest('.table-scroll') !== null,
          overflows: el.scrollWidth > el.clientWidth,
          right: rect.right,
          viewport: document.documentElement.clientWidth,
        };
      });
      expect(caption.insideFade).toBe(false);
      expect(caption.overflows).toBe(false);
      expect(caption.right).toBeLessThanOrEqual(caption.viewport);
      const { scrollWidth, clientWidth } = await horizontalOverflow(page);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });
  }
});

test.describe('WP-S3-17 — FAQ와 관련 콘텐츠는 카드 벽이 아니라 줄 목록이다', () => {
  /*
   * D-S3-17 forbids the card wall. The measurable half of that rule: an entry in the FAQ
   * band and in a lesson's related-content foot has NO surface of its own — its background
   * is transparent, so what separates entries is a rule, not a box.
   */
  test('home FAQ entries and lesson related-content links carry no box surface', async ({
    page,
  }) => {
    await page.goto(koPath('/'));
    const faqBoxes = await page
      .locator('section[aria-label="자주 묻는 질문"] li')
      .evaluateAll(
        (items) =>
          items.filter((li) => getComputedStyle(li).backgroundColor !== 'rgba(0, 0, 0, 0)').length,
      );
    expect(await page.locator('section[aria-label="자주 묻는 질문"] li').count()).toBeGreaterThan(
      2,
    );
    expect(faqBoxes).toBe(0);

    await page.goto(koPath('/learn/pot-odds'));
    const related = page.locator(
      'section[aria-label="더 배우기"] a, section[aria-label="직접 확인하기"] a',
    );
    expect(await related.count()).toBeGreaterThan(0);
    const relatedBoxes = await related.evaluateAll(
      (links) =>
        links.filter((a) => getComputedStyle(a).backgroundColor !== 'rgba(0, 0, 0, 0)').length,
    );
    expect(relatedBoxes).toBe(0);
  });
});
