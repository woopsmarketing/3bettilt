# FishTilt — content plan

The authoring contract for the fifteen Learn lessons, twenty Blog answers, ~56 Glossary
terms and twenty priority Hand pages. Written 2026-09-05 by the content architect, from the
build spec at `./prompt` §17–§23, §33, §37, §47, §48, and the code that is actually on disk.

**This document plans; it does not author.** Nine downstream agents (H1 H2 H3 · I1 I2 I3 I4 ·
J1 J2) each read only their own slice — §7 is written to be pasted straight into a prompt.

**Reading order for a batch agent:** §6 (language contract) → §5 (link rules) → your own
block in §7 → the one table in §1/§2/§3 that lists your items. Nothing else.

---

## 0. Hard constraints every batch inherits

| # | Rule | Enforced by |
| --- | --- | --- |
| 0.1 | Prose never writes a number. Use `<Fact name="…" />`. | `CLAUDE.md` rule 2, `src/content/facts.ts` (throws on unknown name) |
| 0.2 | The string `GTO` never appears — not in MDX, not in a registry title/description. | `content.test.ts` "never uses the word GTO" |
| 0.3 | MDX has no `import`, no `export`, no `<h1>`. | `content.test.ts` §"MDX authoring surface" |
| 0.4 | Only these components: `Callout` `Fact` `MiniQuiz` `PokerCards` `RangeMatrixMini` `Term` `ToolCTA`. | `src/content/allowList.ts` |
| 0.5 | Each `<Term id>` appears **at most once per file** (first use only), and every id used must also be listed in that record's `relatedConcepts`. | `content.test.ts` |
| 0.6 | Prose file path is `apps/fishtilt/content/<kind>/<slug>.mdx`. | `content.test.ts` `mdxPathFor` |
| 0.7 | A record may only be `PUBLISHED` if its MDX exists **and** its kind's route template exists on disk. | `content.test.ts` |
| 0.8 | `indexable: true` requires clearing the per-kind floor below. | `src/content/threshold.ts` |
| 0.9 | `readMinutes` must equal `estimateReadMinutes(proseCharacters)` — do not guess it; run the test and read the number the failure prints. | `content.test.ts` |
| 0.10 | A hand's raw strength number is **a property of the cards, not a claim about profit**. No sentence may say a hand is 수익성 있다 / 이득이다 / 항상 레이즈 because of a rank or an equity figure. | `docs/FISHTILT_STATE.md` "Open blockers" caveat |
| 0.11 | Any range shown carries the fixed label `학습용 기본 레인지` and its conditions (6인 · 100BB · 아무도 참여하지 않았을 때). | Settled decision 3 + `features/range/copy.ts` |

### Per-kind index floors (`threshold.ts`, do not negotiate)

| kind | prose 자 | `##` 섹션 | distinct 구성요소 | `relatedTools` | 다음 단계 | `relatedConcepts` |
| --- | --- | --- | --- | --- | --- | --- |
| learn | 1500 | 4 | 2 | 1 | 1 | 2 |
| blog | 900 | 3 | 1 | 1 | 1 | 1 |
| glossary | 400 | 2 | 0 | 1 | 0 | 1 |
| hands | 600 | 3 | 1 | 1 | 0 | 1 |

Additionally, `content.test.ts` requires **every published lesson to embed a `<ToolCTA>` in
its prose**, not merely to list one in `relatedTools`.

---

## 1. Curriculum spine — the fifteen Learn lessons

### 1.1 Reconciliation: build spec §17 vs `registry/learn.ts`

All fifteen already exist as records, in the spec's order, with `order` 1–15 gapless. **The
registry wins on `id`, `slug` and `order`.** Three disagreements, resolved:

| # | Disagreement | Ruling |
| --- | --- | --- |
| R1 | Build spec §15 (WP-E3) names the route `/learn/poker-hand-rankings`. The registry has `id: hand-rankings`, `slug: hand-rankings`. | **Registry wins.** The URL is `/learn/hand-rankings`. `§15`'s path is superseded; no redirect is needed because nothing has shipped at either URL. |
| R2 | Lesson 02 (포커 족보) is claimed by **both** WP-E3 ("`/learn/poker-hand-rankings` 완성") and WP-H1 ("Lessons 1–5"). | **WP-H1 owns lesson 02.** WP-E3 is reduced to the twenty `/hands/*` pages plus the `/hands` route template, and links *into* lesson 02. Two agents must not write the same MDX file. Orchestrator: confirm this narrowing before dispatching E3. |
| R3 | Spec §17 lesson 09 is `체크/콜/베팅/레이즈/폴드` (five actions). The registry title says `콜 · 체크 · 레이즈 · 폴드` (four) and the description asserts `행동은 네 가지뿐입니다`. | **Spec wins on substance; H2 amends the registry copy.** There are five named actions (check, bet, call, raise, fold); "네 가지" is wrong. H2 rewrites that record's `title` and `description` (WP-G's report §9 already grants WP-H final wording). |

Everything else matches. `poker-range` (order 6) is **already `PUBLISHED`** — H2 does not
rewrite it; H2 links to it.

### 1.2 The spine

`ToolCTA` and `MiniQuiz` are mandatory in every lesson (0.8 floor + §27 mini check). The
"signature element" column is the **third** component — the one that makes the lesson visual.

| # | id / slug | Korean title (registry) | Promise to the reader (one sentence) | Prereq (ids) | Signature element | Related terms | Related blog | Next | Batch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | `holdem-basics` | 텍사스 홀덤은 어떻게 진행될까요? | 한 판이 시작해서 끝날 때까지 무슨 일이 순서대로 일어나는지 알게 됩니다. | — | `PokerCards` (한 사람이 받는 두 장) | term-blind, term-big-blind, term-showdown, term-pot | blog-why-blinds-exist | hand-rankings | H1 |
| 02 | `hand-rankings` | 어떤 족보가 더 강할까요? | 다섯 장으로 만드는 아홉 가지 족보의 순서와, 같은 족보끼리 어떻게 우열을 가리는지 알게 됩니다. | holdem-basics | `PokerCards` ×9 (`cards` prop, 족보별 실제 카드) | term-hand-ranking, term-kicker, term-split-pot, term-flush, term-straight, term-full-house | blog-flush-vs-straight, blog-full-house-vs-flush, blog-same-pair-who-wins | starting-hands | H1 |
| 03 | `starting-hands` | 처음 받은 두 장, 좋은 패일까요? | 시작 패를 보는 세 가지 기준(같은 무늬 / 같은 숫자 / 숫자 차이)과 AKs·AKo 표기법을 읽게 됩니다. | hand-rankings | `PokerCards` (AKs · AKo 나란히) | term-suited, term-offsuit, term-pocket-pair | blog-aks-vs-ako | starting-hand-ranking | H1 |
| 04 | `starting-hand-ranking` | 시작 패는 어떤 순서로 강할까요? | 169가지를 강한 순서로 줄 세우면 어떤 모습인지, **그 순서가 무엇을 재서 나온 것인지** 알게 됩니다. | starting-hands | `Fact` 표 (rank · 상위 %) + `RangeMatrixMini` | term-combo, term-equity, term-hand-matrix | blog-next-best-after-aa, blog-is-ak-good | hand-matrix | H1 |
| 05 | `hand-matrix` | 13×13 표는 어떻게 읽나요? | 대각선·위쪽·아래쪽이 각각 무엇인지, 칸 하나가 왜 패 하나가 아닌지 알게 됩니다. | starting-hands | `RangeMatrixMini` (`showSelection`) | term-hand-matrix, term-combo, term-suited, term-offsuit, term-pocket-pair | blog-aks-vs-ako | poker-range | H1 |
| 06 | `poker-range` | 핸드레인지란? | **이미 발행됨.** 상대의 패를 하나로 찍지 않고 묶어서 보는 방법. | starting-hands, hand-matrix | `RangeMatrixMini` ×2 | (기존) | (기존) | position, three-bet | — (H2는 링크만) |
| 07 | `position` | 자리(포지션)가 왜 그렇게 중요할까요? | 같은 패라도 행동 순서가 달라지면 아는 정보가 달라진다는 것을 눈으로 확인합니다. | poker-range | `RangeMatrixMini` `positions={['UTG','BTN']}` | term-position, term-button | blog-btn-why-wide | positions-6max | H2 |
| 08 | `positions-6max` | UTG · HJ · CO · BTN · SB · BB, 여섯 자리의 이름 | 6인 테이블의 여섯 자리 이름과, 매 판 버튼이 한 칸씩 도는 구조를 외우지 않고 이해합니다. | position | `RangeMatrixMini` (5개 자리 토글) | term-utg, term-hijack, term-cutoff, term-button, term-small-blind, term-big-blind | blog-btn-why-wide, blog-why-blinds-exist | poker-actions | H2 |
| 09 | `poker-actions` | (H2가 개정 — 다섯 가지 행동을 담을 것) | 내 차례에 고를 수 있는 행동 다섯 가지가 각각 무엇이고 언제 고를 수 있는지 알게 됩니다. | holdem-basics | `MiniQuiz` + `Callout` (권장: 보드 `PokerCards`) | term-check, term-bet, term-call, term-raise, term-fold | — | preflop | H2 |
| 10 | `preflop` | 첫 두 장을 받은 뒤, 프리플랍 | 공용 카드가 한 장도 없는 상태에서 무엇을 보고 결정하는지, 오픈 레이즈가 무엇인지 알게 됩니다. | poker-actions, poker-range | `RangeMatrixMini` (UTG 한 자리) | term-preflop, term-open-raise, term-limp | blog-why-use-range | flop-turn-river | H2 |
| 11 | `flop-turn-river` | 플랍 · 턴 · 리버, 카드는 이렇게 열립니다 | 공용 카드 다섯 장이 3·1·1로 나뉘어 열리는 순서와 각 단계의 이름을 알게 됩니다. | preflop | `PokerCards cards="…"` (보드 3장 → 4장 → 5장) | term-flop, term-turn, term-river, term-board, term-community-cards | blog-playing-the-board | three-bet | H3 |
| 12 | `three-bet` | 상대의 레이즈에 다시 레이즈 (3-Bet) | 왜 두 번째 레이즈를 3-Bet이라고 부르는지, 세는 방법이 무엇인지 알게 됩니다. | preflop | `Callout` (베팅 세는 법) + `MiniQuiz` | term-three-bet, term-four-bet, term-open-raise, term-big-blind | blog-why-called-3bet | equity | H3 |
| 13 | `equity` | 내 승률은 몇 퍼센트일까? (Equity) | 지금 이 패가 끝까지 갔을 때 이길 확률이 무엇을 뜻하는지, 어떻게 세는지 알게 됩니다. | flop-turn-river | `PokerCards` 두 벌 + `Fact name="EXACT_EQUITY"` | term-equity, term-split-pot, term-showdown | blog-qq-vs-ak | pot-odds | H3 |
| 14 | `pot-odds` | 콜할 값어치가 있을까? 팟오즈 | 내야 하는 돈과 가져갈 수 있는 돈을 비교해 **콜에 필요한 최소 승률**을 구하는 방법을 익힙니다. | equity | `ToolCTA tool="toolPotOdds"` (deep link) + `Fact` 계산 예 | term-pot-odds, term-pot, term-equity | blog-pot-odds-quick | outs | H3 |
| 15 | `outs` | 아직 남은 좋은 카드, 아웃츠 | 내 패를 완성시키는 카드가 몇 장 남았는지 세고, 그 확률을 구하는 법을 익힙니다. | pot-odds | `ToolCTA tool="toolOuts"` + `PokerCards` (플러시 드로우 보드) | term-outs, term-draw, term-pot-odds | blog-outs-nine | — | H3 |

