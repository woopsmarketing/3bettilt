# WP-I2 — Blog Batch 2: 패의 종류와 무늬

## 1. Scope

Five blog answers, `docs/FISHTILT_CONTENT_PLAN.md` §2.2 "I2": `blog-small-pocket-pairs`,
`blog-why-72o-is-weak`, `blog-why-suited-matters`, `blog-flush-vs-straight`,
`blog-full-house-vs-flush`. No pre-existing proof record in this batch — all five registry
records started `PLANNED` (from WP-G4) and all five are now `PUBLISHED`.

This run resumes after a mid-task session termination (rate limit). All five MDX files,
the MDX map, and the registry flips were already on disk and correct; this pass re-verified
everything from scratch rather than trusting the prior state (per the coordinator's
instruction), fixed two structural problems in the batch's own test file (a vacuous
`|| true` assertion and a dead-code lookup), and produced the evaluator output and this
report, which did not survive the earlier termination.

## 2. Files changed

| File | What |
| --- | --- |
| `apps/fishtilt/content/blog/small-pocket-pairs.mdx` | New article |
| `apps/fishtilt/content/blog/why-72o-is-weak.mdx` | New article |
| `apps/fishtilt/content/blog/why-suited-matters.mdx` | New article |
| `apps/fishtilt/content/blog/flush-vs-straight.mdx` | New article |
| `apps/fishtilt/content/blog/full-house-vs-flush.mdx` | New article |
| `apps/fishtilt/src/content/blog/i2.ts` | MDX map — five entries, one per slug above |
| `apps/fishtilt/src/content/registry/blog/i2.ts` | Five records flipped `PLANNED` → `PUBLISHED`, `indexable: true`, `readMinutes: 3`; doc comment updated. No `id`/`slug`/relation field touched. |
| `apps/fishtilt/src/content/registry/blog/i2.test.ts` | New batch test file (20 tests) |
| `docs/reports/WP_I2_BLOG_HAND_TYPES.md` | This report |

Nothing outside this list was touched. `apps/fishtilt/` is untracked in this repository's
git history (the whole FishTilt tree is uncommitted work-in-progress), so `git status` shows
these as new files, not diffs — expected, not a boundary violation.

## 3. Article table

| id | question | answer (one line) | facts cited | outbound links |
| --- | --- | --- | --- | --- |
| `blog-small-pocket-pairs` | 작은 포켓페어는 좋은 패일까? | "좋다/나쁘다"는 이 자료로 답할 수 없지만, 22·55의 순위·상위%·승률·조합 수·RFI 위치는 정확한 수치로 보여준다 | `HAND_RANK`, `HAND_TOP_SHARE`, `HAND_EQUITY_VS_RANDOM` (22, 55), `COMBOS_OF_KIND` (PAIR/SUITED/OFFSUIT), `RFI_POSITIONS_WITH` (22) | tool: `toolStartingHand` · next: `starting-hands`, `starting-hand-ranking` · concept: `term-pocket-pair` · hand: `hand-22` |
| `blog-why-72o-is-weak` | 72o가 약한 이유 | 169가지 중 실제 등수·상위%·승률을 보여주고, 통념과 달리 진짜 꼴찌는 72o가 아님을 데이터로 확인 | `HAND_RANK`, `HAND_TOP_SHARE`, `HAND_EQUITY_VS_RANDOM`, `HAND_COMBOS` (72o), `HAND_AT_RANK` (169), `RFI_POSITIONS_WITH` (72o) | tool: `toolStartingHand` · next: `starting-hand-ranking`, `hand-rankings` · concept: `term-hand-ranking` |
| `blog-why-suited-matters` | suited hand가 좋은 이유 | 무늬가 같으면 플러시가 될 가능성이 하나 더 생겨 순위·승률이 조금 앞서지만, 그 차이는 작다 | `HAND_RANK`, `HAND_EQUITY_VS_RANDOM`, `HAND_COMBOS` (J9s/J9o, T8s/T8o) | tool: `toolStartingHand` · next: `starting-hands`, `hand-rankings` · concept: `term-suited` |
| `blog-flush-vs-straight` | 플러시와 스트레이트 중 뭐가 강할까? | 플러시가 강하다 — 스트레이트보다 다섯 장 조합으로서 훨씬 드물게 나오기 때문 | `CATEGORY_FREQUENCY` (FLUSH, STRAIGHT), `CATEGORY_RANK` (FLUSH, STRAIGHT) | tool: `toolHandChecker` · next: `hand-rankings` · concepts: `term-flush`, `term-straight` |
| `blog-full-house-vs-flush` | 풀하우스와 플러시 중 뭐가 강할까? | 풀하우스가 강하다 — 같은 이유(빈도)로, 플러시보다 더 드물게 나오기 때문 | `CATEGORY_FREQUENCY` (FULL_HOUSE, FLUSH), `CATEGORY_RANK` (FULL_HOUSE, FLUSH) | tool: `toolHandChecker` · next: `hand-rankings` · concepts: `term-full-house`, `term-flush` |

