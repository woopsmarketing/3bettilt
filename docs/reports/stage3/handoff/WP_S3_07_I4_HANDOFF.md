# WP-S3-07 — batch i4 (outs-nine · why-blinds-exist · why-called-3bet · why-use-range · pot-odds-quick)

## Objective

Migrate the five i4 blog articles to search-intent-complete 3BetTilt guides per
`3BETTILT_CONTENT_AUDIT.md` §2 B16–B20, keeping every number a `<Fact>`, respecting the range policy
(6-Max · 100BB · First In learning baseline, never GTO, no source names, facing-raise unsupported) and
the cannibalization map (blog answers its own question; Learn/Tool/Glossary keep theirs).

## Facts verified before work

- Registry fields (`title`/`seoTitle`/`description`/`contentType`/`readMinutes`) and MDX conventions
  from `WP_S3_06_HANDOFF.md` "WP-07" section; `MIN_TOC_HEADINGS = 3`; FAQ = `## 사람들이 자주 헷갈리는 부분`
  + `### …?` (`src/lib/seo/faq.ts`); never `<FAQ>` together.
- `i4.test.ts` pre-existing pins: three verbatim hand-off sentences, FLOP|NEXT once inside the outs-nine
  synthesis section, TURN|NEXT banned, pot-odds-quick may not reuse 10|5 / 9|3 / 3|2, why-use-range may
  not use RFI_POSITIONS_WITH / HAND_COMBOS / HAND_SHARE, ruling 18 phrases for why-called-3bet
  (`홀덤에서 일반적으로 쓰이는 세는 방식`, no `가장 널리`, no `유래|기원`).
- e2e `tests/e2e/blog.spec.ts` pins the FIRST `main figure` caption: outs-nine `아웃츠 9장` (+47 svg
  rects), pot-odds-quick `최종 팟`, why-use-range `표로 본 것` — all kept as the first figure.
- `potOddsUrl.ts` / `PotOddsCalculator.tsx` rely on pot-odds-quick's CTA params `pot=9&bet=6` — kept.
- Range URL parser accepts `hero=SB` (`src/features/range/url.ts`, `STRATEGY_POSITIONS`).
- Story facts reused: `qq-vs-72o-flop-227` preflop = CO 2.5BB open, BTN 8BB 3-bet; `qq-three-bet-frustration`
  = BB 3-bets BTN's open, BTN calls; `river-changes-everything` = JTs flush draw completes on the river.
- BB has no First-In range in the facade (`RFI_PERCENT BB` throws) — pinned in the test.

## Decisions made

| slug | audit decision | old H1 → new H1 | seoTitle | intent |
|---|---|---|---|---|
| outs-nine | RENAME | 아웃츠 9장은 무슨 뜻일까? → 아웃츠 9장 = 플러시 드로우: 완성 확률과 콜에 쓸 수 있는지까지 | 아웃츠 9장 뜻 — 플러시 드로우 완성 확률과 팟오즈 비교 | 플러시 드로우는 왜 9장이고 확률은? |
| why-blinds-exist | MOVE ROLE → concept-culture | Big Blind는 왜 돈을 먼저 내나? → 블라인드는 왜 있을까? 강제 베팅이 판을 움직이는 이유 | 빅 블라인드는 왜 먼저 돈을 내나? 블라인드가 있는 이유 | 왜 강제로 돈을 걸게 하지? |
| why-called-3bet | MOVE ROLE → concept-culture | 왜 3-Bet이라고 부를까? → 3벳(3-Bet)은 왜 '3'일까? 벳을 세는 규칙과 4벳·5벳 | 3벳(쓰리벳, 3-Bet)은 왜 3일까? 벳을 세는 규칙과 여러 표기 | 왜 두 번째 레이즈가 3벳이야? (+ 3벳/쓰리벳/3bet/three-bet naming) |
| why-use-range | DEEP EXPAND | Range를 보는 이유 → 상대 패를 하나로 찍으면 왜 틀릴까? 레인지로 보는 이유와 읽는 법 | 레인지로 보는 이유 — 상대 패를 하나로 찍으면 틀리는 것 | 상대 패를 하나로 찍으면 왜 틀리지? |
| pot-odds-quick | RENAME | 팟오즈 쉽게 계산하기 → 팟오즈 계산법: 하프팟·2/3팟·풀팟에 필요한 승률 표 | 팟오즈 쉽게 계산하기 — 벳 크기별 암산 숫자 | 테이블에서 팟오즈를 빨리 계산하는 법은? |

