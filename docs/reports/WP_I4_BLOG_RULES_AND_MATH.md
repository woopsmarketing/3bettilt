# WP-I4 — Blog Batch 4: 규칙 · 용어 · 계산

## 1. Scope

Wrote the five prose articles for blog batch I4 (`docs/FISHTILT_CONTENT_PLAN.md` §7 "I4",
§2.2 rows 16–20): `blog-why-blinds-exist`, `blog-why-called-3bet`, `blog-why-use-range`,
`blog-pot-odds-quick`, and `blog-outs-nine` (I4's proof record — replaced the empty
`PLANNED` seed, kept its id/slug/title). Flipped all five records `PLANNED` → `PUBLISHED`,
registered MDX, added one batch test file. Read all four lessons this batch sits beside
(`outs`, `pot-odds`, `poker-range`, `three-bet`) before writing, per the duplication
constraint. No file outside the stated boundary was touched.

## 2. Files changed

| File | What |
| --- | --- |
| `apps/fishtilt/content/blog/why-blinds-exist.mdx` | NEW |
| `apps/fishtilt/content/blog/why-called-3bet.mdx` | NEW |
| `apps/fishtilt/content/blog/why-use-range.mdx` | NEW |
| `apps/fishtilt/content/blog/pot-odds-quick.mdx` | NEW |
| `apps/fishtilt/content/blog/outs-nine.mdx` | NEW (replaces the empty seed) |
| `apps/fishtilt/src/content/blog/i4.ts` | Registered all five MDX imports (was `{}`) |
| `apps/fishtilt/src/content/registry/blog/i4.ts` | Five records: `PLANNED`→`PUBLISHED`, `indexable: true`, `readMinutes: 3`; fixed `blog-outs-nine`'s empty `relatedConcepts` to `['term-outs']` (see §9) |
| `apps/fishtilt/src/content/registry/blog/i4.test.ts` | NEW — this batch's gate (29 tests) |
| `docs/reports/WP_I4_BLOG_RULES_AND_MATH.md` | This report |

Nothing in `src/app/**`, `src/components/**`, `allowList.ts`, `facts.ts`, `types.ts`,
`graph.ts`, `content.test.ts`, `routes.ts`, or another batch's registry/MDX file was edited.

## 3. Article table

| id | question | answer in one line | facts cited | outbound links |
| --- | --- | --- | --- | --- |
| `blog-why-blinds-exist` | Big Blind는 왜 돈을 먼저 내나? | 아무도 강제로 걸지 않으면 걸고 다툴 돈 자체가 없어 아무도 먼저 나설 이유가 없기 때문 | none (rule 16: 숫자 없음) | `term-blind`, `term-big-blind`; → `holdem-basics`, `positions-6max`; CTA `range` |
| `blog-why-called-3bet` | 왜 3-Bet이라고 부를까? | BB 강제 납부=1번째, 오픈 레이즈=2번째, 그 다음 리레이즈=3번째이기 때문 (ruling 18) | none | `term-three-bet`; → `three-bet`; CTA `range` |
| `blog-why-use-range` | Range를 보는 이유 | 상대 패 하나를 찍으면 거의 틀리고, 자리별로 가능한 패의 폭 자체가 다르기 때문 | `RFI_COMBOS`×2, `RFI_PERCENT`×2 (UTG, BTN) | `term-range`; → `poker-range`; CTA `range` |
| `blog-pot-odds-quick` | 팟오즈 쉽게 계산하기 | 벳÷최종팟이 답이고, 비율만 같으면 실제 액수와 무관하게 같은 숫자가 나온다 | `POT_ODDS_REQUIRED_EQUITY` ×5 args | `term-pot-odds`; → `pot-odds`; CTA `toolPotOdds` (deep-link params) |
| `blog-outs-nine` | 아웃츠로 확률 계산하기 (9장) | 9아웃 플러시 드로우가 리버까지 완성될 확률은 `<Fact>`가 답하고, 팟오즈와 나란히 놓으면 손익분기점 통과 여부를 바로 확인할 수 있다 | `OUTS_PROB`×4 args, `POT_ODDS_REQUIRED_EQUITY`×1 arg | `term-outs`; → `outs`; CTA `toolOuts` |

All five: `available:true` routes only (`range`, `toolPotOdds`, `toolOuts` checked against
`src/lib/routes.ts`), zero `GTO`, zero profitability/strength verdicts, zero unconditioned
"항상/무조건/반드시 ~해야 합니다" — asserted by the batch test, not just by eye.

