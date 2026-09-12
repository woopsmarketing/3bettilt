# WP-P1 — FishTilt poker & mathematics correctness review

Independent review. Read-only: **no file in the repository was created or modified.** Every
throwaway script lived in the session scratchpad
(`/private/tmp/claude-501/.../scratchpad`), never in `apps/fishtilt`.

Automated gates were treated as evidence that the code does what it was written to do, not
that what it says about poker is true.

---

## 1. Scope and method

| Area | What was covered |
| --- | --- |
| Content | 113 MDX files under `apps/fishtilt/content/**` (`learn/`, `blog/`, `glossary/`, `hands/`) — 3 493 sentence units |
| Copy in code | every user-visible Korean string under `apps/fishtilt/src/**` (`app/**/page.tsx`, `components/**`, `features/*/copy.ts`), excluding tests and comments |
| Mathematics | `packages/learn-core` (`potOdds`, `outs`, `equity/exact`, `equity/classVsClass*`, `strength/{model,measure,ranking,dataset.generated}`, `handClass/categoryFrequency`), `packages/strategy-core` (`analysis/evaluate`, `preflop/tables`, range model), `apps/fishtilt/src/content/facts.ts` |
| Tools | `features/tools/{amount,copy,draws,equity,format,handRank,hub,outsView,requiredOuts}.ts`, `features/strength/{copy,viewModel}.ts`, `features/range/{resolve,copy}.ts`, and all six `src/app/tools/*/page.tsx` |
| Quizzes | `features/quiz/**` — engine, `handRankingQuestions`, `rangeQuestions`, `startingHandQuestions` |

Method, in the prescribed order:

1. **Mechanical extraction first.** Three filters run over content *and* (an addition —
   see §3) over the Korean strings inside `src/**`, before reading anything.
2. **Every hit checked by running code**, never against intuition: `evaluateHand` /
   `bestFiveOf` / `compareHands`, `exactHeadsUpEquity`, `equityVsRange`, `outsOdds`,
   `potOdds`, `HAND_STRENGTH`, `CATEGORY_FREQUENCIES`, `topHandsByShare`, `resolveRange`,
   `factValue`. Scripts imported the packages by absolute path under `npx tsx`.
3. **Then reading**, with three specific questions: does every `<PokerCards>` /
   `<RangeMatrixMini>` match the sentence that reads it; is every "could make X on this
   board" claim true under `evaluateHandRank`; does each page answer the question its own
   title asks.
4. Pages fixed in earlier rounds (`glossary/draw`, `glossary/outs`, `glossary/nuts`,
   `hands/{aa,ako,ajs,kk}`) were reviewed again from scratch, not assumed clean.

---

## 2. Findings, most severe first

### F1 — `blog/is-ak-good.mdx:11` — AKo is claimed to be inside the top 10; it is 12th · **blocker**

> 다른 무늬 AKo는 `<Fact HAND_RANK AKo/>`위 … **둘 다 169가지 중 위쪽 10위 안쪽에 들어가는 숫자이고**

The `<Fact>` two clauses earlier renders **12**. The sentence then says both AKs and AKo
are inside the top 10. AKs is 8th; AKo is 12th (AQs 10th, AJs 11th sit between).
This is the exact failure mode this review was asked to hunt: a sentence reasoning about
cards, written on top of a correct computed number, and contradicting it in the same
paragraph.

```
$ npx tsx rank2.ts
  8 AKs 67.04%   ...  10 AQs 66.21%   11 AJs 65.39%   12 AKo 65.32%
```
(`HAND_STRENGTH.entries`, `packages/learn-core/src/strength/dataset.generated.ts`)

### F2 — `src/components/RangeExplorer.tsx:396–401` — strategy claim implying profitability · **blocker**

> 왜 넓이가 다를까요? BTN은 늦게 행동하기 때문에 UTG보다 더 많은 시작 패를 **사용할 수 있습니다**.
> 뒤쪽 자리일수록 앞사람들이 이미 폴드했을 가능성이 높아, **더 넓은 레인지로 오픈해도 손해를 보지
> 않기 때문입니다.**