### 1.3 Tool availability — which CTA is live today

`ToolCTA` renders a non-link when the route's `available` is `false` (`toolHref` returns
`null`). It degrades safely, but a lesson whose *only* CTA is dead reads as a broken promise.

| Route id | `available` today | Lessons that want it | Rule |
| --- | --- | --- | --- |
| `range`, `toolPotOdds`, `toolOuts`, `tools`, `learn` | **true** | 04 05 06 07 08 10 12 14 15 | Safe as the in-prose CTA. |
| `toolStartingHand` | false (WP-E2) | 03 04 | May sit in `relatedTools`; **must not** be the only in-prose CTA. Use `range` in prose until E2 ships. |
| `toolEquity` | false (WP-F2B) | 13 | Same. In-prose CTA falls back to `toolOuts`. |
| `toolHandChecker` | false (WP-F2C) | 01 02 | Same. In-prose CTA falls back to `range` or `toolOuts`. |
| `practice` | false (WP-L) | 02 04 06 | `relatedTools` only. |

### 1.4 Concept ownership — the anti-duplication ledger

**One concept, one owner.** The owner explains it from zero. Every other page — lesson, blog,
glossary or hand page — introduces it with `<Term>` or a link and moves on. If your draft
spends more than two sentences explaining a concept you do not own, delete them and link.

`ContentRecord.concepts[]` is a *grouping tag list*, not this ledger — lesson 06's published
record tags `hand-matrix`, `position` and `preflop` because it touches them. This table
governs who may **explain**; the field stays as it is.

| Concept keyword | Owner | Everyone else does this instead |
| --- | --- | --- |
| `rules`, `betting-round`, `hand-flow`, `showdown` | 01 holdem-basics | link to 01 |
| `hand-ranking`, `five-card-hand`, `kicker`, `split-pot` | 02 hand-rankings | `<Term id="term-hand-ranking">` etc. |
| `starting-hand`, `suited`, `offsuit`, `pocket-pair`, `notation` | 03 starting-hands | `<Term id="term-suited">` etc. |
| `hand-strength`, `strength-methodology`, `top-percent`, `equity-vs-random` | 04 starting-hand-ranking | one sentence + link to 04 |
| `hand-matrix`, `matrix-diagonal`, `combo`, `combo-count` | 05 hand-matrix | `<Term id="term-combo">` |
| `range`, `range-vs-single-hand`, `wide-vs-narrow`, `range-conditions` | 06 poker-range | `<Term id="term-range">` |
| `position`, `acting-order`, `information-advantage` | 07 position | `<Term id="term-position">` |
| `seat-names`, `blinds`, `button-moves`, `six-max` | 08 positions-6max | `<Term id="term-button">` etc. |
| `action`, `check`, `bet`, `call`, `raise`, `fold` | 09 poker-actions | `<Term id="term-raise">` etc. |
| `preflop`, `open-raise`, `limp`, `first-in` | 10 preflop | `<Term id="term-preflop">` |
| `street`, `board`, `community-cards`, `runout` | 11 flop-turn-river | `<Term id="term-flop">` etc. |
| `three-bet`, `four-bet`, `bet-counting`, `re-raise` | 12 three-bet | `<Term id="term-three-bet">` |
| `equity`, `win-probability`, `tie-equity`, `showdown-equity` | 13 equity | `<Term id="term-equity">` |
| `pot-odds`, `required-equity`, `call-price`, `odds-against` | 14 pot-odds | `<Term id="term-pot-odds">` |
| `outs`, `draw`, `rule-of-2-and-4`, `next-card-probability` | 15 outs | `<Term id="term-outs">` |

---

## 2. Blog plan — twenty answers, four batches

### 2.1 Reconciliation: build spec §21 vs `registry/blog.ts`

Three records exist. All three are reused; **the registry wins on `id` and `slug`**, because
eight other records already point at these ids.

| Spec # | Existing record | Ruling |
| --- | --- | --- |
| 4 · AKs와 AKo 차이는? | `blog-aks-vs-ako` / `aks-vs-ako` / "AKs와 AKo는 무슨 차이일까?" | **Reuse as-is.** Title matches the intent. |
| 15 · BTN이 좋은 자리인 이유 | `blog-btn-why-wide` / `btn-why-wide` / "BTN에서는 왜 더 많은 패를 사용할까?" | **Reuse id + slug + registered title.** Five records link to this id. The spec's phrasing becomes the article's search-intent line, not a second article. |
| 20 · 아웃츠로 확률 계산하기 | `blog-outs-nine` / `outs-nine` / "아웃츠 9장은 무슨 뜻일까?" | **Reuse id + slug + registered title** — the concrete question that delivers the general method. `lesson 15` already links this id. *Orchestrator escape hatch: if you want the general title as its own page, register a 21st record `blog-outs-probability`; I did not, because it would break the 5-per-batch split and duplicate lesson 15.* |

The other seventeen are new. Ids and slugs assigned below are **fixed by this document** —
do not invent alternatives.

### 2.2 The twenty

`Fact ✅` = the fact name exists in `src/content/facts.ts` today. `Fact ⛔` = the name must be
added first (see §2.4). `⚠` = the central claim cannot be backed by a computed number in this
repo as it stands.

#### Batch I1 — 시작 패 강도 (5)

| # | id / slug | Title | Search intent | Numbers needed → source | Defers to | Tool CTA |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `blog-next-best-after-aa` / `next-best-after-aa` | AA 다음으로 좋은 패는? | "포커 두번째로 좋은 패" | rank 2·3·4의 클래스 키 → `HAND_STRENGTH_BY_RANK[n-1].key` (`Fact ⛔ HAND_AT_RANK`); 각 패의 등급·상위% → `Fact ⛔ HAND_RANK`, `⛔ HAND_TOP_SHARE` | 04 (측정 기준), 03 (표기법) | `range` (E2 이후 `toolStartingHand`) |
| 2 | `blog-how-often-aa` / `how-often-aa` | AA는 얼마나 자주 받을까? | "포커 AA 확률" | 조합 6가지 → `Fact ✅ HAND_COMBOS arg="AA"`; 전체 비중 0.45% → `Fact ✅ HAND_SHARE arg="AA"`; 전체 1326 → `Fact ✅ COMBO_COUNT`; "약 N번에 한 번" → `Fact ⛔ HAND_ONE_IN_N` (1326/6) | 05 (콤보), 03 | `range` |
| 3 | `blog-is-ak-good` / `is-ak-good` | AK는 좋은 패인가? | "AK 좋은패인가" | AKs/AKo 등급·상위% → `⛔ HAND_RANK`, `⛔ HAND_TOP_SHARE`; 무작위 상대 대비 승률 → `⛔ HAND_EQUITY_VS_RANDOM`; 어느 자리에서 첫 레이즈에 쓰이는가 → `Fact ✅ RFI_POSITIONS_WITH arg="AKs"/"AKo"` | 04, 07 | `range` |
| 4 | `blog-aks-vs-ako` / `aks-vs-ako` | AKs와 AKo는 무슨 차이일까? | "AKs AKo 차이" | 콤보 4 vs 12 → `Fact ✅ HAND_COMBOS`; 비중 → `✅ HAND_SHARE`; 자리 → `✅ RFI_POSITIONS_WITH`; 승률 차 → `⛔ HAND_EQUITY_VS_RANDOM` | 03 (s/o 표기), 05 | `range` |
| 5 | `blog-qq-vs-ak` / `qq-vs-ak` | QQ와 AK 중 뭐가 강할까? | "QQ AK 승률" | **정확한 카드 4장을 고정한** heads-up 승률 → `⛔ EXACT_EQUITY` (`exactHeadsUpEquity`). ⚠ 클래스 대 클래스 평균값은 이 저장소에 **없다** — 반드시 "이 네 장일 때"로 한정해 쓸 것 | 13 (Equity), 04 | `toolOuts` (F2B 이후 `toolEquity`) |