All `<Fact>` name/arg pairs above were re-run through the real `factValue()` (not reasoned)
via a scratchpad script; none threw. Sample resolved values (this run):
`HAND_RANK(22)=87`, `HAND_RANK(55)=27`, `RFI_POSITIONS_WITH(22)=SB`,
`HAND_RANK(72o)=165`, `RFI_POSITIONS_WITH(72o)=한 자리도 없습니다`,
`HAND_AT_RANK(169)=32o` (confirming 72o is NOT the literal worst hand),
`HAND_RANK(J9s)=55` vs `HAND_RANK(J9o)=70`, `HAND_RANK(T8s)=73` vs `HAND_RANK(T8o)=91`,
`CATEGORY_FREQUENCY(FLUSH)=5,108`, `CATEGORY_FREQUENCY(STRAIGHT)=10,200`,
`CATEGORY_RANK(FLUSH)=4`, `CATEGORY_RANK(STRAIGHT)=5`,
`CATEGORY_FREQUENCY(FULL_HOUSE)=3,744`, `CATEGORY_RANK(FULL_HOUSE)=3`.

Additional check run before writing `why-suited-matters`: the "suited always outranks
offsuit of the same two ranks" claim was not asserted from folklore — it was checked against
all 78 non-pair rank pairs via `handStrengthOf`, `0` violations (suited equity is strictly
greater than offsuit equity in all 78 cases). The article states this only after that check.

## 4. Evaluator output — articles #9 and #10 (ruling 28)

Both showdown claims were verified twice, independently: once via a scratchpad script
(`bestFiveOf`/`evaluateHand`/`compareHands` from `@gto-self/strategy-core`), and again as a
permanent, executable assertion inside `i2.test.ts`'s own describe block
(`blog batch I2 — showdown claims are evaluator-verified, not reasoned (ruling 28)`), so the
claim stays checked after this batch, not just at authoring time.

Scratchpad run (`npx tsx` from `apps/fishtilt`, re-run this session):

```
=== Article #9: flush-vs-straight ===
Board: 3h 6h 9h 4c 5c
Player A (flush candidate): cards="3h 6h 9h 4c 5c Kh Th" -> category=FLUSH ranks=[11,8,7,4,1] strength=5998401
  bestFiveOf cards: 5,17,29,45,33
Player B (straight candidate): cards="3h 6h 9h 4c 5c 2d 7d" -> category=STRAIGHT ranks=[5] strength=4521984
  bestFiveOf cards: 5,17,11,15,22
compareHands(A,B) = 1

=== Article #10: full-house-vs-flush ===
Board: 9h 9d 9c 2h 5h
Player A (full house candidate): cards="9h 9d 9c 2h 5h Ah As" -> category=FULL_HOUSE ranks=[7,12] strength=6799360
  bestFiveOf cards: 29,30,31,49,48
Player B (flush candidate): cards="9h 9d 9c 2h 5h Kh Qh" -> category=FLUSH ranks=[11,10,7,3,0] strength=6006576
  bestFiveOf cards: 29,1,13,45,41
compareHands(A,B) = 1
```

