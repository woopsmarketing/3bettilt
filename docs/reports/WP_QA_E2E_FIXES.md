# WP QA — FishTilt E2E Test Fixes

Fix agent for the 7 known-bad-test failures in `pnpm e2e:fishtilt` (baseline 112/119).
Scope: `apps/fishtilt/tests/e2e/{equity,glossary,hands}.spec.ts` only. No source or content
files touched.

## 1. The seven failures — root cause

| # | File | Root cause |
|---|------|------------|
| 1-5 | `equity.spec.ts` | `page.getByText('정확 계산')` (default substring match) matches both the method-label `<p>` ("정확 계산") and the unrelated explanation heading "정확 계산이 무슨 뜻인가요?" — Playwright strict-mode violation, at 5 call sites. |
| 6 | `glossary.spec.ts` | `expect(page.getByRole('link', {name: /같은 무늬 \(Suited\)/})).toHaveCount(0)` asserted one named term was unwritten. WP-J2 published all 58 glossary terms, so `Suited` is now a real link — the ruling-26 "fixture sourced from live product data" trap, 7th occurrence. |
| 7 | `hands.spec.ts` | `expect(page.locator('body')).not.toContainText('항상 레이즈')` is a whole-body substring match. The page's own honesty disclaimer ("이 순위가 뜻하지 않는 것") correctly *denies* "항상 레이즈해야 한다" / profitability, and the naive matcher cannot tell an assertion from its negation — it fired on the page's own honesty. |

## 2. What changed, per file

**`equity.spec.ts`** — all 5 `page.getByText('정확 계산')` call sites changed to
`page.getByText('정확 계산', { exact: true })`. The method label's text is exactly "정확 계산"
with nothing appended (confirmed against `EQUITY_METHOD_LABEL.EXACT` in
`features/tools/equity.ts`); the explanation heading's full string is
"정확 계산이 무슨 뜻인가요?", which `exact: true` no longer matches. Reviewed every other
locator in the file (percent regex, card-picker buttons scoped to their `group`, board-length
messages, reset/swap copy) — none showed the same latent ambiguity; all are either
scoped to a specific `group` locator or textually unique on the page.

**`glossary.spec.ts`** — replaced the single named-term assertion with a rule-based check over
every row in the `전체 용어` region: each `<li>` must be exactly one of "is a link" (linkCount)
or "carries a `준비 중` badge" (badgeCount), never both, never neither
(`expect(badgeCount + linkCount).toBe(1)`), and every link's `href` must start `/glossary/`.
Cross-checked the counted "published" total against the page's own summary sentence
(`전체 N개 중 M개를 읽을 수 있습니다.`) so a bug that miscounts both sides identically can't
hide. This follows the same "assert the rule, not one fixture" pattern as the six prior
ruling-26 fixes, adapted for e2e (no module mock available, so it reads the rendered DOM
instead of an injected `PLANNED` fixture).

**`hands.spec.ts`** — see §3 below.

## 3. Failure 7 — before/after, and why the new assertion still bites

**Before:**
```ts
test('never claims the ranking is a profitability verdict', async ({ page }) => {
  await page.goto(HAND);
  await expect(page.locator('body')).not.toContainText('수익성이 있습니다');
  await expect(page.locator('body')).not.toContainText('항상 레이즈');
});
```

**After:**
```ts
test('never claims the ranking is a profitability verdict', async ({ page }) => {
  await page.goto(HAND);

  const disclaimer = page.locator('aside').filter({ hasText: '이 순위가 뜻하지 않는 것' });
  await expect(disclaimer).toHaveCount(1);
  await expect(disclaimer).toBeVisible();
  await expect(disclaimer).toContainText('항상 레이즈');
  await expect(disclaimer).toContainText('수익성이 있다는 뜻은 아닙니다');

  const outsideDisclaimerText = await page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    for (const script of Array.from(clone.querySelectorAll('script'))) {
      script.remove(); // strip the inlined Next.js RSC flight payload — it duplicates all
    }                    // page copy, disclaimer included, as <script> text
    const target = Array.from(clone.querySelectorAll('aside')).find((el) =>
      (el.textContent ?? '').includes('이 순위가 뜻하지 않는 것'),
    );
    target?.remove();
    return clone.textContent ?? '';
  });
  expect(outsideDisclaimerText).not.toContain('수익성이 있습니다');
  expect(outsideDisclaimerText).not.toContain('항상 레이즈');
});
```