#### Batch I2 — 패의 종류와 무늬 (5)

| # | id / slug | Title | Search intent | Numbers needed → source | Defers to | Tool CTA |
| --- | --- | --- | --- | --- | --- | --- |
| 6 | `blog-small-pocket-pairs` / `small-pocket-pairs` | 작은 포켓페어는 좋은 패일까? | "22 33 포켓페어 좋은가" | 22·55의 등급/상위% → `⛔ HAND_RANK`, `⛔ HAND_TOP_SHARE`; 콤보 6 → `✅ HAND_COMBOS`; 첫 레이즈 자리 → `✅ RFI_POSITIONS_WITH` | 03, 04 | `range` |
| 7 | `blog-why-72o-is-weak` / `why-72o-is-weak` | 72o가 약한 이유 | "72o 최악의 패" | 72o 등급 → `⛔ HAND_RANK` (⚠ "169위"라고 **미리 쓰지 말 것** — Fact가 답하게 할 것); 첫 레이즈 자리 → `✅ RFI_POSITIONS_WITH arg="72o"` (오늘 이미 `한 자리도 없습니다`를 반환) | 04, 02 (족보로 이어지지 않는 이유) | `range` |
| 8 | `blog-why-suited-matters` / `why-suited-matters` | suited hand가 좋은 이유 | "수티드 무슨 뜻 왜 좋은가" | 같은 숫자·다른 무늬 한 쌍의 등급 차와 승률 차 → `⛔ HAND_RANK`, `⛔ HAND_EQUITY_VS_RANDOM`; 자리 차이 → `✅ RFI_POSITIONS_WITH`. **K9s/K9o는 lesson 06이 이미 쓴 예시이므로 금지** — J9s/J9o 또는 T8s/T8o를 쓸 것 | 03, 02 (플러시) | `range` |
| 9 | `blog-flush-vs-straight` / `flush-vs-straight` | 플러시와 스트레이트 중 뭐가 강할까? | "플러시 스트레이트 순서" | 순위 관계 → `⛔ CATEGORY_RANK` (`HAND_CATEGORY_INDEX`에서 파생); **"왜"에 해당하는 빈도 수(5장 기준 flush 5,108 / straight 10,200)** → `⛔ CATEGORY_FREQUENCY`, 도메인 코드 신규 필요 (§2.4) | 02 | `range` (F2C 이후 `toolHandChecker`) |
| 10 | `blog-full-house-vs-flush` / `full-house-vs-flush` | 풀하우스와 플러시 중 뭐가 강할까? | "풀하우스 플러시 어느게 높아" | 위와 동일 (`⛔ CATEGORY_RANK`, `⛔ CATEGORY_FREQUENCY`) | 02 | 위와 동일 |

#### Batch I3 — 쇼다운에서 실제로 벌어지는 일 (5)

| # | id / slug | Title | Search intent | Numbers needed → source | Defers to | Tool CTA |
| --- | --- | --- | --- | --- | --- | --- |
| 11 | `blog-same-pair-who-wins` / `same-pair-who-wins` | 같은 원페어면 누가 이길까? | "같은 페어 누가 이김" | 숫자 없음. 구체적 7장 두 벌을 `PokerCards cards="…"`로 보여주고 승패를 서술. ⚠ 서술한 승패는 반드시 `evaluateHand`/`compareHands`로 검증할 것 (에이전트가 스크립트로 확인 후 작성) | 02 (kicker 소유) | `range` (F2C 이후 `toolHandChecker`) |
| 12 | `blog-what-is-kicker` / `what-is-kicker` | kicker란? | "키커 뜻 포커" | 숫자 없음 | 02 | 위와 동일 |
| 13 | `blog-playing-the-board` / `playing-the-board` | 보드만으로 족보가 완성되면? | "보드로 승부 스플릿" | 숫자 없음. 스플릿이 되는 구체적 보드 하나 + 되지 않는 보드 하나. ⚠ 두 사례 모두 `bestFiveOf`로 검증 | 02 (split-pot 소유), 11 | 위와 동일 |
| 14 | `blog-a2345-wheel` / `a2345-wheel` | A2345는 스트레이트인가? | "A2345 스트레이트 되나" | 숫자 없음. ⚠ **NEEDS VERIFICATION**: 평가기가 A2345를 5-high 스트레이트로 처리하고 A는 위·아래 양쪽으로 쓰이되 QKA23은 스트레이트가 아니라는 것을 WP-F2A가 확인한 뒤에 쓸 것 | 02 | 위와 동일 |
| 15 | `blog-btn-why-wide` / `btn-why-wide` | BTN에서는 왜 더 많은 패를 사용할까? | "버튼 자리 왜 좋은가" | 자리별 조합 수·비율 → `Fact ✅ RFI_COMBOS`, `✅ RFI_PERCENT` (UTG vs BTN); 특정 패의 자리 → `✅ RFI_POSITIONS_WITH` | 07 (position 소유), 08 | `range` (deep link `hero=BTN`) |

#### Batch I4 — 규칙·용어·계산 (5)

| # | id / slug | Title | Search intent | Numbers needed → source | Defers to | Tool CTA |
| --- | --- | --- | --- | --- | --- | --- |
| 16 | `blog-why-blinds-exist` / `why-blinds-exist` | Big Blind는 왜 돈을 먼저 내나? | "빅블라인드 왜 내나" | 숫자 없음. 규칙 설명에 한정 — "블라인드가 없으면 아무도 먼저 걸 이유가 없다"까지가 한계선. 전략(방어 빈도 등) 금지 | 01, 08 | `range` |
| 17 | `blog-why-called-3bet` / `why-called-3bet` | 왜 3-Bet이라고 부를까? | "3벳 뜻 왜 3" | 숫자 없음. ⚠ **NEEDS VERIFICATION**: "BB 포스트가 1번째 벳"이라는 세는 관례는 이 저장소 어디에도 성문화돼 있지 않다. `docs/DECISIONS.md`에 관례로 한 줄 기록한 뒤 쓰거나, "가장 널리 쓰이는 세는 방식" 이라고 명시할 것 (CLAUDE.md 규칙 7) | 12 (three-bet 소유) | `range` |
| 18 | `blog-why-use-range` / `why-use-range` | Range를 보는 이유 | "핸드레인지 왜 필요한가" | 자리별 조합/비율 → `✅ RFI_COMBOS`, `✅ RFI_PERCENT` | 06 (range 소유) | `range` |
| 19 | `blog-pot-odds-quick` / `pot-odds-quick` | 팟오즈 쉽게 계산하기 | "팟오즈 계산법 간단" | 구체적 팟/벳에서의 필요 승률 → `⛔ POT_ODDS_REQUIRED_EQUITY` (`potOdds`, BB→milliBB 변환 명시) | 14 (pot-odds 소유) | `toolPotOdds` (deep link) |
| 20 | `blog-outs-nine` / `outs-nine` | 아웃츠 9장은 무슨 뜻일까? | "아웃츠 9장 플러시 확률" | 9 아웃의 다음 카드/리버까지 확률 → `⛔ OUTS_PROB` (`outsOdds`); 2·4 법칙의 오차 → 같은 결과의 `ruleOfTwoAndFour` | 15 (outs 소유) | `toolOuts` |

### 2.3 The three high-overlap splits (build spec §22, 70% rule)

| Pair | Lesson says | Blog says | Hand-off sentence the blog ends its intro with |
| --- | --- | --- | --- |
| L14 `pot-odds` ↔ B19 `pot-odds-quick` | 팟오즈가 **무엇을 비교하는 값인지**: 내야 하는 돈 대 최종 팟, 그래서 "콜에 필요한 최소 승률"이라는 개념이 나온다는 것. 정의·유도·용어. | 정의는 한 문장만. 나머지는 **테이블에서 3초 안에 하는 계산 절차** — 팟 대비 벳 크기 세 가지(1/2, 2/3, 팟)에 대한 필요 승률을 계산해 보여주고, 그 세 숫자를 기억 대신 도구로 확인하는 법. | "팟오즈가 정확히 무엇을 재는 값인지부터 보고 싶다면 [팟오즈 레슨]을 먼저 읽어 주세요. 여기서는 이미 알고 있다고 보고, 계산만 빠르게 합니다." |
| L15 `outs` ↔ B20 `outs-nine` | 아웃츠가 **무엇인지**: 내 패를 완성시키는 남은 카드를 세는 법, 보이지 않는 카드가 47/46장인 이유, 확률로 바꾸는 법. | 정의 없음. **한 가지 상황(플러시 드로우)만** 끝까지 판다 — 왜 하필 9장인지 13-2-2로 세어 보이고, 그 9장이 확률로 얼마가 되는지, 2·4 법칙이 실제로 얼마나 어긋나는지. | "아웃츠라는 말 자체가 처음이라면 [아웃츠 레슨]이 먼저입니다. 여기서는 9라는 숫자 하나만 끝까지 따라가 보겠습니다." |
| L06 `poker-range` ↔ B18 `why-use-range` | 레인지가 **무엇인지**: 13×13 표, 칸과 콤보, 자리에 따라 표가 달라진다는 것. (이미 발행) | 정의 없음. **"왜 하나로 찍지 않는가"라는 질문 하나**에만 답한다 — 하나로 찍었을 때 무엇이 틀리는지, 자리별 조합 수를 나란히 놓았을 때 무엇이 보이는지. 13×13 표 읽는 법은 설명하지 않는다. | "표를 읽는 법 자체가 처음이라면 [핸드레인지란?]을 먼저 보세요. 이 글은 '왜 굳이 묶어서 보나'에만 답합니다." |

