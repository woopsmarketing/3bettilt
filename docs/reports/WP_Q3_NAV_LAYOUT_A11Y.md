# WP-Q3 — navigation, IA, layout, a11y

Owner: WP-Q3 (interrupted by a rate limit) + WP-Q3b (this run, finishing and reporting).
Scope: P2 findings M1 (homepage half), M4, M8, M11, M12, M13; P1 F4 on `hands/[hand]/page.tsx`;
`docs/FISHTILT_STATE.md` ruling 85 / ruling 99.

**Result: every item on the worklist is fixed. One defect was found in the fix round's own
unrun e2e test and repaired.** `pnpm vitest run --project fishtilt` → **117 files, 1344 tests,
all passing** (baseline 1344, unchanged).

---

## 1. Disposition, item by item

| # | Item | State | File |
| --- | --- | --- | --- |
| M1 | homepage primary CTA | **fixed** (verified) | `src/app/page.tsx:166-167` — `처음부터 배우기` primary, `13×13 핸드레인지 보기` secondary |
| M4 | `/glossary` sorted by English term | **fixed** (verified) | `src/app/glossary/page.tsx:31` — `a.title.localeCompare(b.title, 'ko')`; pinned by `page.test.tsx:95` and `tests/e2e/glossary.spec.ts` |
| M8 | result unreachable while picking, `/tools/hand-checker` | **fixed** (verified by measurement) | `src/components/HandChecker.tsx:159-170` |
| M8 | result unreachable while picking, `/tools/equity` | **fixed** (verified by measurement) | `src/components/EquityCalculator.tsx:228-245` |
| M11 | `/about` reachable from no page | **fixed** (verified) | `src/components/SiteFooter.tsx` via `footerNavRoutes()` |
| M12 | header search disabled; `/blog`,`/hands`,`/about` in no nav | **fixed** (verified) | `src/components/SiteHeader.tsx:86-104` (registry-driven; live branch renders a real link, the `disabled` branch survives as the honest fallback), `SiteFooter.tsx`, `src/lib/routes.ts:100-103` |
| M13 | `/hands/*` renders the article before the computed sections | **fixed** (verified) | new `src/app/hands/[hand]/leadSplit.ts` + `page.tsx:137,154,227` |
| F4 | `hands/[hand]` describes equity as P(win) | **fixed** (verified) | `page.tsx:193-211` |
| ruling 85 | card suits announce in English | **fixed** (verified) | `src/components/PokerCard.tsx`, `CardPicker.tsx`, `HandChecker.tsx:73` |
| — | `text-500` on the breadcrumb separator | **not changed, deliberately** | see §5 |

The brief for this run described M8's equity half and M13 as still open. They were not: WP-Q3
had landed both before it was killed. Each was re-verified against source and, for M8, against
real browser measurements — not taken on trust.

### M8 — how the fix works, and how it was verified

Both calculators put 결과 **first in the DOM** (so tab order and a screen reader read the same
page a sighted reader sees), `sticky top-0 z-10 lg:static`, with the result body height-capped
at `max-h-[36svh]` and `tabIndex={0}` below `lg` so the capped region is reachable by keyboard.
`EquityCalculator` additionally puts each side's cards inline beside its label rather than
stacked, which is what keeps the stuck panel short enough to share the screen.

Verified per the VISUAL QA rule with **element bounding boxes in a real Chromium at 375×667**,
never from a screenshot. The real components (real Tailwind build, real engine) were mounted in
a throwaway Vite harness — the Next dev server and `.next` were left untouched, per the
concurrency instruction. Measured, with the page scrolled to the deepest card of the last
picker:

| surface | scrollY | doc height | result panel | answer on screen |
| --- | --- | --- | --- | --- |
| `/tools/equity` | 2013 | 4085 | pinned at `top: 0`, 338px of 667px visible | `내 핸드 승률 86.3%` visible |
| `/tools/hand-checker` | 1565 | 3269 | pinned at `top: 0`, 338px of 667px visible | `에이스와 킹 투페어` visible |

Clicks land on the cards, not on the stuck panel: `aria-pressed` flipped to `true` on every tap.

### M13 / F4 — `hands/[hand]/page.tsx`

`splitAfterLead` splits the compiled MDX after its first block element, so §4.2's one-line answer
stays at position 2 and the author's discussion moves to after section 6. No MDX file changed and
no authoring convention was introduced; a non-fragment article degrades to "all lead", which is
exactly what the page rendered before.

F4: section 5 now states the figure as `팟에서 가져갈 것으로 기대되는 몫` with
`정확히 비기는 경우는 절반만 이긴 것으로 계산에 들어갑니다.` and a link to the 승률(Equity)
lesson. This is the canonical phrasing already in `content/learn/equity.mdx` and
`src/features/strength/copy.ts` — reused verbatim in spirit, not a third variant. Per D1, 승률 is
still the friendly label; nothing on this page asserts P(win). Grep for `이기는 비율` /
`이길 확률` / `를 이깁니다` across the WP-Q3 file set returns nothing. No numeric literal entered
prose (D4); every figure is still a `<Fact>`. The `이 순위가 뜻하지 않는 것` Callout is intact
(D5).

### Ruling 85 — Korean card names

`SUIT_KOREAN` and `cardAccessibleName(rank, suit)` (`무늬 랭크`, e.g. `스페이드 A`) live in
`PokerCard.tsx` and are the single spelling used by the card itself, by `CardPicker`'s buttons
and by `HandChecker`'s 사용됨/사용 안 됨 chips. The drawn glyph is unchanged; only the accessible
name changed. `PokerCard` inside an interactive control renders `decorative` (`aria-hidden`) so
nothing double-announces.