Reading: `ranks` are rank indices (`0`='2' .. `12`='A'). Flush ranks `[11,8,7,4,1]` = K,T,9,6,3
(matches the printed `Kh Th` + board hearts). Straight rank `[5]` = top card '7' (matches the
printed 3-4-5-6-7 run). Full house ranks `[7,12]` = trips of '9', pair of 'A' (matches `Ah As`
+ board trip nines). Flush ranks `[11,10,7,3,0]` = K,Q,9,5,2 (matches `Kh Qh` + board hearts).
`compareHands(A, B) = 1` means A (the higher-category hand) strictly wins both times — no tie,
no upset. `i2.test.ts`'s own assertions (`expect(...category).toBe('FLUSH'/'STRAIGHT'/etc.)`
and `expect(compareHands(...)).toBe(1)`) reproduce this exactly and are part of the 20 tests
that pass in §8.

## 5. Strategy claims avoided (per article)

| id | the sentence a competent poker writer would produce without hesitating | what was written instead |
| --- | --- | --- |
| `blog-small-pocket-pairs` | "작은 포켓페어는 세트를 노리고 저렴하게 콜할 만한 좋은 패입니다" | "'좋은 패'인지는 이 순위표 하나로 정할 수 없습니다" up front, then only rank/top-share/equity/combo-count/RFI-position facts, closed with an explicit `Callout` that the equity ranking does not decide where or how to play the hand |
| `blog-why-72o-is-weak` | "72o는 어느 자리에서도 무조건 폴드해야 하는 패입니다" | "순위가 낮은 패를 언제 어떻게 써야 하는지까지 이 표 하나가 정해 주지는 않지만, 오늘의 레인지 표에는 이렇게 나타나 있습니다" — states the shipped `RFI_POSITIONS_WITH` fact (today: no position) without turning it into a rule |
| `blog-why-suited-matters` | "수티드 커넥터는 임플라이드 오즈가 좋아서 콜할 가치가 있는 패입니다" | Confined to the mechanical fact (one extra way to make a flush) and the measured, small equity gap; closes with "이 패를 실제로 어떻게 써야 하는지는 서로 다른 질문입니다... 그 이상은 다루지 않습니다" |
| `blog-flush-vs-straight` | (no play advice at stake here — the trap is over-generalizing the reason) "플러시가 스트레이트보다 세니까 항상 우선시해야 합니다" | Grounds "강하다" strictly in measured frequency (`CATEGORY_FREQUENCY`, `CATEGORY_RANK`), and the showdown example is presented as a fixed rule of the game ("포커는 아홉 가지 조합에 미리 고정된 순서를 매겨 두고"), not a recommendation |
| `blog-full-house-vs-flush` | Same trap, plus the temptation to fully re-derive the frequency argument a second time | States the reason in one sentence and explicitly defers depth to `blog-flush-vs-straight` ("플러시와 스트레이트 사이에 순위 차이가 있는 것도 같은 이유(빈도)이고, 그 이야기는 다른 글에서 자세히 다룹니다"), keeping this article's own facts specific to FULL_HOUSE vs FLUSH |

No file in this batch uses "항상/무조건/반드시 ~해야 합니다", "수익성 있다/이득입니다/플러스 EV",
or "GTO" — checked by both the scratchpad grep in this session and `i2.test.ts`'s own
regex assertions.

## 6. Overlap with the lesson each article defers to