- why-use-range H1 deviates from the audit's "핸드 레인지란? …" on purpose: `learn/poker-range` owns the
  "핸드레인지란" query (cannibalization map §1.1); the blog keeps "레인지로 보는 이유".
- why-called-3bet avoids the audit's word "유래" (ruling 18 / i4.test bans `유래|기원`); it explains the
  counting rule and the name variants instead. `BettingTimeline` uses the qq-vs-72o story's sizes
  (1BB → 2.5BB → 8BB) rather than repeating the lesson's 1/3/9/27 example.
- outs-nine keeps the anti-duplication contract with `learn/outs` (no per-street table; FLOP|NEXT once in
  the synthesis; the turn number appears only in the FAQ as `9|TURN|RIVER`, which the test permits).
  The audit's "플랍/턴/리버 확률표" was NOT added — the lesson owns that table (cannibalization map row
  "아웃츠 · 세는 법 · ×2/×4 규칙 → learn/outs").
- Both MOVE ROLE articles still carry `relatedTools: ['range']` + one `<ToolCTA tool="range">`: the batch
  test and blog threshold require ≥1 tool; the CTA copy is tied to the article (SB first-in table /
  open-raise table, "3-Bet 레인지는 이 표에 없습니다").
- `readMinutes` re-measured: outs-nine 6, why-blinds-exist 5, why-called-3bet 6, why-use-range 7,
  pot-odds-quick 5.

## Files changed

- `apps/fishtilt/content/blog/outs-nine.mdx` (rewritten)
- `apps/fishtilt/content/blog/why-blinds-exist.mdx` (rewritten)
- `apps/fishtilt/content/blog/why-called-3bet.mdx` (rewritten)
- `apps/fishtilt/content/blog/why-use-range.mdx` (rewritten)
- `apps/fishtilt/content/blog/pot-odds-quick.mdx` (rewritten)
- `apps/fishtilt/src/content/registry/blog/i4.ts` (titles, seoTitle, descriptions, relations, readMinutes)
- `apps/fishtilt/src/content/registry/blog/i4.test.ts` (new pins, see Tests)
- `apps/fishtilt/src/content/blog/i4.ts` — unchanged (no article added/removed)

## Per-article detail

### outs-nine (data-probability, 6 min)
Sections: QuickAnswer · 왜 하필 9장인가요? (PokerCards ×2, DataTable 13−2−2=9) · 두 장을 다 보면 얼마나 자주
완성되나요? · 이 숫자, 콜에 쓸 수 있나요? (synthesis, unchanged contract) · 규칙은 이번에도 어긋나지만… (StatsRow)
· FAQ ×4 (added "아웃 8장(양방 스트레이트)도 같은 방법인가요?").
Numbers: OUTS_PROB 9|FLOP|RIVER, 9|FLOP|SHORTCUT_RIVER, 9|FLOP|NEXT (×1, synthesis), 8|FLOP|RIVER, 15|FLOP|RIVER,
9|TURN|RIVER; POT_ODDS_REQUIRED_EQUITY 9|3. Typed constants 13/2/2/9/47 are rule constants (NUMBER-RISK #18,
accepted class). Narrative "세 번에 한 번 정도" pinned to 0.30–0.40 band; 8<9<15 ordering pinned.
Links: /learn/outs (hand-off), /tools/equity, /blog/river-changes-everything, /blog/pot-odds-quick.
Relations: concepts outs/draw/flush/big-blind; tools toolOuts/toolPotOdds/toolEquity; lessons outs/pot-odds;
articles pot-odds-quick/river-changes-everything.

### why-blinds-exist (concept-culture, 5 min)
Sections: QuickAnswer · 한 판이 시작되기 전, 이 순서로 걸립니다 (PositionDiagram SB/BB + BettingTimeline 예시 크기)
· 블라인드가 없다면 어떻게 되나요? (Callout → why-called-3bet) · 앤티와는 무엇이 다른가요? (ComparisonTable) ·
빅 블라인드 자리만의 특수한 점 (last to act preflop, BB option — both already stated in glossary/big-blind and
learn/preflop) · FAQ ×4 (existing).
Numbers: RFI_PERCENT SB (only Fact). "0.5BB/1BB" labelled 예시 크기; "여섯 판에 두 번" = 6-max orbit rule.
Relations: concepts blind/big-blind/small-blind/ante/button; tool range (hero=SB); lessons holdem-basics/
positions-6max; article why-called-3bet.