Same rule, lighter form, for two more pairs: **B11 vs B12** — B12 owns "kicker가 무엇인가"
(and defers the definition itself to `term-kicker`), B11 owns "같은 원페어 상황에서 실제로
무슨 일이 일어나는가". **B9 vs B10** — B9 owns the 플러시/스트레이트 비교와 그 이유(빈도),
B10 states that reason in one sentence and links B9.

### 2.4 Engineering prerequisite — ten `Fact` names that do not exist

`src/content/facts.ts` currently exposes nine names, **none of which touch the strength
dataset, the equity engine, `potOdds`, `outsOdds`, or the category ranking.** Fifteen of the
twenty blog articles and five of the fifteen lessons cannot be written honestly without the
following. This is engineering work, not authoring work.

| Fact name | Args | Backed by | Needed by |
| --- | --- | --- | --- |
| `HAND_RANK` | hand key | `handStrengthForKey(key).rank` | B1 B3 B6 B7 B8, L04 |
| `HAND_EQUITY_VS_RANDOM` | hand key | `.equity` → `%` | B3 B4 B8, L04 L13 |
| `HAND_TOP_SHARE` | hand key | `.cumulativeShare` → `%` | B1 B3 B6, L04 |
| `HAND_AT_RANK` | rank 1–169 | `HAND_STRENGTH_BY_RANK[rank-1].key` | B1 |
| `HAND_ONE_IN_N` | hand key | `COMBO_COUNT / comboCount` | B2 |
| `EXACT_EQUITY` | hero 2장, villain 2장, board? | `parseCards` + `exactHeadsUpEquity` | B5, L13 |
| `OUTS_PROB` | outs, `FLOP`\|`TURN`, `NEXT`\|`RIVER` | `outsOdds` | B20, L15 |
| `POT_ODDS_REQUIRED_EQUITY` | pot(BB), bet(BB) | `potOdds` — **BB→milliBB 변환은 명시적으로** (CLAUDE.md 규칙 1) | B19, L14 |
| `CATEGORY_RANK` | `HandCategory` | `HAND_CATEGORY_INDEX` 서수 | B9 B10, L02 |
| `CATEGORY_FREQUENCY` | `HandCategory` | **신규 도메인 코드 필요 (아래)** | B9 B10, L02 |

**`CATEGORY_FREQUENCY` needs new domain code.** The exact 5-card table (HIGH_CARD 1,302,540
… STRAIGHT_FLUSH 40, over C(52,5)=2,598,960) exists in this repo **only as a test
expectation** at `packages/strategy-core/src/analysis/evaluateExhaustive.test.ts:17-27`.
`strategy-core` is read-only for FishTilt, so the numbers must be produced by a new
`packages/learn-core/src/handClass/categoryFrequency.ts` that enumerates C(52,5) with
`evaluateStrength` and is pinned by a test against that same published table. Do **not** let
an author type `5,108` into an MDX file.

Two further engineering notes that touch authoring:

- **`ToolCTA params` deep-linking is not read by any calculator.** `docs/FISHTILT_STATE.md`
  "Orchestrator rulings on handed-back items" #2 defers this until an article needs it.
  **Lesson 14 and blog 19 are that article.** H3/I4 must report it; they must not build it.
- **`RangeMatrixMini` cannot highlight a specific cell** (props are `positions`, `initial`,
  `showSelection`, `caption`, `className` only). A hand page that wants "여기가 이 패의
  칸입니다" needs either a new prop or the route template rendering `RangeMatrix` with
  `selectedKey` directly. §4 assumes the latter.

---

## 3. Glossary plan — 56 terms, two batches

### 3.1 Reconciliation: build spec §23 vs `registry/glossary.ts`

Eight records exist and are reused verbatim (id, slug, term, aliases, `shortDefinition`):
`term-range`, `term-suited`, `term-offsuit`, `term-pocket-pair`, `term-combo`,
`term-position`, `term-preflop`, `term-open-raise`. All are `PLANNED`; the batch that owns
each one writes its MDX and flips `status`.

§23 lists 46 names, but `content.test.ts` **forbids an alias colliding with another entry's
term or slug**, which makes three of those pairs illegal as separate entries. Merged:

| §23 names | One entry | Why |
| --- | --- | --- |
| `BB`, `Big Blind` | **Big Blind**, aliases include `BB` | `BB` would otherwise be both a term and an alias |
| `BTN`, `Button` | **Button**, aliases include `BTN` | same |
| `Out`, `Outs` | **Outs**, aliases include `Out` | same |
| `SB` | renamed **Small Blind**, alias `SB` | symmetry with Big Blind; the abbreviation stays searchable |

46 − 3 = 43. Adding the already-registered `Combo` gives 44, one below the §23 floor of 45,
so twelve terms the site's own content actually depends on are added (족보 nine categories,
스플릿, 13×13 표, HJ/CO). **Final: 56 terms, 28 per batch.**

### 3.2 Split rule

**Not alphabetical.** §23's "A–P" suggestion would separate `Offsuit` from `Suited` and
`Outs` from `Pot Odds`, which are exactly the pairs whose definitions must be written by the
same hand. The rule is:

> **J1 owns the table — the seats, the money and the actions. J2 owns the cards — the hands,
> the board and the arithmetic.** A term goes to the batch that contains every other term its
> own definition has to lean on.

Cross-batch `relatedConcepts` links are fine (ids resolve globally and `content.test.ts`
checks them); the split only groups terms whose *definitions* interlock.

### 3.3 Batch J1 — 테이블 · 돈 · 행동 (28)

| # | English | Korean title (한국어 먼저) | slug / id | Aliases (검색어) | Owning lesson | Tool |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Action | 내 차례의 행동 (Action) | `action` | 액션, 행동, 차례 | 09 | `range` |
| 2 | All-in | 가진 칩 전부 (All-in) | `all-in` | 올인, 올 인, all in, 다이렉트 | 09 | `range` |
| 3 | Ante | 모두가 내는 참가비 (Ante) | `ante` | 앤티, 안테, 앤티비 | 01 | `range` |
| 4 | Blind | 강제로 내는 돈 (Blind) | `blind` | 블라인드, 블라인드 베팅, 강제 베팅 | 01 | `range` |
| 5 | Big Blind | 빅 블라인드 (BB) | `big-blind` | BB, 빅블라인드, 빅블, 빅 블라인드 | 08 | `range` |
| 6 | Small Blind | 스몰 블라인드 (SB) | `small-blind` | SB, 스몰블라인드, 스몰블, 스몰 블라인드 | 08 | `range` |
| 7 | Button | 버튼 (BTN) | `button` | BTN, 버튼, 딜러 버튼, dealer button, 딜러버튼 | 08 | `range` |
| 8 | Cutoff | 컷오프 (CO) | `cutoff` | CO, 컷오프, 컷 오프, 커트오프 | 08 | `range` |
| 9 | Hijack | 하이잭 (HJ) | `hijack` | HJ, 하이잭, 하이재크, 하이젝 | 08 | `range` |
| 10 | UTG | 첫 번째 자리 (UTG) | `utg` | 언더더건, 언더 더 건, under the gun, 유티지 | 08 | `range` |
| 11 | Position | 내 차례가 오는 자리 (Position) | `position` **(기존)** | 포지션, 자리, 자리 순서 | 07 | `range` |
| 12 | Stack | 내 앞의 칩 (Stack) | `stack` | 스택, 칩, 남은 칩, 스텍 | 01 | `range` |
| 13 | Pot | 판에 쌓인 돈 (Pot) | `pot` | 팟, 폿, 판돈, 팟사이즈 | 01 | `toolPotOdds` |
| 14 | Check | 돈을 걸지 않고 넘기기 (Check) | `check` | 체크, 첵 | 09 | `range` |
| 15 | Call | 같은 금액 맞추기 (Call) | `call` | 콜, 코울 | 09 | `toolPotOdds` |
| 16 | Bet | 처음 돈을 거는 것 (Bet) | `bet` | 베팅, 벳, 배팅, 벧 | 09 | `range` |
| 17 | Raise | 금액을 올리기 (Raise) | `raise` | 레이즈, 레이스, 레이지 | 09 | `range` |
| 18 | Fold | 패를 접는 것 (Fold) | `fold` | 폴드, 다이, 죽기, 폴딩 | 09 | `range` |
| 19 | Open Raise | 아무도 들어오지 않았을 때 처음 거는 레이즈 (Open Raise) | `open-raise` **(기존)** | 오픈 레이즈, 오픈레이즈, 오픈, 첫 레이즈 | 10 | `range` |
| 20 | Limp | 레이즈 없이 최소 금액만 맞춰 들어가기 (Limp) | `limp` | 림프, 림핑, 리핑, 절뚝 | 10 | `range` |
| 21 | 3-Bet | 다시 거는 세 번째 레이즈 (3-Bet) | `three-bet` | 3벳, 쓰리벳, 쓰리 벳, 3-bet, 3bet, 삼벳 | 12 | `range` |
| 22 | 4-Bet | 그 다음 레이즈 (4-Bet) | `four-bet` | 4벳, 포벳, 포 벳, 4-bet, 4bet | 12 | `range` |
| 23 | C-Bet | 앞선 공격자가 이어서 거는 베팅 (C-Bet) | `c-bet` | 씨벳, 시벳, cbet, continuation bet, 컨티뉴에이션 벳 | 11 | `range` |
| 24 | Bluff | 약한 패로 거는 베팅 (Bluff) | `bluff` | 블러프, 블러핑, 뻥카 | 09 | `range` |
| 25 | Heads-Up | 둘만 남은 상황 (Heads-Up) | `heads-up` | 헤즈업, 헤드업, heads up, 1대1, 일대일 | 13 | `toolOuts` |
| 26 | Showdown | 카드를 열어 승부를 가리는 순간 (Showdown) | `showdown` | 쇼다운, 쇼 다운, 카드 공개 | 01 | `range` |
| 27 | VPIP | 판에 자발적으로 들어간 비율 (VPIP) | `vpip` | 브이핍, 자발적 참여율, voluntarily put in pot | 10 | `range` |
| 28 | PFR | 프리플랍에서 레이즈한 비율 (PFR) | `pfr` | 피에프알, 프리플랍 레이즈율, preflop raise | 10 | `range` |