Two problems.

1. "opening a wider range does not lose money" is a **profitability claim**. The site has
   no dataset that can support it, and it contradicts the site's own `blog/btn-why-wide.mdx`,
   which says in as many words that the matrix having more cells does *not* mean opening
   wider at BTN is 이득 or 맞는 방식, and that *why* the table has that shape is "이 사이트가
   아직 답할 수 있는 범위 밖".
2. The stated **mechanism is wrong for the spot being displayed**. This card renders on an
   RFI (`아무도 참여하지 않았을 때`) range. In an RFI spot *everyone before hero has folded
   by definition*, at UTG as much as at BTN — the probability is 1 at every seat. What
   actually differs between seats is how many players are still **to act behind**. The
   sentence names the one quantity that is constant across the comparison it is explaining.

Renders in the range explorer's compare mode, i.e. on `/tools/range` and on every lesson
that embeds it.

### F3 — `glossary/equity.mdx:1, 5` — equity defined as the probability of winning; the page's own example is 42.8 pp off · **blocker**

> 에퀴티(Equity), 즉 내 승률은 지금 이 패가 끝까지 갔을 때 **이길 확률**을 말합니다. …
> 내가 **이길 확률**이 얼마인지를 나타내는 숫자입니다.
> … 두 손의 강도가 정확히 같아서 에퀴티는 `<Fact EXACT_EQUITY AsKs|AhKh/>`로 정확히 반반입니다.

`EXACT_EQUITY` renders `ExactEquity.equity` (`facts.ts:411`), which is hero's **expected
pot share with ties split**, not P(win). For this page's own worked example:

```
$ npx tsx akvsak.ts
As Ks vs Ah Kh  win 7.16%  tie 85.69%  lose 7.16%  equity 50.00%  (1 712 304 runouts, EXACT)
```

So the page prints 50.00% under a definition ("the probability you win") whose true value
here is **7.16%**. The stated reason is also wrong: the two hands are not "exactly equally
strong" — one of them wins outright 14.3% of the time (a flush) — the 50.00% comes from
suit symmetry, not from a permanent tie.

`learn/equity.mdx:1` defines the same term **correctly** ("팟을 가져갈 것으로 기대되는 몫",
and 비기는 경우는 절반만 이긴 것으로 계산). The glossary contradicts the lesson.

### F4 — site-wide: the strength dataset's equity is described as "이기는 비율" · **should-fix**

`HAND_STRENGTH.entries[].equity` is documented in
`packages/learn-core/src/strength/model.ts:10` as "hero's expected share of that pot, **ties
split**". 15 user-visible places call it the proportion of the time you win.

Measured gap (`equityVsRange`, opponent side exhaustive, 30 000-runout deterministic Weyl
board sample):

| class | shipped `equity` | true P(win) | P(tie) | error of the wording |
| --- | --- | --- | --- | --- |
| AA | 85.20% | 85.01% | 0.51% | 0.19 pp |
| AKs | 67.04% | 66.29% | 1.64% | 0.75 pp |
| 22 | 50.33% | 49.31% | 1.96% | 1.02 pp |
| T9o | 51.53% | 49.84% | 3.49% | 1.69 pp |
| A2o | 54.93% | 52.82% | 4.01% | 2.11 pp |
| 76s | 45.37% | 42.99% | 5.11% | 2.38 pp |
| **72o** | **34.58%** | **31.71%** | **5.83%** | **2.87 pp** |

The numbers are displayed to two decimals, so the description is wrong beyond the precision
claimed. Locations:

| file | line |
| --- | --- |
| `src/features/strength/copy.ts` | 45–46 (`METHODOLOGY_SENTENCE`) |
| `src/features/quiz/startingHandQuestions.ts` | 55 (`METRIC_CLAUSE`) |
| `src/features/strength/copy.ts` | 61 (`RANGE_DISTINCTION_SENTENCE` — "카드 두 장 자체의 승률") |
| `src/content/registry/glossary/j2.ts` | 650 (`shortDefinition`) |
| `src/content/registry/learn/h3.ts` | 64 |
| `src/app/hands/[hand]/page.tsx` | 181, 187 |
| `content/learn/starting-hand-ranking.mdx` | 1, 5, 90 |
| `content/blog/{why-72o-is-weak,small-pocket-pairs,is-ak-good,aks-vs-ako,next-best-after-aa,qq-vs-ak}.mdx` | 7 / 7 / 7 / 15 / 1,7 / 1 |