### why-called-3bet (concept-culture, 6 min)
Sections: QuickAnswer · 세 번째까지 세는 방법 (BettingTimeline BB 1BB → CO 2.5BB → BTN 8BB) · 4벳, 5벳으로 이어지는
이름 (DataTable 1st–5th) · 3벳, 쓰리벳, 3bet, three-bet — 전부 같은 말입니다 (KeyPoint) · 플랍 이후에도 세는 규칙은
같습니다 (same rule, no forced bet; the site uses the name preflop only — no prevalence claim) · 여기서 다루지
않는 것 (3-bet ranges unsupported) · FAQ ×5 (existing).
Numbers: none typed except 예시 크기 amounts. Ruling 18 phrases kept verbatim.
Links: /learn/three-bet ×2, /blog/qq-vs-72o-flop-227, /blog/qq-three-bet-frustration, /glossary/three-bet.
Relations: concepts three-bet/four-bet/open-raise/big-blind; tool range; lessons three-bet/poker-actions;
articles qq-three-bet-frustration/qq-vs-72o-flop-227/why-blinds-exist.

### why-use-range (search-guide, 7 min)
Sections: QuickAnswer (RFI_PERCENT UTG/BTN) · 하나로 찍으면 뭐가 틀리나요? (Figure RangeMatrixMini UTG/BTN, story
link) · 표 한 장으로 레인지를 읽는 법 (COMBO_COUNT, HAND_CLASS_COUNT) · 자리마다 레인지의 폭이 다릅니다 (DataTable
RFI_COMBOS/RFI_PERCENT UTG·HJ·CO·BTN·SB + RangeMatrixMini all positions) · 레인지로 보면 무엇이 나아지나요?
(KeyPoint 오해 3) · 이 표는 정답이 아니라 학습용 기준입니다 · FAQ ×5 (added "레인지는 누가 정하나요?").
Range policy: "6인 · 100BB · First In 학습용 기본 레인지" stated three times; facing-raise = 지원하지 않음; no GTO,
no source names. Monotonic UTG<HJ<CO<BTN combos and "BB has no table" pinned.
Links: /learn/poker-range (hand-off), /learn/hand-matrix, /learn/position, /tools/equity, /glossary/pot-odds,
/blog/qq-vs-72o-flop-227.
Relations: concepts range/utg/button/hand-matrix/combo/open-raise/position; tools range/practiceRange/toolEquity;
lessons poker-range/hand-matrix/position; articles qq-vs-72o-flop-227/btn-why-wide.

### pot-odds-quick (data-probability, 5 min)
Sections: QuickAnswer (6|3, 6|4, 6|6) · 벳 크기 세 가지, 필요한 승률 표 (DataTable) · 실제 액수가 달라져도 같은
숫자가 나옵니다 (StatsRow 6|4 vs 9|6) · 덜 흔한 크기도 같은 절차로 나옵니다 (DataTable 8|2, 8|6, 6|9, 6|12) ·
아웃츠와 나란히 놓으면 (link-out; outs-nine owns the synthesis) · FAQ ×5 (added stack-short case).
Numbers: POT_ODDS_REQUIRED_EQUITY 6|3, 6|4, 6|6, 9|6, 8|2, 8|6, 6|9, 6|12 — all pinned against `potOdds`. Typed
final pots 12/14/18BB pinned as `Money.add` sums. "두 배 오버벳도 절반에 닿지 않는다" pinned (< 0.5).
Does not repeat the lesson's derivation or its 10|5 / 9|3 pairs; CTA keeps pot=9&bet=6.

## Tests run

- `pnpm vitest run --project fishtilt src/content/registry/blog/i4.test.ts` — 42 passed / 0 failed.
- `pnpm vitest run --project fishtilt src/content` — every i4 id green. Failures naming OTHER batches
  (not mine): `i1.test.ts` (aks-vs-ako readMinutes 8≠6; qq-vs-ak extra CLASS_VS_CLASS pairs),
  `i3.test.ts` (same-pair-who-wins removed from map; btn-why-wide readMinutes; COMBO_COUNT), `content.test.ts`
  (aks-vs-ako readMinutes; FAQ `###` without `?` in why-72o-is-weak, why-suited-matters, small-pocket-pairs,
  flush-vs-straight, full-house-vs-flush).