### 3.4 Batch J2 — 카드 · 족보 · 확률 (28)

| # | English | Korean title | slug / id | Aliases | Owning lesson | Tool |
| --- | --- | --- | --- | --- | --- | --- |
| 29 | Hand | 내가 들고 있는 패 (Hand) | `hand` | 핸드, 패, 내 패, 손패 | 03 | `range` |
| 30 | Board | 테이블 가운데 깔린 카드 (Board) | `board` | 보드, 판, 공용 카드판 | 11 | `toolOuts` |
| 31 | Community Cards | 모두가 같이 쓰는 카드 (Community Cards) | `community-cards` | 커뮤니티 카드, 공용카드, 공용 카드, 공통 카드 | 11 | `toolOuts` |
| 32 | Preflop | 공용 카드가 열리기 전 (Preflop) | `preflop` **(기존)** | 프리플랍, 프리플롭, 프리플럽 | 10 | `range` |
| 33 | Flop | 처음 열리는 공용 카드 세 장 (Flop) | `flop` | 플랍, 플롭, 플럽 | 11 | `toolOuts` |
| 34 | Turn | 네 번째 공용 카드 (Turn) | `turn` | 턴, 네번째 카드, 네 번째 카드 | 11 | `toolOuts` |
| 35 | River | 마지막 공용 카드 (River) | `river` | 리버, 마지막 카드, 리바 | 11 | `toolOuts` |
| 36 | Hand Ranking | 패의 순서, 족보 (Hand Ranking) | `hand-ranking` | 족보, 핸드 랭킹, 핸드랭킹, hand rankings, 패의 순위 | 02 | `range` |
| 37 | High Card | 아무것도 만들어지지 않은 패 (High Card) | `high-card` | 하이카드, 하이 카드, 노페어, 탑카드 | 02 | `range` |
| 38 | Pocket Pair | 같은 숫자 두 장 (Pocket Pair) | `pocket-pair` **(기존)** | 포켓 페어, 포켓페어, 같은 숫자 두 장 | 03 | `toolStartingHand`* |
| 39 | Two Pair | 두 쌍 (Two Pair) | `two-pair` | 투페어, 투 페어, 쓰리페어 아님 | 02 | `range` |
| 40 | Three of a Kind | 같은 숫자 세 장 (Three of a Kind) | `three-of-a-kind` | 트리플, 쓰리카드, 셋, set, trips, 트립스 | 02 | `range` |
| 41 | Straight | 숫자가 연달아 다섯 장 (Straight) | `straight` | 스트레이트, 스트레잇, 줄, 스트레이트빨 | 02 | `range` |
| 42 | Flush | 같은 무늬 다섯 장 (Flush) | `flush` | 플러시, 플러쉬, 플러시빨 | 02 | `toolOuts` |
| 43 | Full House | 셋과 페어를 함께 (Full House) | `full-house` | 풀하우스, 풀 하우스, 풀, 풀하 | 02 | `range` |
| 44 | Straight Flush | 같은 무늬로 연달아 다섯 장 (Straight Flush) | `straight-flush` | 스트레이트플러시, 스트레이트 플러시, royal flush, 로열 플러시, 로티플 | 02 | `range` |
| 45 | Kicker | 순위를 가르는 옆 카드 (Kicker) | `kicker` | 키커, 킥커, 옆 카드 | 02 | `range` |
| 46 | Split Pot | 팟을 나눠 갖는 것 (Split Pot) | `split-pot` | 스플릿, 스플릿 팟, 찹, chop, 팟 분배 | 02 | `range` |
| 47 | Suited | 같은 무늬 (Suited) | `suited` **(기존)** | 수티드, 수딧, 같은 무늬 | 03 | `toolStartingHand`* |
| 48 | Offsuit | 다른 무늬 (Offsuit) | `offsuit` **(기존)** | 오프수트, 오프숱, 다른 무늬 | 03 | `toolStartingHand`* |
| 49 | Combo | 무늬까지 따진 한 가지 조합 (Combo) | `combo` **(기존)** | 콤보, 조합 | 05 | `toolStartingHand`* |
| 50 | Range | 패의 묶음 (Range) | `range` **(기존)** | 레인지, 핸드레인지, 핸드 레인지, 패의 범위 | 06 | `range` |
| 51 | Hand Matrix | 13×13 표 (Hand Matrix) | `hand-matrix` | 핸드 매트릭스, 13x13, 13×13 표, 레인지 차트, 레인지표 | 05 | `range` |
| 52 | Draw | 아직 완성되지 않은 패 (Draw) | `draw` | 드로우, 드로, 드로잉, 기다리는 패 | 15 | `toolOuts` |
| 53 | Outs | 내 패를 완성시키는 남은 카드 (Outs) | `outs` | Out, 아웃, 아웃츠, 아웃 카드, 아웃수 | 15 | `toolOuts` |
| 54 | Equity | 내 승률 (Equity) | `equity` | 에퀴티, 이쿼티, 승률, 내 승률, 이길 확률 | 13 | `toolOuts` |
| 55 | Pot Odds | 콜 값어치 (Pot Odds) | `pot-odds` | 팟오즈, 팟 오즈, 폿오즈, 팟 확률, pot odds | 14 | `toolPotOdds` |
| 56 | Nuts | 그 보드에서 나올 수 있는 가장 강한 패 (Nuts) | `nuts` | 넛, 넛츠, 너츠, 최강패 | 02 | `range` |

`*` `toolStartingHand` is `available: false` until WP-E2. These entries may list it in
`relatedTools` (the floor needs one tool id, and the id resolves), but if E2 has not landed
when J2 runs, use `range` instead so the rendered CTA is a live link.

### 3.5 Terms whose honest definition would require strategy claims

Nine entries. **Define the observable thing; never the advice.**

| Term | The trap | Write it this way instead |
| --- | --- | --- |
| Bluff | "약한 패로 상대를 접게 만드는 기술" invites frequency/EV claims. | "지금 열면 이길 수 없는 패로 거는 베팅을 말합니다." Stop. No "언제 해야 하는가". |
| C-Bet | Its whole literature is frequency. FishTilt ships no postflop data. | "프리플랍에서 마지막으로 레이즈한 사람이 플랍에서도 이어서 거는 베팅을 부르는 이름입니다." Add: "얼마나 자주 하는 것이 좋은지는 이 사이트가 다루지 않습니다." |
| 3-Bet / 4-Bet | "3벳 레인지는 이렇다" — no such dataset exists (settled decision 2). | Counting convention only. Explicitly: "3벳 상황의 표는 아직 준비 중입니다." |
| Limp | Universally described as a mistake. That is a strategy claim. | "레이즈하지 않고 빅 블라인드와 같은 금액만 맞춰 들어가는 것을 말합니다." No verdict. |
| VPIP / PFR | These are opponent-profiling statistics; FishTilt has no player data surface at all. | Define as "무엇을 세는 숫자인지" and state plainly that FishTilt does not compute or track it. Do not give "good" ranges. |
| Nuts | Slides into "so you should…". | "그 보드에서 만들 수 있는 가장 강한 패를 말합니다." Then link lesson 02. |
| Position | Registered `shortDefinition` already hits the right note ("늦게 행동할수록 앞사람들의 선택을 보고 결정할 수 있습니다") — a mechanical fact, not advice. | Keep at that level. |
| Equity | "에퀴티가 높으니 콜해야 한다". | "지금 이 패가 끝까지 갔을 때 이길 확률입니다." Decision-making belongs to lesson 14. |
| Ante | Rules vary by site; FishTilt has no site knowledge (CLAUDE.md rule 10). | "게임에 따라 참가자 전원이 매 판 내는 소액의 강제 베팅입니다. 앤티가 있는 게임도, 없는 게임도 있습니다." |