`CLASS_VS_CLASS_EQUITY` (QQ vs AK) has the same shape: `blog/qq-vs-ak.mdx:1` says "QQ는 …
`<53.95%>`를 이깁니다".

### F5 — `src/app/tools/outs/page.tsx:84–88` — the ×2/×4 error direction is stated backwards for ×2 · **should-fix**

> ×2 / ×4 규칙은 써도 되나요? … 다만 **아웃이 많아질수록 실제보다 크게 계산되기 때문에**, 위
> 계산기가 두 숫자와 그 차이를 항상 함께 보여줍니다.

`outsOdds`' own signed error says otherwise:

```
$ npx tsx outs2.ts
street outs  exactNext   x2    errNext | exactRiver   x4   errRiver
FLOP    1     2.13     2.00   -0.13   |   4.26      4.00   -0.26
FLOP    6    12.77    12.00   -0.77   |  24.14     24.00   -0.14
FLOP    9    19.15    18.00   -1.15   |  34.97     36.00   +1.03
FLOP   15    31.91    30.00   -1.91   |  54.12     60.00   +5.88
TURN    9    19.57    18.00   -1.57   |  19.57     18.00   -1.57
```

- ×2 **under**-estimates at every out count on both streets, and the undershoot **grows**
  with the out count — the opposite of what the card says.
- ×4 under-estimates for 1–6 outs and only over-estimates from 7 up.

The calculator directly beside this card renders `규칙이 실제보다 낮게 잡습니다`
(`SHORTCUT_DIRECTION_LABEL`, derived from the real signed error) for the ×2 row — the page
contradicts itself. The site's own lesson has it right: `learn/outs.mdx:67` — "아웃 개수에
따라 규칙이 실제보다 높게 나오기도, 낮게 나오기도 합니다."

### F6 — `src/app/tools/hand-checker/page.tsx:133–137` — kicker presented as the universal tiebreaker · **should-fix**

> 숫자가 같으면 누가 이기나요? 같은 족보끼리는 만든 숫자가 높은 쪽이 이깁니다. **그마저 같다면
> 남은 카드 중 가장 높은 카드, 즉 키커 (Kicker)가 순위를 가립니다.**

False for straight, straight flush and full house: with the category rank tied there is no
kicker and the hands are **tied** (`quiz.ts` output for `tie-straight-different-suits`:
`As Kd Qh Jc Ts` vs `Ah Kc Qd Js Th` → `compareHands === 0`). It also contradicts the
site's own `glossary/kicker.mdx` ("스트레이트나 플러시, 풀하우스처럼 … 키커라는 개념 자체가
끼어들 자리가 없습니다") and the tool's own output — `features/tools/handRank.ts`'s
`handExplanation` mentions 키커 only for HIGH_CARD / PAIR / TWO_PAIR / TRIPS / QUADS.

### F7 — provenance of the `학습용 기본 레인지` is described inaccurately on three surfaces · **should-fix**

| surface | what it says |
| --- | --- |
| `src/app/about/page.tsx:51–53` | 이 레인지는 특정 솔버나 **특정 사이트의 데이터를 베낀 것이 아니라**, … 기준으로 **계산한 값**입니다 |
| `src/app/tools/range/page.tsx:85` | **여러** 무료 포커 교육 자료를 참고해 정리한 |
| `src/components/RangeExplorer.tsx:88` | **여러** 무료 포커 교육 자료를 참고해 정리한 (renders on every embedded matrix) |