## 4. Anti-duplication statement (#18/#19/#20)

| id | What the lesson owns | What THIS article adds that the lesson does not |
| --- | --- | --- |
| `blog-why-use-range` (#18) | `poker-range.mdx` teaches what a range IS: the 13×13 grid, cell types (pair/suited/offsuit), combo counts per cell, `AKs` example, `K9s`/`K9o` RFI_POSITIONS_WITH comparison. | This article never explains the grid. It answers one narrow question — "why bother grouping at all" — via a fact pair the lesson never cites (`RFI_COMBOS`/`RFI_PERCENT` for UTG vs BTN), showing the *aggregate range size itself* swings by position, which is the concrete evidence for "guessing one hand is wrong." Ends on "왜 자리마다 폭이 다른가" deferred explicitly, unanswered. |
| `blog-pot-odds-quick` (#19) | `pot-odds.mdx` derives what pot odds MEASURE (why the call amount is divided by the *final* pot, worked once at 10\|5 and 9\|3, plus an equity comparison). | This article never re-derives the concept. It is a repeatable procedure for three bet-size ratios (half/two-thirds/full pot) computed at pot=6, plus the *scale-invariance* fact — same ratio at pot=9 gives the identical number (`6|4` and `9|6` both render `28.57%`, asserted by the batch test) — which the lesson never states. |
| `blog-outs-nine` (#20) | `outs.mdx` derives the count itself (13-2-2 counting, why 47/46 unseen cards) using the SAME 9-out flush-draw scenario, with FLOP\|NEXT, FLOP\|RIVER, TURN\|NEXT and the 4-out gutshot comparison already shown. | This article deliberately omits the FLOP\|NEXT/TURN\|NEXT breakdown (asserted by the test: neither arg string appears) and never re-derives the count. Its new content is the synthesis the lesson explicitly foreshadows but never computes: citing `OUTS_PROB(9|FLOP|RIVER)` beside `POT_ODDS_REQUIRED_EQUITY(9|3)` to show the draw alone clears break-even — arithmetic neither article does elsewhere — with an explicit equity-vs-outs-probability caveat. |

All three carry the exact §2.3 hand-off sentence verbatim (bracket placeholder filled with
the real lesson reference), asserted character-for-character by
`i4.test.ts`'s "anti-duplication" describe block.

Additional note (not one of the mandatory three, but same risk): `blog-why-called-3bet`
inevitably restates the counting rule itself (that is what answers the question, and ruling
18 requires stating it plainly), but omits every other lesson component — no BB-dollar
walkthrough (1BB/3BB/9BB/27BB), no 4-Bet/5-Bet extension, no quiz, no "does position matter"
FAQ — and uses a distinct ordinal-only illustration (no invented BB amounts) rather than the
lesson's own worked numbers.

## 5. Worked examples — arithmetic checks

All values below were computed by calling the real `potOdds`/`outsOdds` from
`@gto-self/learn-core` inside `i4.test.ts`'s "worked examples" describe block (not reasoned
by hand), and cross-checked against `factValue()` itself. `pnpm vitest run` output: **4/4
pass** in that block.

| Fact cited | Formula | Computed | Article |
| --- | --- | --- | --- |
| `POT_ODDS_REQUIRED_EQUITY("6\|3")` | `bet/(pot+2·bet)` = `3/12` | `25.00%` | pot-odds-quick |
| `POT_ODDS_REQUIRED_EQUITY("6\|4")` | `4/14` | `28.57%` | pot-odds-quick |
| `POT_ODDS_REQUIRED_EQUITY("6\|6")` | `6/18` | `33.33%` | pot-odds-quick |
| `POT_ODDS_REQUIRED_EQUITY("9\|6")` | `6/21` | `28.57%` (matches `6\|4` — same ratio 2/3) | pot-odds-quick |
| `POT_ODDS_REQUIRED_EQUITY("9\|3")` | `3/15` | `20.00%` | outs-nine |
| `OUTS_PROB("9\|FLOP\|RIVER")` | `1 − (38·37)/(47·46)` | `34.97%` | outs-nine |
| `OUTS_PROB("9\|FLOP\|SHORTCUT_RIVER")` | `9×4%` | `36.00%` | outs-nine |
| synthesis | `34.97% > 20.00%` | draw alone clears break-even | outs-nine |

## 6. How the shortcut is presented

`outs-nine` states, quoted: *"흔히 쓰는 \"아웃 × 4\" 규칙으로 어림잡으면 36.00%가 나옵니다.
정확한 34.97%보다 살짝 높습니다. 다만 이 오차가 항상 같은 방향으로 어긋나는 것은 아닙니다.
아웃 개수가 다르면 규칙이 반대로 실제보다 낮게 나오는 경우도 있고, 그 예시(아웃 4장)는
아웃츠 레슨에 있습니다."* — states the 9-out direction (shortcut high) as specific to this
count, explicitly disclaims a fixed direction, and points to the lesson's own 4-out case
(16.00% shortcut vs 16.47% exact — shortcut low) rather than re-deriving it. Test
`the shortcut's error does NOT have a fixed direction` asserts
`byRiverError(9 outs) > 0` and `byRiverError(4 outs) < 0` against the real engine.

## 7. Facts wanted and not available

None. `RFI_COMBOS`/`RFI_PERCENT`, `POT_ODDS_REQUIRED_EQUITY`, and `OUTS_PROB` (including its
`SHORTCUT_NEXT`/`SHORTCUT_RIVER` targets) all already existed per WP-G3B — nothing in this
batch was blocked on missing fact infrastructure.

## 8. Tests run

| Command | Result |
| --- | --- |
| `pnpm vitest run --project fishtilt src/content/registry/blog/i4.test.ts` | **29/29 passed** |
| `pnpm vitest run --project fishtilt` (whole app) | **930/931 passed, 1 failed** — `src/app/blog/page.test.tsx` (untracked, not authored or touched by this WP; outside the `src/app/**` boundary). Its `getAllByText('준비 중')` throws because it finds **zero** matches: my batch was the last of the 20 blog articles to leave `PLANNED`, so no blog record is `PLANNED` any more and the page renders no "준비 중" badge at all. `getAllByText` throws on zero matches instead of returning `[]` — the same shape as rulings 21/26/31/34/40 (a test's "still-unbuilt" fixture assumption expiring the day the batch it depends on finishes). Confirmed via `git status --porcelain` that both the test and `page.tsx` are untracked and not mine, and via a registry grep that zero `PLANNED` blog records remain across i1–i4. Not fixed — outside this WP's file boundary (`src/app/**` is explicitly off-limits); flagging for the orchestrator, matching ruling 34's precedent. |
| `pnpm typecheck` (all 13 workspace packages) | PASS, no errors |
| `npx eslint apps/fishtilt --max-warnings=0` | PASS, no output |

## 9. Known limitations

- `blog-outs-nine`'s WP-G4 seed registered `relatedConcepts: []`, an unconditional block on
  `indexable: true` under `threshold.ts` (`minConcepts: 1`) that no amount of prose could
  fix. Corrected to `['term-outs']`, with a matching `<Term id="term-outs">` used once in the
  article — a substantive registry fix within the exact record I own, not a cosmetic one
  (CLAUDE.md rule 7 / ruling 12 precedent).
- `ToolCTA`'s `params` prop DOES encode a real query string (`toolHref` uses
  `URLSearchParams`), but the destination tool pages do not read it yet (orchestrator
  ruling, `docs/FISHTILT_STATE.md` "handed-back items" #2). `pot-odds-quick` and
  `why-use-range` pass `params` anyway, matching the precedent already set by
  `pot-odds.mdx`/`poker-range.mdx` — reporting this gap, not building the read side.
  `outs-nine`/`why-blinds-exist`/`why-called-3bet` do not pass params since nothing in their
  copy names a single canonical input worth prefilling.
- `blog-why-called-3bet` carries residual thematic overlap with its lesson beyond what §2.3
  formally requires (it is not one of the three named duplication pairs) — see §4's
  additional note. Judged acceptable because the shared content is exactly what ruling 18
  requires stated plainly, and everything else (dollar walkthrough, 4-Bet extension, quiz,
  position FAQ) is lesson-exclusive.
- MDX is not render-tested under vitest in this repo (`docs/reports/WP_QA_MDX_TEST_GAP.md`);
  `i4.test.ts` statically verifies every `<Fact>`/`<Term>`/`<PokerCards>`/relation instead,
  same pattern as `i2.test.ts`. The real render gate is `pnpm build:fishtilt`, held by the
  orchestrator per instruction — not run here.