---

## 4. Priority hand pages — twenty

Route `/hands/<slug>`; MDX at `apps/fishtilt/content/hands/<slug>.mdx`; record kind `hands`
with `handKey`. `hand-aks` and `hand-ako` **already exist** — reuse their ids, slugs, titles
and relations. The other eighteen are new.

| slug | handKey | id | Existing? |
| --- | --- | --- | --- |
| `aa` `kk` `qq` `jj` `tt` `99` `88` `77` `22` | `AA` `KK` `QQ` `JJ` `TT` `99` `88` `77` `22` | `hand-aa` … `hand-22` | new |
| `aks` | `AKs` | `hand-aks` | **exists** |
| `ako` | `AKo` | `hand-ako` | **exists** |
| `aqs` `aqo` `ajs` `kqs` `kjs` `qjs` `jts` `t9s` `a5s` | `AQs` `AQo` `AJs` `KQs` `KJs` `QJs` `JTs` `T9s` `A5s` | `hand-aqs` … `hand-a5s` | new |

### 4.1 What the shared template may show — computed vs opinion

The template is TypeScript, so it calls `learn-core` **directly**; it needs no new `Fact`
names. Only numbers appearing inside Korean MDX sentences need one.

| Datum | Source | Computed? |
| --- | --- | --- |
| 실제 카드 두 장 | `handClassFactsForKey(key).exampleCards` → `<PokerCards hand="AA" />` | ✅ |
| 한국어 읽기 (`AKs · 에이스 킹 수티드`) | `handClassReading` / `describeHandClassKorean` (`features/range/copy.ts`) | ✅ (settled decision 8) |
| 종류 (페어 / 같은 무늬 / 다른 무늬) | `.kind` | ✅ |
| 콤보 수 (6 / 4 / 12) | `.comboCount` | ✅ |
| 전체 1326 중 비중 | `.universeShare` | ✅ |
| 13×13에서의 위치 | `handStrengthForKey(key).classIndex` + `RangeMatrix selectedKey` | ✅ (`RangeMatrixMini`로는 불가 — §2.4) |
| 강도 순위 1–169 | `handStrengthForKey(key).rank` | ✅ |
| 무작위 상대 대비 승률 | `.equity` | ✅ |
| 상위 X% | `.cumulativeShare` | ✅ (`rank/169`이 **아님**) |
| 측정 방법 한 줄 | `HAND_STRENGTH_RANK_BASIS` + 레슨 04 링크 | ✅ |
| 첫 레이즈로 쓰이는 자리 | `Fact ✅ RFI_POSITIONS_WITH` | ✅ (조건 라벨 필수) |
| **"좋은 패다 / 나쁜 패다"** | — | ⛔ **금지** |
| **"이 패는 수익이 난다"** | — | ⛔ 금지 (0.10) |
| **"항상 / 반드시 레이즈"** | — | ⛔ 금지 |
| **"A5s는 블러프에 좋다"류의 용도 설명** | — | ⛔ 금지 (postflop 데이터 없음) |
| **3벳/콜 여부** | — | ⛔ 금지 (해당 데이터셋 없음, settled decision 2) |

### 4.2 Fixed section order (build spec §15), identical on all twenty

1. `<PokerCards hand="…" />` — 실제 카드 + 한국어 읽기
2. **한 줄 답** — 이 패가 무엇인지 한 문장 (MDX 첫 단락, 제목 반복 금지)
3. `## 이 패는 어떤 패인가요` — 종류, 콤보 수, 전체 중 비중 (`Fact`)
4. `## 13×13 표에서는 여기입니다` — 위치, 대각선 기준 설명은 **레슨 05로 링크**
5. `## 얼마나 강한가요` — 순위 · 상위 % · 무작위 상대 대비 승률 + **측정 기준 한 문장 + 레슨 04 링크 + 0.10 경고 한 줄**
6. `## 어느 자리에서 처음 레이즈에 쓰이나요` — `RFI_POSITIONS_WITH` + `학습용 기본 레인지` 조건 라벨
7. `<ToolCTA />` — §37이 요구하는 도구 (아래)
8. `## 같이 보면 좋은 핸드` — `relatedHands` (최소 1)
9. `## 자주 묻는 것` — **진짜 질문이 있을 때만.** 없으면 이 섹션을 통째로 생략한다 (§15 "if genuinely useful"). 채우기용 FAQ 금지

Minimum: 600 prose 자, 3 `##` 섹션, 1 구성요소, 1 `relatedTools`, 1 `relatedConcepts`.
Sections 3–6 give four, so the floor is met without padding.

§37 demands Starting Hand Explorer + Equity Tool + a related hand on every hand page. Both
tools are `available: false` today: list `toolStartingHand` and `toolEquity` in
`relatedTools` (ids resolve, `ToolCTA` degrades to non-link), but the **in-prose CTA** must
point at `range` until WP-E2/WP-F2B land. Re-point it in the same pass that flips those
routes.

---

## 5. Internal-link graph rules (build spec §37)

| Page type | Minimum outbound |
| --- | --- |
| Learn | ≥1 `relatedTools`, ≥2 `relatedConcepts`, ≥1 `nextLessons`/`relatedArticles`, and — for lessons 02–15 — ≥1 `prerequisites`. Plus **a `<ToolCTA>` in the prose itself**, mid-article, not only in the footer relations. |
| Blog | ≥1 lesson (via `nextLessons`), ≥1 `relatedTools`, ≥1 `relatedConcepts`. |
| Glossary | ≥1 `relatedConcepts`, ≥1 `relatedTools`, and `nextLessons` pointing at its owning lesson from §3.3/§3.4. |
| Hands | `toolStartingHand` + `toolEquity` in `relatedTools`, ≥1 `relatedHands`, ≥1 `relatedConcepts`. |

Six additional rules, all test-enforced or review-enforced:

1. **No page renders a link to a route whose `routes.ts` entry is `available: false`.** Use
   `ToolCTA`, never a raw `<a>` — it consults `toolHref`, which returns `null` and degrades
   to non-interactive text. Never hard-code a path in prose.
2. **No page renders a link to a `PLANNED` record.** `hrefOfContent` returns `null` and
   `RelatedContent` shows 준비 중. Listing a `PLANNED` id in a relation is correct and
   expected; writing `[여기](/blog/qq-vs-ak)` by hand is not.
3. **A prerequisite always sits earlier in the curriculum.** Enforced.
4. **No orphan core route.** Every lesson is on the `/learn` roadmap by construction; every
   blog article is reachable from at least one lesson's `relatedArticles`; every glossary
   term is reachable from at least one `relatedConcepts`; every hand page from at least one
   lesson's or blog's `relatedHands`. **If your batch adds a record, you must also add the
   inbound edge** — otherwise it is reachable only from `/blog` and `/glossary` index pages.
5. **Relation headings are fixed** by `RELATION_HEADING` in `graph.ts`. Do not restate them
   as `##` headings in prose.
6. **Cross-batch edges are allowed and encouraged**; ids resolve globally. But you may only
   *write* records in your own registry file (§7).

---

## 6. Beginner language contract

### 6.1 The jargon gloss (build spec §48)

Every term below gets 한국어 먼저, 괄호 안에 원어 **on first use in that file** — the pattern
is `버튼(BTN)`, `내 승률(Equity)`. After the first use, the short form alone is fine.
Where a glossary entry exists, the first use is a `<Term>` (which satisfies the gloss and
also gives the popover) — remember 0.5: at most once per file.

| Must be glossed on first use | Gloss to use |
| --- | --- |
| Equity | 내 승률(Equity) |
| Range | 패의 묶음(Range) / 핸드레인지 |
| Position | 자리(Position) |
| UTG | 첫 번째 자리(UTG) |
| HJ | 하이잭(HJ) |
| CO | 컷오프(CO) |
| BTN | 버튼(BTN) |
| SB | 스몰 블라인드(SB) |
| BB | 빅 블라인드(BB) |
| Suited | 같은 무늬(Suited) |
| Offsuit | 다른 무늬(Offsuit) |
| Outs | 남은 좋은 카드(Outs) |
| Pot Odds | 콜 값어치(Pot Odds) |
| 3-Bet | 다시 거는 레이즈(3-Bet) |
| C-Bet | 이어서 거는 베팅(C-Bet) |
| Preflop | 공용 카드가 열리기 전(Preflop) |
| Combo | 무늬까지 따진 조합(Combo) |
| Kicker | 순위를 가르는 옆 카드(Kicker) |
| RFI | **쓰지 말 것.** "아무도 참여하지 않았을 때"로 풀어 쓴다 |
| EV, SPR | **쓰지 말 것.** MVP에 해당 데이터가 없다 |

Hand-class notation (`AKs`, `72o`) and rank/suit letters stay Latin (ADR-0053); what is added
is the spoken Korean reading beside them (`AKs · 에이스 킹 수티드`, settled decision 8), which
`handClassReading` produces.

### 6.2 Banned constructions