**Why this still catches a page that really did claim profitability:** the forbidden-phrase
check runs against the *entire rendered body except the one disclaimer element* — every other
section (rank sentence, RFI positions, tool CTA, related content, nav) is still fully in
scope. If any of those sections were changed to say "항상 레이즈" or "수익성이 있습니다", the
`not.toContain` assertions still fail exactly as before. What changed is only that the
disclaimer's own honest denial of that claim no longer counts as a violation. The test also
now asserts the disclaimer itself is present and really contains both denial phrases
(`toHaveCount(1)`, `toContainText`) — so silently deleting the disclaimer, or watering it down
to no longer deny the claim, is now also a caught regression, which the original whole-body
form never checked for at all.

One implementation subtlety worth recording: naively cloning `document.body` and removing only
the `<aside>` was not enough — Next.js inlines the full RSC flight payload as `<script>` text
for hydration, and that payload is a serialized copy of the *entire* page's rendered text,
disclaimer included. `Element.textContent` walks into `<script>` text nodes, so the forbidden
phrase leaked back in through the script tag even after the visible `<aside>` was removed. Fix:
strip all `<script>` elements from the clone before reading `textContent`.

## 4. Other latent fragility found (not touched — outside file boundary or already covered)

- **`hands.spec.ts:20`** (`lists every hand, links only what is written`) has the exact same
  ruling-26 shape as glossary failure 6: `expect(page.getByRole('link', {name: /^AKo$/})).toHaveCount(0)`
  asserts `AKo` is unpublished. Checked the registry (`src/content/registry/hands/e3.ts`):
  `hand-ako` is still `PLANNED`, so this passes today — not one of the 7 failures, and this
  agent's mandate only covered failure 7 in this file, so left as-is. **Recommend the same
  rule-based rewrite applied to `glossary.spec.ts` §2 be applied here before `AKo` publishes.**
- **`learn.spec.ts:28`** — same trap, but already live: `poker-hand-rankings`
  (title "어떤 족보가 더 강할까요?") was published to `PUBLISHED` in
  `src/content/registry/learn/h1.ts` during this session by a concurrent content agent, and
  `learn.spec.ts` now fails the same way glossary failure 6 did. Confirmed stable across 3
  re-runs (not mid-flight). **Out of this agent's file boundary — reported, not fixed.**
- **`src/app/tools/equity/page.test.tsx`** (unit test) — `links to the equity lesson honestly
  — inert, since it is not written yet` is now failing in the same shape; the `equity` lesson
  content record has apparently moved off `PLANNED` concurrently. Also out of boundary.
- **`src/content/content.test.ts`** and **`src/content/registry/learn/h3.test.ts`** — 3
  additional unit failures, all content-length/reading-time threshold checks on the learn
  batch H3 registry (`src/content/registry/learn/h3.ts`), which per the task brief is a
  content agent's file actively being authored concurrently. Not touched.

## 5. Gate results

| Gate | Result |
|---|---|
| `pnpm e2e:fishtilt` | **119 passed / 1 failed** (target files: 0 failing — all 7 assigned failures fixed). Remaining failure is `learn.spec.ts:19` (see §4), outside this agent's file boundary, root-caused to a concurrent content publish, confirmed stable across 3 re-runs. |
| `pnpm vitest run --project fishtilt` | **825 passed / 5 failed** (≥ 808 floor). All 5 failures are in files outside this agent's boundary (`src/content/content.test.ts`, `src/content/registry/learn/h3.test.ts`, `src/app/tools/equity/page.test.tsx`) and trace to concurrent content-agent work (see §4), not to any change made here. |
| `npx eslint apps/fishtilt --max-warnings=0` | **Clean**, 0 errors/warnings. |

No assertion was deleted, skipped, weakened, or left vacuous. Every replaced assertion checks
a strictly equal-or-broader rule than the one it replaced (glossary: rule holds for all 58 rows,
not just the one that used to be checked; hands: forbidden phrase still checked over the whole
page minus one named, verified-present element).
