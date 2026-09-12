import { expect, test } from '@playwright/test';
import { BLOG_RECORDS } from '../../src/content/registry/blog/index.js';
import { seoTitleOf } from '../../src/content/graph.js';
import { koPath, visibleBodyText } from './helpers.js';

/*
 * `/blog` + `/blog/[slug]` after WP-S3-06: the hub is a magazine (hero · content-type
 * anchor nav · featured + secondary · one section per content type · 전체 글 index) and the
 * article template is the editorial column with a table of contents and breakout figures.
 * See `learn.spec.ts`'s header for why a browser (not happy-dom) has to check prerendering
 * and the 404 behaviour.
 */
const ARTICLE_SLUG = 'aks-vs-ako';
const ARTICLE = koPath(`/blog/${ARTICLE_SLUG}`);
const HUB_H1 = '포커 이야기와 검색 가이드';

/** The registry record the article assertions are read from — titles are data, not copy. */
function articleRecord(slug: string) {
  const record = BLOG_RECORDS.find((entry) => entry.slug === slug);
  if (record === undefined) throw new Error(`no blog record for ${slug}`);
  return record;
}
const ARTICLE_RECORD = articleRecord(ARTICLE_SLUG);

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

test.describe('blog hub', () => {
  test('lists every article in the index, links only what is written', async ({ page }) => {
    await page.goto(koPath('/blog'));
    await expect(page.getByRole('heading', { level: 1, name: HUB_H1 })).toBeVisible();

    /*
     * The 전체 글 region is the honesty gate: every row is either a real link (published) or
     * inert text carrying a 준비 중 badge (planned), never both, never neither — regardless
     * of how many articles are published (`docs/FISHTILT_STATE.md` ruling 26/42).
     */
    const section = page.getByRole('region', { name: '전체 글' });
    const rows = section.locator('li');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    let linkedCount = 0;
    for (let i = 0; i < rowCount; i += 1) {
      const row = rows.nth(i);
      const badgeCount = await row.getByText('준비 중', { exact: true }).count();
      const linkCount = await row.locator('a').count();
      expect(badgeCount + linkCount, `row ${i} must be exactly one of linked or 준비 중`).toBe(1);
      if (linkCount === 1) {
        linkedCount += 1;
        await expect(row.locator('a')).toHaveAttribute('href', new RegExp(`^${koPath('/blog')}/`));
      }
    }
    await expect(
      page.getByText(`전체 ${rowCount}편 중 ${linkedCount}편을 읽을 수 있습니다.`),
    ).toBeVisible();

    const article = section.getByRole('link', {
      name: new RegExp(escapeRegExp(ARTICLE_RECORD.title), 'u'),
    });
    await expect(article).toBeVisible();
    await article.click();
    await expect(page).toHaveURL(new RegExp(`${ARTICLE}$`));
  });

  test('offers one anchor per content type with articles and 준비 중 for the rest', async ({
    page,
  }) => {
    await page.goto(koPath('/blog'));
    const nav = page.getByRole('navigation', { name: '콘텐츠 타입' });
    const entries = nav.locator('li');
    expect(await entries.count()).toBe(5);

    for (let i = 0; i < 5; i += 1) {
      const entry = entries.nth(i);
      const link = entry.locator('a');
      if ((await link.count()) === 1) {
        const href = await link.getAttribute('href');
        expect(href).toMatch(/^#/u);
        // The anchor lands on a section that exists and names the type.
        await expect(page.locator(`[id="${href?.slice(1)}"]`)).toHaveCount(1);
      } else {
        await expect(entry.getByText('준비 중', { exact: true })).toBeVisible();
      }
    }
  });

  test('is a magazine, not a card wall: a featured article, varied sections, no image files', async ({
    page,
  }) => {
    await page.goto(koPath('/blog'));
    // One featured article, published, with the generated visual (no asset yet).
    const featured = page.locator('[data-featured]');
    await expect(featured).toHaveCount(1);
    await expect(featured.locator('a').first()).toHaveAttribute(
      'href',
      new RegExp(`^${koPath('/blog')}/`),
    );
    await expect(featured.locator('[data-source="fallback"]')).toHaveCount(1);

    // Sections in declared type order, each holding only its own type.
    const sections = page.locator('[data-section]');
    const count = await sections.count();
    expect(count).toBeGreaterThan(1);
    const layouts = new Set<string>();
    for (let i = 0; i < count; i += 1) {
      const section = sections.nth(i);
      const list = section.locator('ol').first();
      layouts.add((await list.getAttribute('class')) ?? '');
      expect(await section.locator('li').count()).toBeGreaterThan(0);
    }
    expect(layouts.size, 'sections use more than one layout').toBeGreaterThan(1);

    expect(await page.locator('main img').count()).toBe(0);
    for (const ext of ['png', 'jpg', 'webp']) {
      expect(await page.locator(`main [src*=".${ext}"]`).count(), ext).toBe(0);
    }
  });

  test('never features an invented story: with no story published, the story section is absent', async ({
    page,
  }) => {
    await page.goto(koPath('/blog'));
    const storySection = page.locator('[data-section="hand-story"]');
    const stories = await storySection.locator('li').count();
    if (stories === 0) {
      await expect(storySection).toHaveCount(0);
      await expect(page.getByRole('region', { name: '준비 중인 시리즈' })).toContainText(
        '핸드 스토리',
      );
      // The featured slot then holds a search guide.
      await expect(page.locator('[data-featured]')).toContainText('검색 가이드');
    } else {
      await expect(page.locator('[data-featured]')).toContainText('핸드 스토리');
    }
  });

  test('claims no order it cannot support', async ({ page }) => {
    await page.goto(koPath('/blog'));
    const text = await visibleBodyText(page);
    for (const claim of ['최신순', '인기순', '인기 글', '많이 읽은', '새 글', '신규', '트렌딩']) {
      expect(text, claim).not.toContain(claim);
    }
    expect(text).toContain('순서는 순위가 아닙니다');
  });

  test('publishes a truthful CollectionPage: the ItemList is the published index, in first-render order', async ({
    page,
  }) => {
    await page.goto(koPath('/blog'));
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const collection = blocks
      .map(
        (block) =>
          JSON.parse(block) as {
            '@type'?: string;
            mainEntity?: { itemListElement?: { name: string; url: string }[] };
          },
      )
      .find((block) => block['@type'] === 'CollectionPage');
    expect(collection).toBeDefined();
    const rows = collection?.mainEntity?.itemListElement ?? [];
    const names = rows.map((item) => item.name);
    const linked = await page
      .getByRole('region', { name: '전체 글' })
      .locator('li a')
      .allTextContents();
    // Same members as the 전체 글 index, each exactly once …
    expect([...names].sort()).toEqual(linked.map((name) => name.trim()).sort());
    // … in the order the page first links them (featured, 이어서 읽기, sections).
    const declared = rows.map((item) => new URL(item.url).pathname);
    const wanted = new Set(declared);
    const onPage = await page
      .locator('main a[href]')
      .evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href') ?? ''));
    expect([...new Set(onPage.filter((href) => wanted.has(href)))]).toEqual(declared);
  });

  for (const width of [320, 360, 390, 768, 1440]) {
    test(`the hub has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(koPath('/blog'));
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }
});

test.describe('blog article', () => {
  test('is prerendered — the prose is in the HTML with JavaScript disabled', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(ARTICLE);
    await expect(page.getByRole('heading', { level: 1, name: ARTICLE_RECORD.title })).toBeVisible();
    const prose = await page.locator('main').innerText();
    expect(prose.length).toBeGreaterThan(900);
    expect(prose).toMatch(/\d+\.\d{2}%/);
    await context.close();
  });

  test('states its numbers from the packages, and never says GTO', async ({ page }) => {
    await page.goto(ARTICLE);
    expect(await visibleBodyText(page)).not.toContain('GTO');
  });

  test('opens with the content type, the topic, the reading time and the generated 16:9 visual', async ({
    page,
  }) => {
    await page.goto(ARTICLE);
    const header = page.locator('main header').first();
    await expect(header).toContainText('검색 가이드');
    await expect(header).toContainText('시작 패');
    await expect(header).toContainText(/약 \d+분/u);

    const slot = page.locator('main [data-source="fallback"]').first();
    await expect(slot).toHaveAttribute('data-aspect', '16/9');
    await expect(slot).toHaveAttribute('aria-hidden', 'true');
    const hero = slot.locator('[data-topic]');
    await expect(hero).toHaveAttribute('data-topic', 'starting-hands');
    await expect(hero).toHaveAttribute('data-kind', 'blog');
    expect(await hero.locator('text').count()).toBe(0);
    expect(await page.locator('main img').count()).toBe(0);
  });

  test('keeps the prose at the reading measure and lets figures break out', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(koPath('/blog/outs-nine'));
    const paragraph = page.locator('main article > p').first();
    const paragraphWidth = (await paragraph.boundingBox())?.width ?? 0;
    // 46rem = 736px reading column (D-S3-10).
    expect(paragraphWidth).toBeGreaterThan(700);
    expect(paragraphWidth).toBeLessThanOrEqual(737);
    const figure = page.locator('main article > figure').first();
    await expect(figure).toBeVisible();
    const figureWidth = (await figure.boundingBox())?.width ?? 0;
    expect(figureWidth).toBeGreaterThan(paragraphWidth);
  });

  test('renders a table of contents that lands on the article’s own headings', async ({ page }) => {
    await page.goto(koPath('/blog/outs-nine'));
    const toc = page.getByRole('navigation', { name: '목차' });
    await expect(toc).toBeVisible();
    const links = toc.locator('a');
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < count; i += 1) {
      const href = await links.nth(i).getAttribute('href');
      expect(href).toMatch(/^#/u);
      await expect(page.locator(`h2[id="${href?.slice(1)}"]`)).toHaveCount(1);
    }
  });

  test('closes with the D-S3-16 relation labels, a tool band and next read — never "관련 글"', async ({
    page,
  }) => {
    await page.goto(ARTICLE);
    const text = await visibleBodyText(page);
    expect(text).not.toContain('관련 글');
    expect(text).not.toContain('관련 콘텐츠');
    const footer = page.getByRole('complementary', { name: '여기까지 읽었다면' });
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('직접 확인하기');
    await expect(footer).toContainText('같이 알아둘 용어');
    expect(await footer.getByRole('heading', { level: 3 }).count()).toBeGreaterThan(1);
    await expect(page.getByRole('navigation', { name: '다음으로 읽기' })).toBeVisible();
  });

  test('sets the search title from the record and keeps the h1 as the title', async ({ page }) => {
    await page.goto(ARTICLE);
    // `<title>` is `seoTitleOf(record)` (seoTitle ?? title) + the site name; the H1 stays
    // `title`. Read from the registry so a WP-S3-07 retitle cannot silently stale this case.
    await expect(page).toHaveTitle(`${seoTitleOf(ARTICLE_RECORD)} · 3BetTilt`);
    await expect(page.getByRole('heading', { level: 1, name: ARTICLE_RECORD.title })).toBeVisible();
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    const article = ld
      .map((b) => JSON.parse(b) as Record<string, unknown>)
      .find((b) => b['@type'] === 'Article');
    expect(article?.['articleSection']).toBe('검색 가이드');
    expect(article?.['datePublished']).toBeUndefined();
    expect(article?.['author']).toEqual(expect.objectContaining({ '@type': 'Organization' }));
  });

  test('a seoTitle, where a record has one, is the <title> and never the h1', async ({ page }) => {
    // Every published record that declares a seoTitle different from its H1 — sample up to
    // three, one per content type where possible, so the case stays cheap as WP-S3-07/08
    // add seoTitles to more articles.
    const withSeo = BLOG_RECORDS.filter(
      (record) =>
        record.status === 'PUBLISHED' &&
        record.seoTitle !== undefined &&
        record.seoTitle !== record.title,
    );
    expect(withSeo.length, 'at least one record declares a distinct seoTitle').toBeGreaterThan(0);
    const seenTypes = new Set<string>();
    const sample = withSeo.filter((record) => {
      if (seenTypes.has(record.contentType) || seenTypes.size >= 3) return false;
      seenTypes.add(record.contentType);
      return true;
    });
    for (const record of sample) {
      await page.goto(koPath(`/blog/${record.slug}`));
      await expect(page).toHaveTitle(`${record.seoTitle} · 3BetTilt`);
      await expect(page.getByRole('heading', { level: 1, name: record.title })).toBeVisible();
      expect(await page.getByRole('heading', { level: 1 }).allTextContents()).not.toContain(
        record.seoTitle,
      );
    }
  });

  for (const [slug, caption] of [
    ['/blog/outs-nine', '아웃츠 9장'],
    ['/blog/pot-odds-quick', '최종 팟'],
    ['/blog/why-use-range', '표로 본 것'],
  ] as const) {
    test(`${slug} carries a captioned figure whose numbers come from the packages`, async ({
      page,
    }) => {
      await page.goto(koPath(slug));
      const figure = page.locator('main figure');
      await expect(figure.first()).toBeVisible();
      await expect(figure.first().locator('figcaption')).toContainText(caption);
      expect(await page.locator('main img').count()).toBe(0);
    });
  }

  test('the outs figure draws the domain’s own unseen-card count', async ({ page }) => {
    await page.goto(koPath('/blog/outs-nine'));
    const figure = page.locator('main figure').first();
    expect(await figure.locator('svg rect').count()).toBe(47);
    await expect(figure).toContainText('아웃츠 9장');
    await expect(figure).toContainText('아직 보이지 않는 카드 47장');
  });

  test('an unknown blog slug 404s rather than rendering an empty article', async ({ page }) => {
    const response = await page.goto(koPath('/blog/not-a-real-article'));
    expect(response?.status()).toBe(404);
  });

  for (const width of [320, 360, 390, 768, 1440]) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(ARTICLE);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }
});