- `src/copy-guards.test.ts` — my files clean; 2 failures outside my boundary:
  `src/content/registry/hands/batchGate.ts` («수익성» inside a regex literal) and
  `content/blog/small-pocket-pairs.mdx` («유리합니»).
- `src/components/blog/articleHeadings.test.ts` — pass (no duplicate `##`).
- `pnpm --filter @gto-self/fishtilt typecheck` — fails only in `src/content/registry/blog/i1.test.ts`
  (TS2304 `percent`, TS6133 unused) — i1 batch, not mine.
- `eslint` on i4.ts / i4.test.ts / blog/i4.ts — clean. `prettier --check` on my 7 files — clean.

## Build/runtime evidence

- First locked build attempt failed on `src/content/registry/blog/i1.test.ts` (TS6133, i1 batch); the
  retry succeeded once i1 fixed it. `pnpm build` (next build incl. type check) green; static prerender OK.
- Screenshots (`shoot.mjs`, `--fold`, dark+light, 1440x900 + 390x844) in
  `artifacts/3bettilt-stage3-visual-qa/wp07-i4/` for `/ko/blog/why-use-range` and `/ko/blog/why-called-3bet`:
  status 200, exactly 1 h1 (44px / 30px), `overflowX: 0` at both widths, page heights 10856/14334 and
  7902/10811 px.
- Looked at: hero (type label `검색 가이드` / `포커 개념·문화`, deck, 약 N분), TOC (6 / 7 entries, first
  `##` ids), `빠른 답` with inline `<Fact>` values (17.0% / 42.8%) and `<Term>` links, the 5-row RFI
  DataTable and the 3-step BettingTimeline fitting inside 390px, in-body links to lessons/stories rendered
  in brand red. No horizontal overflow, no missing figures.
- Prettier was run on the two MDX files (`why-blinds-exist`, `why-called-3bet`) BEFORE the orchestrator's
  notice that `.mdx` is now prettier-ignored; the one prose paragraph it soft-wrapped (SB/BB sentence,
  `<Term>` at line start) was rejoined by hand and re-verified. The other three MDX files were reported
  "unchanged" by prettier.

## Known limitations

- outs-nine does not carry the audit's street table (deliberate, anti-duplication with `learn/outs`).
- Both concept-culture articles link the range tool as their one tool; the audit preferred "없음/practice",
  which the threshold (`minTools: 1`) does not allow.
- `estimateReadMinutes` counts prose only; DataTable/StatsRow cell text is JSX and not counted.

## Open issues

- `tests/e2e/blog.spec.ts` "sets the search title" case asserts aks-vs-ako (i1) has no seoTitle — not
  affected by i4. i4 articles now DO have `seoTitle`; if the orchestrator wants an e2e pin for seoTitle,
  `/ko/blog/pot-odds-quick` title should be `팟오즈 쉽게 계산하기 — 벳 크기별 암산 숫자 · 3BetTilt`.
- Blog e2e still expects the first figure captions above — kept; no e2e change needed for i4.

## Exact facts next agent may rely on

- i4 slugs/ids unchanged; `contentType`: outs-nine & pot-odds-quick `data-probability`, why-use-range
  `search-guide`, why-blinds-exist & why-called-3bet `concept-culture`.
- Every i4 article starts with `<QuickAnswer>`, has ≥3 unique `##`, one `<ToolCTA>`, FAQ via `###` only.
- Hand-off sentences (verbatim) still present in outs-nine, pot-odds-quick, why-use-range.

## Facts next agent MUST re-check

- The full `src/content` suite and `copy-guards` were red only on other batches' files at hand-off time
  (listed under Tests run); re-run after i1/i2/i3 land.
- SB's First-In table (46.9%) is wider than BTN's (42.8%) in the shipped facade; why-use-range only claims
  UTG→HJ→CO→BTN widens (pinned). Do not add a "BTN is the widest" sentence without re-checking.
- `tests/e2e/blog.spec.ts` first-figure captions for outs-nine / pot-odds-quick / why-use-range still match;
  a targeted `blog.spec.ts` run was not executed by this batch (build lock time) — run it at the milestone gate.