| Banned | Why | Do instead |
| --- | --- | --- |
| `이 글에서는 ~을 알아보겠습니다` / `~에 대해 살펴보겠습니다` | AI filler; says nothing. | 첫 문장이 곧 답이다. Blog §20 구조: "먼저 답부터". |
| `포커를 처음 시작하신 분이라면 …` 로 시작하는 도입 | Twenty articles opening identically. | 질문에 바로 답한다. |
| `안녕하세요` / `오늘은` / `함께 알아볼까요?` | 블로그 톤 필러. | 삭제. |
| 같은 도입 문단을 여러 글에 재사용 | §18 "중복 intro 금지". | 각 글의 첫 문단은 그 글에서만 통한다. |
| `~라고 할 수 있습니다` / `~인 셈입니다` 남발 | 단정을 피하는 흐릿한 문장. | 단정하거나, 모른다고 쓴다. |
| `결론적으로` 로 시작하는 마지막 문단 | 요약을 위한 요약. | 다음 단계 링크로 끝낸다. |
| **`이 패는 수익성이 있습니다` / `이득입니다` / `플러스 EV입니다`** | 강도 숫자는 카드의 성질이지 수익의 근거가 아니다 (0.10). | "이 기준에서 N위입니다" 까지만. |
| **`항상` / `무조건` / `반드시 ~해야 합니다`** | 조건 없는 규칙 = 지어낸 전략. | "이 표는 6인·100BB·아무도 참여하지 않았을 때 기준입니다" |
| **`GTO`** | Settled decision 3. | `학습용 기본 레인지` |
| **숫자를 직접 타이핑하기** (`1,326가지`, `9장`, `169위`) | 0.1. | `<Fact />` |
| **없는 데이터를 있는 것처럼** (3벳 레인지 표, 포스트플랍 빈도, 스택 100BB 외) | CLAUDE.md 규칙 5, settled decision 2·4. | "아직 준비 중입니다" 라고 쓴다. |

### 6.3 Sentence-level tone (build spec §19)

Bad: `Range advantage allows a higher c-bet frequency.`
Good: `내가 강한 패를 더 많이 가질 수 있는 보드라면 상대보다 먼저 베팅하기 편한 경우가 있습니다.`

But: **do not force an advanced postflop sentence into an MVP article at all.** §19's own
closing rule — 모르는 걸 가르치는 척하지 않는다 — outranks the rewrite.

---

## 7. Per-batch author briefs

Each block is self-contained. Paste one into one agent. Every agent additionally reads:
`CLAUDE.md`, §0, §5 and §6 of this file, `apps/fishtilt/content/learn/poker-range.mdx` (tone
and structure reference), `src/content/allowList.ts`, `src/lib/routes.ts`.

> **Prerequisite for all nine: WP-G2 must have split the per-batch registry files AND the
> per-kind MDX component maps.** `src/content/lessons.ts` is today a single `LESSON_MDX` map;
> if it is not split into `lessons/{h1,h2,h3}.ts` (and equivalents for blog/glossary/hands),
> H1/H2/H3 all write the same file and must run **serially**, not in parallel. Flagged to the
> orchestrator in the return note.

Path conventions used below (WP-G2 to confirm the exact names):
`registry/learn/<batch>.ts`, `registry/blog/<batch>.ts`, `registry/glossary/<batch>.ts`;
MDX map `src/content/<kind>/<batch>.ts`; prose `apps/fishtilt/content/<kind>/<slug>.mdx`.

---

### H1 — Learn lessons 01–05 (foundations)

**Writes:** `content/learn/{holdem-basics,hand-rankings,starting-hands,starting-hand-ranking,hand-matrix}.mdx`; its own registry slice for those five records (flip `PLANNED`→`PUBLISHED`, set `readMinutes`, `indexable: true`); its own MDX-map slice.
**Owns:** lessons 01 02 03 04 05, and the concepts in §1.4 rows 1–5.
**Must NOT re-explain:** 핸드레인지 (06 owns it — `<Term id="term-range">`), 포지션·자리 이름 (07/08), 행동 (09), 프리플랍 (10), Equity·팟오즈·아웃츠 (13/14/15). One sentence plus a link, never a paragraph.
**Registry amendment you own:** none.
**Blocked on:** `Fact` names `HAND_RANK`, `HAND_EQUITY_VS_RANDOM`, `HAND_TOP_SHARE`, `CATEGORY_RANK`, `CATEGORY_FREQUENCY` (§2.4) — lessons 02 and 04 cannot be finished without them. Report, do not implement.
**Tool CTAs:** `range`, `toolPotOdds`, `toolOuts` only. `toolHandChecker`/`toolStartingHand`/`practice` may sit in `relatedTools`.
**Checklist:** ☐ 5 MDX files ☐ each ≥1500 prose 자, ≥4 `##`, ≥2 distinct components, one `<ToolCTA>` mid-article, one `<MiniQuiz>` ☐ every `<Term>` id declared in `relatedConcepts`, each used once ☐ no typed numbers ☐ no "GTO" ☐ `pnpm vitest run --project fishtilt -t content` green ☐ report `docs/reports/WP_H1_LEARN_FOUNDATIONS.md`.

---

### H2 — Learn lessons 07–10 (position, actions, preflop) — **four lessons, not five**

**Writes:** `content/learn/{position,positions-6max,poker-actions,preflop}.mdx` + its registry slice + MDX-map slice.
**Owns:** lessons 07 08 09 10, concepts in §1.4 rows 7–10.
**Lesson 06 `poker-range` is already PUBLISHED.** Do not touch its MDX or its record. Link to it.
**Registry amendment you own:** lesson 09's `title` and `description` (§1.1 R3) — there are **five** named actions (체크·베팅·콜·레이즈·폴드), not four. Rewrite both fields.
**Must NOT re-explain:** 족보 (02), 시작 패 표기 (03), 강도 순위 (04), 13×13 읽는 법 (05), 레인지 (06), 3-Bet (12), Equity/팟오즈/아웃츠 (13/14/15).
**Tool CTAs:** `range` (live, and the natural one for 07/08/10), `toolPotOdds` for 09.
**Range honesty:** every `RangeMatrixMini` carries its conditions. BB has no first-in range — explain why rather than showing an error (settled decision 2).
**Checklist:** same as H1, plus ☐ lesson 09 registry copy corrected ☐ report `docs/reports/WP_H2_LEARN_RANGE_POSITION.md`.

---

### H3 — Learn lessons 11–15 (streets, 3-Bet, the maths)

**Writes:** `content/learn/{flop-turn-river,three-bet,equity,pot-odds,outs}.mdx` + registry slice + MDX-map slice.
**Owns:** lessons 11 12 13 14 15, concepts in §1.4 rows 11–15.
**Must NOT re-explain:** 족보 (02), 시작 패 (03/04), 13×13 (05), 레인지 (06), 포지션 (07/08), 행동 (09), 프리플랍 (10).
**Hard constraints:**
- Lesson 12 (3-Bet) **must not show a 3-bet range chart.** No such dataset exists (settled decision 2). Say 아직 준비 중.
- Lesson 13's tool is `toolEquity`, which is `available: false`. In-prose CTA falls back to `toolOuts`; keep `toolEquity` in `relatedTools`.
- Lesson 14 needs `<ToolCTA tool="toolPotOdds" params={{…}} />`. **The calculator does not read URL params yet.** Write the CTA; report the gap; do not build it.
**Blocked on:** `Fact` names `EXACT_EQUITY`, `POT_ODDS_REQUIRED_EQUITY`, `OUTS_PROB` (§2.4).
**Checklist:** same as H1, plus ☐ deep-link gap reported ☐ report `docs/reports/WP_H3_LEARN_MATH_ACTIONS.md`.

---

### I1 — Blog 1–5 (시작 패 강도)

**Writes:** `content/blog/{next-best-after-aa,how-often-aa,is-ak-good,aks-vs-ako,qq-vs-ak}.mdx`; registers 4 new `BlogRecord`s in its own registry slice and flips the existing `blog-aks-vs-ako`; MDX-map slice.
**Owns:** exactly the five rows in §2.2/I1, with the ids and slugs given there.
**Must NOT re-explain:** 강도 측정 방식 (lesson 04 owns it — one sentence + link), s/o 표기법 (03), 13×13 (05), 레인지 (06), Equity (13).
**Numbers:** only from §2.2/I1's source column. **Nothing about "이 패는 좋다/수익이 난다"** — you may state 순위, 상위 %, 무작위 상대 대비 승률, 콤보 수, 그리고 어느 첫-레이즈 자리에 들어 있는지. That is the whole list.
**Blocked on:** `HAND_AT_RANK`, `HAND_RANK`, `HAND_TOP_SHARE`, `HAND_EQUITY_VS_RANDOM`, `HAND_ONE_IN_N`, `EXACT_EQUITY` (§2.4). Four of five articles are blocked.
**Article #5 special rule:** class-vs-class equity does not exist. Fix four concrete cards, compute with `EXACT_EQUITY`, and say in the sentence that this is those exact four cards. Show both a suited and an offsuit AK case; they differ.
**Structure (§20):** 질문 제목 → 먼저 답부터 → 시각 예제 → 왜 → 자주 헷갈리는 부분 → 도구 CTA → 이어서 읽을 레슨.
**Checklist:** ☐ 5 MDX ☐ each ≥900 자, ≥3 `##`, ≥1 component, ≥1 tool, ≥1 next step, ≥1 concept ☐ inbound edge added from at least one lesson's `relatedArticles` ☐ no duplicate intro across your five ☐ report `docs/reports/WP_I1_BLOG_STARTING_HANDS.md`.