---

## 2. The one thing that was actually broken: the M8 e2e test

`tests/e2e/responsive-a11y.spec.ts` — WP-Q3 wrote the M8 test but never ran it (the suite needs a
production build). It had two defects, both found by replaying it against the real components in
a browser:

1. **It could not pass.** It held one locator, `{ name: '클럽 2 선택', exact: true }`, across the
   click. A `CardPicker` button renames itself on selection, so after the click that locator
   matches nothing and `expect(card).toHaveAttribute('aria-pressed', 'true')` times out.
2. **It had no teeth.** It tapped only the last row of the **last** picker. Replayed against the
   shipped defect (result *below* the pickers) that case **passes** — the answer happens to sit
   just under the card you tapped. A test that passes before and after the fix asserts nothing.

Rewritten. It now walks **every picker on the page** in DOM order, scrolls that picker's deepest
card into view, and asserts the panel *and the answer inside it* are in the viewport; then taps
cards for real in the last picker and re-asserts. Each surface's taps leave a **computable**
selection (a 1-card board on `/tools/equity` is deliberately blocked, and an
`아직 계산할 수 없습니다` panel would satisfy a panel-only assertion while proving nothing), and
the answer locator is scoped inside the result panel.

Discrimination proved by replay at 375×667 against the real components:

| layout | `/tools/equity` | `/tools/hand-checker` |
| --- | --- | --- |
| current (fixed) | PASS | PASS |
| the shipped defect — result below the pickers | **FAIL** (panel and answer off-screen from the hero and villain pickers) | **FAIL** (off-screen from the hole picker) |
| regression — result first but `sticky` removed | **FAIL** (off-screen from all three pickers) | **FAIL** (off-screen from both) |

**This test has not been run by the real suite** (`pnpm e2e:fishtilt` is MASTER's, per the
brief). It typechecks clean in isolation and every assertion in its body was executed against the
real components in a real browser; what is unproven is only the surrounding Next route, whose
extra prose lengthens the scroll and can only strengthen the case.

---

## 3. Every e2e locator changed, and why the assertion survives

Only `tests/e2e/responsive-a11y.spec.ts` was edited this run. Nothing was deleted, skipped or
narrowed.

| change | why the assertion is preserved or stronger |
| --- | --- |
| post-click assertion re-locates `{ name: '클럽 2 선택됨', exact: true }` instead of reusing the pre-click locator | Same assertion — "the tap landed on the card, not on the panel stuck over it" — expressed against the name the button actually has after the tap. The old form could only time out. |
| one tap in the last picker → a loop over **every** picker, plus the taps | Strictly added coverage. The original case is still executed; two failure modes it could not see now fail the test. |
| `toBeInViewport()` on the panel → on the panel **and** the answer element inside it | Strictly stronger: the panel's border being on screen was never the requirement. |
| answer locator scoped to the result panel (`result.getByText(...)`) rather than the page | Narrower *locator*, identical claim — it removes the chance of matching a percentage in the page's explanation prose instead of the tool's own output. |

The ruling-85 locator churn (~20 across `equity.spec.ts`, `hand-checker.spec.ts`,
`responsive-a11y.spec.ts` and the colocated component tests) was already done by WP-Q3 and was
re-read this run: every one is a `A♠`→`스페이드 A` substitution inside `getByRole('button', {
name })`, with the role, the state word (`선택`/`선택됨`/`사용됨`), the `toBeDisabled()` and the
`aria-pressed` checks untouched. No assertion was weakened to accommodate the rename.

---

## 4. Verification run

- `pnpm vitest run --project fishtilt` → **117 files / 1344 tests passing**, equal to the
  pre-existing baseline.
- `tsc --noEmit` on the edited spec in isolation → clean.
- M8 measured in Chromium at 375×667 against the real components (bounding boxes and scroll
  offsets, per §41).
- Not run, per the brief: `build:fishtilt`, `e2e:fishtilt`, `typecheck`, `lint`, `verify`.

---

## 5. Left for someone else

- **`text-500` on the breadcrumb separator — not changed, and I do not think it is a defect.**
  `src/app/globals.css`'s own token rule lists **decorative glyphs** as a sanctioned use of
  `--color-text-500`, and the `›` in `Breadcrumbs.tsx:43` is `aria-hidden` punctuation whose
  meaning is carried by the `<ol>`. Changing it would also touch a file outside this WP's
  boundary for a non-defect. MASTER's call if it should change anyway.
- **`src/app/hands/[hand]/page.tsx` has no colocated unit test.** M13's section order and F4's
  wording are pinned only by `tests/e2e/hands.spec.ts`, which this run could not execute. If the
  e2e gate is deferred, those two are unguarded in the fast gate.
- **`PokerCard.tsx` / `PokerCard.test.tsx` carry the ruling-85 change** and appear in neither
  Q3's nor Q2b's declared boundary. They were unowned, so there is no conflict — recording it so
  the ownership table can be corrected rather than the fix being read as an out-of-boundary edit.
- **Residual risk.** The M8 e2e test taps `클럽 2/3/4`, which assumes those cards are free in the
  default selection on both tools. They are today (equity opens on AA vs KK with an empty board;
  the hand checker opens on `A♠ K♣ 9♥`). If either default changes to include a club deuce, this
  test needs a different card, not a weaker assertion.