What the data actually is (`packages/strategy-core/src/preflop/tables.ts:39–49`, the
project's own comment):

> S1 (PokerCoaching.com) 6-max cash 100bb, **transcribed VERBATIM**. S1 is the only public
> source found that publishes 13x13 hand-class detail for this spot, so … the LISTS are
> DERIVED (**single-sourced**).

UTG/HJ/CO/BTN — four of the five shipped positions — are a verbatim transcription of one
site's published chart. Only SB is computed (`trimSbCompositeToRaiseOnly`, using a 40–47%
band corroborated by three sources). "여러 자료를 참고해 정리" and "특정 사이트의 데이터를 베낀
것이 아니라 … 계산한 값" both misdescribe that. Note this is a *description* problem, not a
licensing judgement, and `docs/DECISIONS.md`/ADR-0056 already classifies the lists correctly.

### F8 — `blog/outs-nine.mdx:7` — a two-card probability priced against a one-street call · **should-fix**

> 방금 구한 9장의 확률 `<34.97%>`를 이 `<20.00%>`와 나란히 놓으면, 이 드로우가 완성될 확률만으로도
> 이미 산술적으로 손해가 아닌 지점을 넘어섭니다.

34.97% is `byRiverProb` — it requires seeing **both** the turn and the river. The price
being compared is **one** call on the flop. The article caveats a different thing (that
completing the draw ≠ winning) but never states the no-further-betting assumption. The
site's own surfaces do state it: `/tools/outs`'s fourth card ("한 번의 콜을 계산할 때는 '다음
카드 한 장' 확률이 더 안전한 기준입니다") and `PotOddsCalculator.tsx:199` ("뒤에 추가 베팅이
없다고 가정한 단순 비교"). The comparable next-card number is 19.15%, which does **not**
clear the 20.00% price — so the article's conclusion flips under the safer reading.

### F9 — `learn/pot-odds.mdx:31` — same shape, with a preflop all-in equity · **note**

Compares 8h8c-vs-AdKd **to-showdown** equity (52.29%) against a single call's 25.00% and
concludes "이 조건에서 이 콜은 산술적으로 손해가 아닙니다", without saying the hand must reach
showdown with no further betting for that comparison to hold.

### F10 — `features/strength/copy.ts:103` — wrong cause given for the top-X% overshoot · **note**

> **페어처럼 조합 수가 적은 패부터 먼저 포함되기 때문에**, 실제로 포함된 비율은 슬라이더 값보다
> 살짝 높게 나올 수 있습니다.

The overshoot exists because a class is atomic at the cut (`ranking.ts`'s own doc), and it
is **largest** when the boundary class is a big 12-combo offsuit class — small classes make
it smaller, not larger:

```
$ npx tsx topshare.ts
largest overshoot: requested 16%  overshoot 0.893pp  boundary class KTo (12 combos)
```

The factual half of the sentence (actual ≥ requested) is correct.

### F11 — `features/tools/handRank.ts:259` — "the board is stronger than your hand" · **note**

`noteFor(holeCount = 2, holeUsed = 0)` returns *보드에 놓인 다섯 장이 이미 당신의 핸드보다
강합니다*. When the board plays, the player's hand **is** that board, and `bestFiveOf`
prefers the board on a **tie** (documented in the module's own header), so the honest
reading is "your two cards do not improve on the board" → split pot, not "the board is
stronger than you". The quiz gets this right (`board-plays-tie` → MIXED/TIE) and
`blog/playing-the-board.mdx` gets it right; only this note overstates.

### F12 — `src/app/tools/starting-hand/page.tsx:174, 178` · **note**

"포지션별로 실제 어떤 패를 **플레이하는지**" / "실제로 어떤 패를 **여는지**" drops the
`학습용 기본 레인지` label that every other surface attaches, and reads as a description of
what players actually do.

### F13 — `blog/small-pocket-pairs.mdx:11` · **note**

"페어 숫자가 하나씩 올라갈수록 순위도 조금씩 앞으로 움직이지만, **그 폭이 아주 크지는 않습니다**"
sits between the two numbers 22 = 87th and 55 = 27th (33 = 66th, 44 = 48th). A 60-place move
across the article's own two examples is not obviously "not very large".

**Totals — 3 blockers, 5 should-fix, 5 notes.**

---

## 3. Filter results

| filter | corpus | hits | errors found |
| --- | --- | --- | --- |
| A — causal ∧ comparative ∧ hand/category | `content/**` (113 files, 3 493 units) | 15 | 0 |
| B — absolute quantifier ∧ hand/category | `content/**` | 72 | 0 |
| C — percentage / decimal / thousands number in prose not from `<Fact>` | `content/**` | 57 | 0 |
| **C2 — any integer + Korean counter (위/등/%/가지/장/개/번/배/BB…) in prose** | `content/**` | 54 | **1 (F1)** |
| A — same, over Korean strings in `src/**` | `src/**` (non-test, non-comment) | 3 | **1 (F10)** |
| B — same, over `src/**` | `src/**` | 13 | **1 (F7 about-page)** |

Two method notes, because they changed the outcome:

- The original Filter C regex only matched percentages, decimals and thousands-separated
  numbers. **F1 ("10위") is a bare two-digit integer and was invisible to it.** Widening the
  filter to "integer + Korean counter" (C2) is what surfaced it. Any future sweep should use
  the wider form.
- The three filters as specified cover `content/**` only. **Half the user-visible prose on
  this site lives in `src/**`** — `app/**/page.tsx` explanation cards, `features/*/copy.ts`,
  `components/*.tsx`. Running the same filters there produced F2, F5, F6, F7, F10, F12 — i.e.
  more findings than the content corpus did. `content/**` is the better-audited half.

---

## 4. Illustration audit (`<PokerCards>` / `<RangeMatrixMini>` vs the sentence that reads it)

112 `<PokerCards>` usages. Every board/hand illustration whose prose makes a checkable claim
was evaluated with `bestFiveOf` / `evaluateHand` / `compareHands`:

| page | illustration | prose claim | evaluator | verdict |
| --- | --- | --- | --- | --- |
| `blog/playing-the-board` | `5h6d7c8s9h` + `2c3d` / `AcKd` | both play the board, split | STRAIGHT = board for both, `compareHands` 0 | OK |
| `blog/playing-the-board` | `9h9d7c4s2h` + `Ac9c` / `KdQd` | hero trips, villain board pair | TRIPS vs PAIR, hero wins | OK |
| `blog/flush-vs-straight` | `3h6h9h4c5c` + `KhTh` / `2d7d` | 3 board hearts → flush; 3-4-5-6 → 7-high straight | FLUSH `3h6h9hKhTh` vs STRAIGHT `3h4c5c6h7d`, flush wins | OK |
| `blog/full-house-vs-flush` | `9h9d9c2h5h` + `AhAs` / `KhQh` | 9s full of aces vs 3 board hearts → flush | FULL_HOUSE vs FLUSH, FH wins | OK |
| `learn/poker-hand-rankings` | 9 category examples | one per category, weakest→strongest | all 9 categories match | OK |
| `learn/poker-hand-rankings` | `AhAd7c4d2h` + `KsQs` / `JsTs` | K kicker wins | PAIR `AhAd7cKsQs` beats `AhAd7cJsTs` | OK |
| `blog/a2345-wheel` | `Ah2c3d4c5s` / `QhKcAd2c3s` / `2h3c4d5c6s` | wheel = 5-high straight; QKA23 = high card only; wheel loses to 6-high | STRAIGHT top='5'; HIGH_CARD; STRAIGHT top='6' | OK |
| `glossary/draw`, `glossary/outs` | `AhKh5h2hJc` | "하트가 넉 장" → 9 outs | 4 hearts shown, 13−4 = 9 | OK (earlier fix holds) |
| `glossary/nuts` | `AhKhQh7c2d` | nuts is the `Th Jh` straight flush, not the flush | enumerated all 1 081 hole pairs; `ThJh` is uniquely best | OK (earlier fix holds) |
| `glossary/split-pot` | `AhKdQcJsTh` | board unbeatable → split | 0 of 1 081 hole pairs improve on it | OK |
| `learn/outs` | `AsKs` + `2s7s9c` | "손에 스페이드 두 장, 보드에 스페이드 두 장" | 2 + 2 spades, 9 left | OK |
| `glossary/equity` | `AsKs` / `AhKh` | "두 손의 강도가 정확히 같아서" | tie 85.69%, each wins 7.16% | **F3** |

No mismatch between an illustration and its prose was found other than F3's *reason*
(the cards and the rendered number are right; the sentence explaining them is not).

---

## 5. Mathematics review

| module | check | result |
| --- | --- | --- |
| `learn-core/handClass/categoryFrequency` | all 9 five-card frequencies vs the textbook values; sum vs C(52,5) | 40 / 624 / 3 744 / 5 108 / 10 200 / 54 912 / 123 552 / 1 098 240 / 1 302 540, sum 2 598 960 — **9/9 exact** |
| ranking ⇄ frequency | "드문 조합일수록 위" claimed for all nine | frequency order is exactly the category order — **claim true** |
| `learn-core/outs` | `nextCardProb = o/47`, `byRiverProb = 1 − C(47−o,2)/C(47,2)`, 46 after the turn; `ruleOfTwoAndFour` signed error | closed form correct; on the turn "next card" and "by river" are deliberately the same float | OK (the *description* of the error direction is F5) |
| `learn-core/potOdds` | `potBeforeCallMbb` excludes the bet; `final = pot + min(bet,call) + call`; `required = call/final`; all-in-for-less remainder returned | integer milliBB throughout, no float money | OK |
| `learn-core/equity/exact` | `heroWinBps + tieBps + villainWinBps = 10 000`; `runouts = C(48,5) = 1 712 304` preflop | verified on `AsKs|AhKh` and `8h8c|AdKd` | OK |
| `learn-core/strength` | 169 rows, no repeat, cumulative combos = 1 326, `exactTies` empty, basis `HEADS_UP_ALLIN_EQUITY_VS_RANDOM_HAND`, `method: 'EXACT'` | invariants hold; **0 equity ties** among 169 | OK (the *label* "이기는 비율" is F4) |
| suited > offsuit | all 78 rank pairs | 78/78 suited equity > offsuit — `blog/why-suited-matters.mdx:31`'s "예외 없이" is **true** | OK |
| `topHandsByShare` | overshoot direction and size | actual ≥ requested always; max 0.893 pp at 16% (boundary `KTo`) | OK (cause mis-stated — F10) |
| `strategy-core/analysis/evaluate` | wheel = 5-high straight; QKA23 not a straight; category packing | matches the rules | OK |
| `strategy-core/preflop/tables` | RFI list provenance and SB trim | correct and documented in-code | OK (surface copy is F7) |
| `facts.ts` | 20 fact names, throw-not-fallback, `(x*100).toFixed(2)`, `HAND_ONE_IN_N` via `Math.round` | no fact can render a plausible-but-uncomputed number | OK |

No arithmetic error was found anywhere in `learn-core` or `strategy-core`. Every finding in
§2 is a **sentence about** a correct number.

---

## 6. Tools review

| tool | computes correctly? | describes correctly? | finding |
| --- | --- | --- | --- |
| `/tools/equity` | yes — `exactHeadsUpEquity`, worker and main-thread path call the same engine; display percentages re-apportioned at 0.1% resolution so they sum to 100.0% | yes — hero % is `heroWinBps` (a real win probability) with 비김 shown separately; "정확 계산" is honest (`method: 'EXACT'`, `runouts` printed) | — |
| `/tools/outs` | yes — hypergeometric, `unseen` read from `learn-core`, turn renders one row not two | **no** — the ×2/×4 explanation card states the error direction backwards | **F5** |
| `/tools/pot-odds` | yes — integer milliBB via `Money`, all-in-for-less remainder modelled, `minimumOutsFor` is a scan over the real `outsOdds` | yes — states "뒤에 추가 베팅이 없다고 가정" beside the required-outs answer | — |
| `/tools/hand-checker` | yes — `bestFiveOf` with the board passed first so "one hole card plays"/"board plays" are answerable; wheel and royal named correctly | **partly** — the kicker card over-generalises; the board-plays note overstates | **F6, F11** |
| `/tools/range` | yes — one facade (`resolveRange`); BB returns a typed `BB_HAS_NO_RFI_RANGE`, not an empty grid | **no** — provenance line, and the compare-mode "왜 넓이가 다를까요" card | **F2, F7** |
| `/tools/starting-hand` | yes — reads the frozen `HAND_STRENGTH`; ties/overshoot sentences are data-driven, not literals | **no** — the metric is labelled "이기는 비율"; CTA drops the range label; overshoot cause | **F4, F10, F12** |
| `/tools` hub | n/a | descriptions derived from the route registry, throw if missing | — |

`features/tools/draws.ts` deserves a note in the other direction: every preset out count is
derived from `RANKS`/`SUITS` (2, 4, 6, 8, 9, 12, 15) with the overlap **subtracted
explicitly** for the combined draws, and each ships its own Korean derivation sentence. It
is the cleanest module in the tools layer.

---

## 7. Quiz review

| quiz | answers derived from | can a correct answer score wrong? |
| --- | --- | --- |
| Hand-ranking (12 fixtures) | `evaluateHand` / `compareHands` at build time — no winner is ever typed in the fixture | **No.** All 12 re-verified against the evaluator; both genuine ties (`tie-straight-different-suits`, `board-plays-tie`) are emitted as `{kind:'MIXED', correctAnswerIds:['TIE']}` and `TIE` is an offered option |
| Range (169 × 5 positions = 845) | `hasHandClass(resolveRange(q).range, i)` | **No.** 845/845 questions matched a fresh `resolveRange` lookup. `HandClassSet` is a `Uint8Array` of 0/1, so no frequency is being flattened into a yes/no; `RANGE_QUIZ_SUPPORTED_POSITIONS` is computed from `resolveRange`, and BB (which has no RFI range) is excluded rather than guessed |
| Starting-hand (11 key pairs) | `handStrengthForKey` / `handStrengthTied` | **No.** All 11 matched the dataset. `exactTies` is empty today, and `handStrengthTied` is still consulted rather than assumed — a regenerated dataset with a tie would produce a MIXED question, not a wrong scoring |

Engine: `isAnswerCorrect = acceptableAnswerIds(question).includes(answerId)`, where
`acceptableAnswerIds` returns the single id for `SINGLE` and the whole array for `MIXED` —
so a MIXED question accepts every listed answer. `assertValidQuestion` throws on fewer than
two options, duplicate ids, no accepted answer, or an accepted id that is not among the
options; `compactQuestions` drops `null` (UNSUPPORTED) rather than inventing a question.
Seeds are fixed constants.

The only quiz-side finding is F4's wording: the starting-hand quiz's `METRIC_CLAUSE` calls
the equity "이기는 비율". The *answers* are right; the metric they are about is mislabelled.

---

## 8. Strategy-claim audit

| check | result |
| --- | --- |
| the string "GTO" anywhere user-visible | **absent.** The only occurrences in `apps/fishtilt` are inside `@gto-self/*` import specifiers and inside ten tests that assert its absence (`page.test.tsx` × 9, `about/page.test.tsx`) |
| "솔버" / "solver" | one occurrence, `about/page.tsx:51`, saying the range is *not* copied from one (accurate as to solvers; see F7 for the rest of that sentence) |
| claims of what a player should do | **F2** is the one place the site tells the reader what can be opened and asserts it does not lose money. Everywhere else the discipline holds and is unusually good: `blog/btn-why-wide.mdx:29`, `blog/is-ak-good.mdx` ("이 사이트에서는 AK를 '프리미엄 핸드'라고 부르지 않습니다"), `hands/[hand]/page.tsx:190`, `RANGE_LABEL` + its conditions on every matrix, `PLAYABILITY_CAVEAT_SENTENCE`, `STRATEGY_DISTINCTION_SENTENCE` |
| "수익성" / profitability | only ever in the negative ("…수익성이 있다는 뜻은 아닙니다") except F2 |
| "이득/손해" in pot-odds copy | used as break-even arithmetic and explicitly framed as 손익분기점, with "콜하라는 뜻이 아닙니다" callouts. Acceptable — except where the arithmetic itself is applied across streets (F8, F9) |
| mock/unverified data labelled | yes — `RANGE_LABEL` = 학습용 기본 레인지, conditions always adjacent, `UNSUPPORTED` states say "아직 준비되지 않았습니다" instead of guessing |

---

## 9. Areas established as clean, and how

| area | how it was established |
| --- | --- |
| Every number rendered in prose | `facts.ts` computes all 20 fact kinds at build time from the domain and **throws** rather than falling back; scans of `content/**` found no percentage in prose that was not produced by a `<Fact>`. Invented numbers are not this site's failure mode |
| The 9-category ranking and its frequency justification | all nine counts reproduced exactly against the standard 5-card frequencies and against C(52,5) |
| Hand evaluation, wheel and royal handling | every illustrated 5- and 7-card example re-evaluated with `bestFiveOf`/`evaluateHand`; all matched |
| Board illustrations | 12 board/hand claims re-evaluated, including both "board plays" examples and both split examples (§4) |
| Suited-vs-offsuit direction claim | exhaustive over all 78 rank pairs; 0 counterexamples |
| Strength dataset order | 169 rows, no ties, cumulative combos = 1326; the specific ordinal claims in `hands/{aa,kk,77,88,99,tt,ako,jts,a5s}.mdx` and `blog/{next-best-after-aa,why-72o-is-weak,why-suited-matters,small-pocket-pairs,aks-vs-ako}.mdx` all check out against `HAND_STRENGTH` (e.g. top-7 all pairs, AKs 8th as the first non-pair, 32o 169th) |
| Range facade | `resolveRange` is the only door to range data; 216-point query space; only RFI/100BB/6-max/non-BB resolves, everything else returns a typed reason |
| Quiz scoring | §7 — 868 generated questions re-derived and compared, ties included |
| Pot-odds and money handling | integer milliBB end to end; float only at `parseAmountBB`, which delegates the magnitude guard to `Money.parseBB` |
| "GTO" absent from user-visible text | §8 |

---

## 10. What could not be checked, and what it would need

| gap | why | what would close it |
| --- | --- | --- |
| Exact win/tie/loss split per starting-hand class | the shipped dataset stores only `equity`; a full exact recomputation is ~2.1 × 10⁹ showdowns per class | the F4 table uses a 30 000-board deterministic sample (opponent side exhaustive). Directionally certain, third decimal not. Storing `winBps`/`tieBps` alongside `equity` at generation time would make it exact and would let the copy say what it means |
| Whether the RFI lists faithfully reproduce their cited source | the source is an external chart; only `tables.test.ts`'s percentage bands are checkable in-repo | a fixture transcribed independently from the cited page (the same discipline ADR-0018 applies to rake) |
| Rendered-page verification | `pnpm build:fishtilt` / `pnpm e2e:fishtilt` were reserved by another agent | findings F2/F5/F6/F7/F12 were located in source and traced to their render site by reading the component tree, not by viewing the built page |
| Prose in `content/registry/**` (search snippets, short definitions, related-content blurbs) | reviewed by grep for the specific error classes above (found F4's two registry entries), not sentence-by-sentence | the same three filters run over `src/content/registry/**` as a corpus in its own right |
| `docs/DECISIONS.md` settled items | out of scope by instruction | — |

---

### One structural recommendation

The three specified filters cover `content/**`. Six of this round's thirteen findings live
in `src/**` — explanation cards on tool pages and `features/*/copy.ts` — which no filter had
ever been pointed at, and which is where the site's most confident claims (a strategy
rationale, a kicker rule, a shortcut's error direction, the data's provenance) turn out to
sit. Whatever sweep runs next should treat Korean string literals in `src/**` as first-class
content, and should use the widened Filter C (integer + counter), without which F1 stays
invisible.