---

### I2 — Blog 6–10 (무늬와 족보)

**Writes:** `content/blog/{small-pocket-pairs,why-72o-is-weak,why-suited-matters,flush-vs-straight,full-house-vs-flush}.mdx` + registry slice (5 new records) + MDX-map slice.
**Owns:** the five rows in §2.2/I2.
**Must NOT re-explain:** 족보 자체 (lesson 02), suited/offsuit 정의 (03 + `term-suited`), 강도 측정 방식 (04), 콤보 (05).
**Hard constraints:**
- Article #8 **must not** use K9s/K9o — lesson 06's published prose already uses that exact pair. Use J9s/J9o or T8s/T8o.
- Article #7 must not assert "169위" before the Fact computes it.
- Articles #9 and #10 are entirely blocked on `CATEGORY_FREQUENCY` (new domain code, §2.4) for their "왜" half. Their ordering half (`CATEGORY_RANK`) is a rule fact. If the frequency work has not landed, write the ordering and report the gap — do not type 5,108.
**Checklist:** same as I1 ☐ report `docs/reports/WP_I2_BLOG_HAND_TYPES.md`.

---

### I3 — Blog 11–15 (쇼다운에서 벌어지는 일)

**Writes:** `content/blog/{same-pair-who-wins,what-is-kicker,playing-the-board,a2345-wheel}.mdx` (4 new) and flips the existing `blog-btn-why-wide` (`content/blog/btn-why-wide.mdx`) + registry slice + MDX-map slice.
**Owns:** the five rows in §2.2/I3.
**Must NOT re-explain:** 족보 순서 (02), kicker의 정의 자체 (`term-kicker` + 02), 포지션 (07), 레인지 (06).
**Hard constraints:**
- #11 #13 #14 make claims about who wins. **Verify every one with a throwaway script calling `evaluateHand`/`bestFiveOf`/`compareHands` before writing the sentence.** Put the script's output in your report. Do not reason it out by hand.
- #14 is `NEEDS VERIFICATION`: confirm with WP-F2A (or your own script) that the evaluator scores A2345 as a 5-high straight and that QKA23 is not a straight, before asserting either.
- #11 vs #12 split: #12 owns "키커가 무엇인가", #11 owns "같은 원페어일 때 실제로 무슨 일이 일어나는가". Neither repeats the other's half.
- #15 reuses the **registered** title "BTN에서는 왜 더 많은 패를 사용할까?"; do not rename it.
**Tool CTAs:** `toolHandChecker` is `available: false` — put it in `relatedTools`, use `range` in prose.
**Checklist:** same as I1, plus ☐ evaluator verification output pasted into the report ☐ report `docs/reports/WP_I3_BLOG_SHOWDOWN.md`.

---

### I4 — Blog 16–20 (규칙 · 용어 · 계산)

**Writes:** `content/blog/{why-blinds-exist,why-called-3bet,why-use-range,pot-odds-quick}.mdx` (4 new) and flips the existing `blog-outs-nine` (`content/blog/outs-nine.mdx`) + registry slice + MDX-map slice.
**Owns:** the five rows in §2.2/I4.
**Must NOT re-explain:** 블라인드 구조 (01/08), 3-Bet 개념 (12), 레인지 (06), 팟오즈 정의 (14), 아웃츠 정의 (15). Three of your five sit directly on top of a lesson — **use the exact hand-off sentences in §2.3.**
**Hard constraints:**
- #17 is `NEEDS VERIFICATION`: the "BB 포스트가 첫 번째 벳" counting convention is not written down anywhere in this repository. Either get it recorded in `docs/DECISIONS.md` first, or phrase it as "가장 널리 쓰이는 세는 방식" and say so explicitly (CLAUDE.md rule 7).
- #16 stays in rules territory. No 방어 빈도, no 수익성.
- #19 and #20 are blocked on `POT_ODDS_REQUIRED_EQUITY` and `OUTS_PROB` (§2.4).
- #19's money values go through the BB→milliBB conversion the Fact performs. Never write a money arithmetic result into prose yourself (CLAUDE.md rule 1).
**Checklist:** same as I1, plus ☐ §2.3 hand-off sentences used verbatim in #18/#19/#20 ☐ report `docs/reports/WP_I4_BLOG_RULES_AND_MATH.md`.

---

### J1 — Glossary, 테이블 · 돈 · 행동 (28 terms)

**Writes:** `content/glossary/<slug>.mdx` for the 28 slugs in §3.3 + its registry slice (26 new records; `position` and `open-raise` already exist — flip them, do not duplicate) + MDX-map slice.
**Owns:** exactly §3.3. Do not write any term from §3.4.
**Per-entry shape (§23):** `koreanName`(=`title`, 한국어 먼저 · 원어 괄호) · `englishName`(=`term`) · `aliases` (use the ones listed; add only if genuinely searched) · `shortDefinition` (registry, one line, what the popover shows) · 본문: 쉬운 설명 → 예 → 관련.
**Must NOT re-explain:** 카드·족보·확률 쪽 용어 (J2's). Link with `relatedConcepts` instead.
**Strategy-claim traps:** Bluff, C-Bet, 3-Bet, 4-Bet, Limp, VPIP, PFR — follow §3.5 exactly.
**Alias discipline:** an alias must be unique across the **whole** glossary and must never equal another entry's `term` or `slug`. `BB`→Big Blind, `BTN`→Button, `SB`→Small Blind are aliases, not entries. Coordinate nothing with J2 — the lists are disjoint by construction; the test will catch any accident.
**Floors:** ≥400 prose 자, ≥2 `##`, ≥1 `relatedTools`, ≥1 `relatedConcepts`. Components optional (floor is 0) but a `<Callout>` or `<PokerCards>` where it genuinely helps is welcome.
**Checklist:** ☐ 28 MDX ☐ every entry has a one-line `shortDefinition` ☐ aliases unique ☐ each links its owning lesson from §3.3 ☐ no strategy claim, no frequency, no number typed ☐ `pnpm vitest run --project fishtilt -t glossary` green ☐ report `docs/reports/WP_J1_GLOSSARY_A.md`.

---

### J2 — Glossary, 카드 · 족보 · 확률 (28 terms)

**Writes:** `content/glossary/<slug>.mdx` for the 28 slugs in §3.4 + its registry slice (22 new; `preflop`, `pocket-pair`, `suited`, `offsuit`, `combo`, `range` already exist — flip them, do not duplicate) + MDX-map slice.
**Owns:** exactly §3.4. Do not write any term from §3.3.
**Must NOT re-explain:** 자리 이름, 블라인드, 행동, 3-Bet (J1's). Link instead.
**Strategy-claim traps:** Nuts, Equity — §3.5.
**Hard constraints:**
- Nine 족보 terms (36–44) must agree with `HAND_CATEGORIES` and its ordering. There is no separate `ROYAL_FLUSH` category in this repo — 로열 플러시는 스트레이트 플러시 중 가장 높은 것으로 설명하고, `royal flush`/`로열 플러시`는 `straight-flush`의 alias로 둔다.
- `term-range`, `term-suited`, `term-offsuit`, `term-pocket-pair`, `term-combo` are already referenced by the **published** lesson 06 through `<Term>`. Their `shortDefinition` is what that lesson's popover renders — **do not change those five `shortDefinition` strings**; write the longer MDX around them.
- Terms 52–55 (Draw, Outs, Equity, Pot Odds) are the entry points to the calculators. Their `relatedTools` are live routes (`toolOuts`, `toolPotOdds`) — use them.
**Floors:** as J1.
**Checklist:** ☐ 28 MDX ☐ the five published-lesson `shortDefinition`s untouched ☐ aliases unique ☐ 족보 순서가 `HAND_CATEGORIES`와 일치 ☐ report `docs/reports/WP_J2_GLOSSARY_B.md`.

---

## 8. Everything marked NEEDS VERIFICATION

| Item | Who resolves | Note |
| --- | --- | --- |
| A2345 (wheel) is a 5-high straight, and QKA23 is not a straight | WP-F2A, or I3 with a script | The evaluator has `straightTopOfRankMask`; the behaviour was not confirmed by reading it in this pass. Blog #14 depends on it entirely. |
| Which class is rank 2, 3, 4 by the shipped strength dataset | I1, via `HAND_AT_RANK` at render time | Not asserted here. Blog #1's whole answer. |
| Whether `72o` is rank 169 | I2, via `HAND_RANK` | Not asserted here. |
| The "BB post counts as the first bet" convention behind the name 3-Bet | Orchestrator (`docs/DECISIONS.md`) or I4's phrasing | Not written down anywhere in this repository. CLAUDE.md rule 7. |
| Winner/split outcomes in blogs #11 and #13 | I3, via `evaluateHand`/`bestFiveOf` | Must be script-verified, not reasoned. |
| Exact `RangeMatrixMini` capability for highlighting one cell | WP-G2 or WP-E3 | Props today are `positions`/`initial`/`showSelection`/`caption`/`className` only. §4 routes around it. |
| Whether WP-G2 splits the MDX component maps as well as the registry | Orchestrator | If not, H1/H2/H3 and I1–I4 cannot run in parallel. |
| Exact per-batch registry/MDX-map file names | WP-G2 | §7 uses placeholders; substitute before dispatch. |