| Blog article | Lesson it defers to | How it differs (not a 70%-overlap rewrite) |
| --- | --- | --- |
| `blog-small-pocket-pairs` | `starting-hands` (defines pocket-pair notation), `starting-hand-ranking` (methodology) | Neither lesson answers "is a *small* pocket pair good" or compares 22 vs 55 by rank/top-share/RFI position; this article is the only place those specific numbers are juxtaposed |
| `blog-why-72o-is-weak` | `starting-hand-ranking` (already reveals rank 169 is not 72o, as a passing aside), `hand-rankings` (9 hand categories) | This article's job is the reverse direction: starting with the folklore claim and testing it, then explicitly distinguishing "starting-hand rank" from "5-card hand category" — a distinction neither lesson states in these terms |
| `blog-why-suited-matters` | `starting-hands` (defines suited/offsuit notation) | The lesson never compares a suited/offsuit pair's rank or equity; this article's entire content (the two comparisons, the monotonicity check across 78 pairs, the "how big is the gap" framing) does not exist there |
| `blog-flush-vs-straight` | `hand-rankings` (states the 9-category order as a fact, via `CATEGORY_RANK`) | The lesson states the order; this article is the only place that answers *why* (frequency) with a concrete, evaluator-verified showdown |
| `blog-full-house-vs-flush` | `hand-rankings` | Same relationship; kept deliberately short on the "why" (one sentence, links to `blog-flush-vs-straight`) per the content plan's §2.3 "lighter form" rule for this pair, so it does not duplicate its sibling article either |

## 7. Facts wanted and not available

None. All facts this batch's five questions needed already existed in `facts.ts`
(`HAND_RANK`, `HAND_TOP_SHARE`, `HAND_EQUITY_VS_RANDOM`, `HAND_COMBOS`, `COMBOS_OF_KIND`,
`HAND_AT_RANK`, `RFI_POSITIONS_WITH`, `CATEGORY_RANK`, `CATEGORY_FREQUENCY`) — no engineering
gap surfaced during authoring.

## 8. Tests run (real counts)

| Command | Result |
| --- | --- |
| `pnpm vitest run --project fishtilt -t "" src/content/registry/blog/i2.test.ts` | **20/20 passed** (this batch's own file) |
| `pnpm vitest run --project fishtilt` | **850/850 passed**, 80 test files — full app suite, no regression |
| `pnpm typecheck` | Clean across all 13 workspace projects, 0 errors |
| `npx eslint apps/fishtilt --max-warnings=0` | Clean, 0 warnings/errors |

No failure in any file this batch does not own was observed in this session — the suite was
green start to finish. `pnpm build:fishtilt` / `pnpm e2e:fishtilt` were intentionally not run
(orchestrator-held gate, per brief).

## 9. Known limitations

- `RFI_POSITIONS_WITH("22")` resolves to `SB` only in the shipped 학습용 기본 레인지 (not, e.g.,
  every position) — this reads as unusual for a small pocket pair versus casual expectation,
  but it is the repository's existing category-B sourced range data (`STRATEGY_ANCHORS.md`),
  not something this batch computed or could second-guess; the article states the fact
  as-is via `<Fact>` and does not editorialize about whether it "should" be wider.
- As with every other content batch, MDX cannot be render-tested under this workspace's
  Vitest config (`docs/reports/WP_QA_MDX_TEST_GAP.md`); `i2.test.ts` proves every property a
  render would catch (Fact validity, Term resolution/uniqueness, PokerCards validity,
  allow-listed components, no import/export, no top-level heading, threshold clearance) by
  static analysis of the raw source, and the orchestrator's `build:fishtilt` remains the only
  thing that actually renders these five files end to end.
- `blog-flush-vs-straight` and `blog-full-house-vs-flush` each carry `relatedArticles: []` in
  the registry (a field this batch's boundary does not permit editing — only
  status/indexable/readMinutes) despite one prose-referencing the other by name; the
  cross-reference is textual only (matching the site's existing convention of gesturing to a
  related piece in prose without a registry-backed link, e.g. `aks-vs-ako.mdx`), not a
  clickable relation. Flagged in case a future WP wants the graph edge added formally.
