# WP-S3-08 S3 — hand stories `aa-loses`, `ak-flop-miss`

## Objective

Two new 3BetTilt hand stories (batch S3) as `HandStoryRecord`s + MDX, validated by the story gate
(`stories/validate.ts`, evaluator-verified showdown), every number from `<Fact>`, rendered by
`StoryArticleLayout`, visible on `/ko/blog`. Premises differ from the four existing stories (no
full house, no two pair, no river flush, no 72o).

## Facts verified before work

- `HAND_STORY_S3_RECORDS` / `BLOG_S3_MDX` were empty; `stories/index.ts` and `blog/index.ts` already
  wire S3, so registering = filling the two arrays.
- Validator/resolver: heads-up showdown only, blinds 0.5/1 posted by the model, `amount` = total on
  the street, `ALL_IN` must bring the seat's total to `effectiveStack`, pots summed never authored,
  declared `winner` must equal `compareHands(bestFiveOf)`.
- `seoTitleOf` returns `seoTitle` as-is; metadata appends ` · 3BetTilt` (confirmed in built HTML).
- Threshold (blog): ≥900 prose chars, ≥3 `##`, ≥1 component/tool/next step/concept.
  `readMinutes = estimateReadMinutes(proseCharacters)` (400/min, floor 2).
- `content.test.ts` asserts readMinutes/`<Term>` relations for ALL records but stops at the first
  failing record — with i-batch failures present it never reached S3. `s3.test.ts` pins both for S3.
- `claims.test.ts`: a paragraph holding an equity Fact may not say 이기는 비율/이길 확률/…를 이깁니다;
  in-prose links are locale-less and must resolve (`/learn/outs`, `/blog/how-often-aa`, …).
- Facts available: `EXACT_EQUITY`, `OUTS_PROB "<outs>|FLOP|NEXT|RIVER"`, `POT_ODDS_REQUIRED_EQUITY
  "<pot before bet>|<bet>"` (call = bet), `RFI_POSITIONS_WITH`, `HAND_RANK`, `HAND_EQUITY_VS_RANDOM`,
  `CATEGORY_RANK`. `CLASS_VS_CLASS_EQUITY` only supports the frozen QQ/AK pairs (not used).
- In this site's ranking `HAND_RANK AKs = 8` (the seven pairs AA–77 sit above it); the MDX says "페어가
  아닌 패 중 가장 위", which `claims.test.ts` line 56 independently asserts.

## Decisions made

- **Story 1 `aa-loses`** — hero HJ `As Ac` opens 2.5, BTN calls, blinds fold (6.5). Flop `Ts 9c 3h`:
  HJ bets 4, call (14.5). Turn `6s`: HJ bets 10, BTN raises 30, call (74.5). River `2c`: check,
  BTN all-in 63.5 (total 100), call (201.5). Villain `8d 7d` → evaluator: hero PAIR vs villain
  STRAIGHT → **villain**. Chosen over "set over overpair"/"AA vs KK" (cliché) and over two pair /
  full house / river flush (already used). Hero's exact share is 0 from the turn (pinned), so the
  emotional line "best starting hand for exactly two streets" is backed by data.
- **Story 2 `ak-flop-miss`** — hero CO `Ah Kh` opens 2.5, BTN calls, blinds fold (6.5). Flop `9s 6d
  2c`: CO bets 3, call (12.5). Turn `4h`: check-check. River `7d`: check, BTN bets 4, call (20.5).
  Villain `Qc Jc` → hero HIGH_CARD vs villain HIGH_CARD → **hero**. "Missing" is defined as "no pair";
  what AK still has (top high card, 6 outs) and doesn't have (a pair) is shown by the Q♣J♣ line and a
  7♠7♣ counterfactual on the same flop (`EXACT_EQUITY AhKh|7s7c|9s6d2c`, pinned < 0.5).
- Each MDX: lead → 5 `<StreetSection>` → 3 `##` sections (`숫자로 다시 보면` / story 2 also `놓쳤다는
  말의 뜻`) → `## 흥미로운 지점` → `## 무엇을 배울 수 있나`; one `<ToolCTA tool="toolEquity">`.
  No paragraph starts with `<digit>. ` (S1 lesson). Bet sizes appear in prose only where the timeline
  shows them; pots never typed except as `POT_ODDS_REQUIRED_EQUITY` args (pinned to summed pots).
- Ranges: only `RFI_POSITIONS_WITH 87s` / `QJs`; both stories state the site has no facing-raise
  call range and make no "correct call" claim. No "GTO". Hindsight framing throughout.
- Card counts in prose ("아웃 8장", "A 세 장과 K 세 장, 아웃 6장") are deck arithmetic mirrored by the
  `OUTS_PROB` args, not strategy numbers.

## Files changed

- `apps/fishtilt/src/content/registry/blog/stories/s3.ts` — the two `HandStoryRecord`s.
- `apps/fishtilt/src/content/registry/blog/stories/s3.test.ts` — NEW: categories/winner, suitedness,
  equity shape per street (>0.5 / =0 / =1), 77 counterfactual, readMinutes + indexable floor, every
  `<Fact>` computes (printed), `EXACT_EQUITY` args use the record's cards/board, pot-odds args = pots.
- `apps/fishtilt/src/content/blog/s3.ts` — MDX map for the two slugs.
- `apps/fishtilt/content/blog/aa-loses.mdx` — NEW.
- `apps/fishtilt/content/blog/ak-flop-miss.mdx` — NEW.
- This handoff. Nothing outside the S3 boundary was edited.

## The stories

### 1. `blog-aa-loses` (`/blog/aa-loses`)

- title `포켓 에이스를 들고 스택을 다 잃었다` · seoTitle `홀덤 핸드 리뷰: AA vs 87s, 턴에 스트레이트가
  완성된 상황` · BASIC · hand-strength · readMinutes 7 (2402 chars) · indexable.
- Computed showdown: hero 원페어 (에이스 원페어) vs villain 스트레이트 (텐 하이 스트레이트) → 상대가 팟
  201.5BB.
- Facts (printed by `s3.test.ts --reporter=verbose`): HAND_RANK AA = 1; EXACT_EQUITY AsAc|8d7d =
  76.98%; HAND_EQUITY_VS_RANDOM AA = 85.20%; EXACT_EQUITY …|Ts9c3h = 65.76%; OUTS_PROB 8|FLOP|NEXT =
  17.02%; 8|FLOP|RIVER = 31.45%; EXACT_EQUITY …|Ts9c3h6s = 0.00%; …|Ts9c3h6s2c = 0.00%;
  POT_ODDS_REQUIRED_EQUITY 74.5|63.5 = 31.51%; RFI_POSITIONS_WITH 87s = HJ · CO · BTN · SB;
  CATEGORY_RANK PAIR = 8; CATEGORY_RANK STRAIGHT = 5.
- Links: relatedConcepts term-pocket-pair/straight/outs/equity/suited/pot-odds; relatedTools toolEquity,
  toolHandChecker, toolPotOdds; relatedHands hand-aa; nextLessons equity, outs; relatedArticles
  blog-ak-flop-miss, blog-how-often-aa, blog-next-best-after-aa, blog-why-suited-matters. In-body:
  `<Term>` ×6, `/tools/equity`, `/tools/hand-checker`, `/learn/outs`, `/blog/how-often-aa`.
- Reader learns: AA is one pair from the flop on; equity is per street (turn card → 0); connected
  boards open straights; review = compare felt vs computed strength.

### 2. `blog-ak-flop-miss` (`/blog/ak-flop-miss`)

- title `AK로 플랍을 완전히 놓쳤다. 그런데 내가 이겼다` · seoTitle `홀덤 핸드 리뷰: AKs vs QJs, 플랍
  962에서 둘 다 미스한 판` · BASIC · hand-strength · readMinutes 6 (2343 chars) · indexable.
- Computed showdown: hero 하이카드 vs villain 하이카드 → hero takes 20.5BB.
- Facts: HAND_RANK AKs = 8; CATEGORY_RANK HIGH_CARD = 9; OUTS_PROB 6|FLOP|NEXT = 12.77%; 6|FLOP|RIVER
  = 24.14%; EXACT_EQUITY AhKh|QcJc = 62.72%; …|9s6d2c = 71.31%; …|9s6d2c4h = 86.36%; …|9s6d2c4h7d =
  100.00%; EXACT_EQUITY AhKh|7s7c|9s6d2c = 23.94%; POT_ODDS_REQUIRED_EQUITY 12.5|4 = 19.51%;
  RFI_POSITIONS_WITH QJs = UTG · HJ · CO · BTN · SB.
- Links: relatedConcepts term-high-card/outs/equity/pot-odds/showdown; relatedTools toolEquity,
  toolHandChecker, toolPotOdds; relatedHands hand-aks, hand-ako; nextLessons outs, equity;
  relatedArticles blog-aa-loses, blog-is-ak-good, blog-aks-vs-ako, blog-qq-vs-ak. In-body: `<Term>`
  ×5, `/tools/hand-checker`, `/tools/equity`, `/learn/outs`, `/blog/is-ak-good`, `/blog/aa-loses`.
- Reader learns: "missing" = no pair, relative to the villain; ace-high wins unpaired showdowns; the
  same flop is ~even vs Q-high and a big underdog vs a pocket pair; AK's fallback is 6 outs.

## Tests run

- `pnpm vitest run --project fishtilt src/content/registry/blog/stories src/content` → 28 files:
  24 PASS / 4 FAIL; 593 tests: 583 PASS / 10 FAIL. **Zero failures name an S3 id.** Failures are
  `content.test.ts` (readMinutes of `blog-aks-vs-ako`, `<Term>` relations ×12, FAQ questions ×10) and
  `i1/i3/i4.test.ts` (readMinutes `aks-vs-ako`/`what-is-kicker`/`outs-nine`, `<Term>`, "RFI-only
  facts") — the concurrent i-batch migrations. Before my fixes 1 failure named me
  (`blog-aa-loses: <Term id="term-pot-odds"> is not in relatedConcepts`) → fixed; my own readMinutes
  pin caught 5→7 and 5→6 → fixed.
- `s3.test.ts` 14/14 PASS. `stories.test.ts` PASS with S3 registered.
- `pnpm exec eslint` on the three S3 `.ts` files → 0. `prettier --write` on the five S3 files only.
- `pnpm --filter @gto-self/fishtilt typecheck` → 2 errors, both `src/content/registry/blog/i2.test.ts`
  (unused `HAND_CLASSES`, `handStrengthForKey`) — outside boundary. No S3 type errors.

## Build/runtime evidence

- `build-lock.sh 'rm -rf .next && pnpm build …'` (foreground) → **BUILD_EXIT=0**
  (`artifacts/3bettilt-stage3-visual-qa/wp08-s3/build.log`), then `next start :3221` + `shoot.mjs`:
  12 shots, all `status 200`, `h1 1`, **`overflowX 0`** at 1440x900 and 390x844, dark + light, `--fold`:
  `ko_blog`, `ko_blog_aa-loses`, `ko_blog_ak-flop-miss` (full + `-fold` PNGs). Server killed after.
- Looked at (native-size crops): aa-loses 1440 dark fold + three mid-page crops; ak-flop-miss 390
  light fold + three crops; hub 1440 dark crop. Confirmed: category → H1 → deck → "족보 · 약 7분/6분" →
  badge + disclosure sentence; game strip (NLHE 6인 / 100BB / HJ|CO / BTN); hero cards + class key;
  per-street boards accumulating; numbered timelines incl. derived blinds, amounts, notes (오픈,
  컨티뉴에이션 벳, 남은 스택 전부), "팟 N BB"; showdown block with both hands, 원페어/에이스 원페어 vs
  스트레이트/텐 하이 스트레이트, "상대가 팟 201.5BB를 가져갑니다", evaluator note; Fact values bold
  inline; ToolCTA; no ordered-list artifacts; hub 핸드 스토리 section shows both S3 stories with
  "약 7분/6분 · 학습과 재미를 위해 재구성한 핸드 시나리오입니다."
- Prerendered HTML grep (`.next/server/app/ko/blog/<slug>.html`): `data-street` ×5 each; disclosure
  ×2; `data-winner="villain"` / `"hero"`; pots 6.5/14.5/74.5/201.5 and 6.5/12.5/12.5/20.5; all fact
  percentages above present; `<title>… · 3BetTilt</title>` once; hub links each slug twice
  (stories section + index).

## Known limitations

- `POT_ODDS_REQUIRED_EQUITY` takes call = bet, so story 1's turn call (10 in, 20 more into 54.5)
  cannot be cited; only the river all-in is. Story 2 cites only the river call.
- `EXACT_EQUITY` is hindsight (villain known); each MDX says so and disclaims table advice.
- `relatedHands` list the hero's classes only (`hand-aa`; `hand-aks` + `hand-ako`). There is no
  `hand-87s` page; `hand-qjs` exists but was left out on purpose (villain's page is not the story's hand).
- Story pages are long (9.9k / 10.1k px at 1440) — same as S1/S2, by design (no TOC in the story layout).

## Open issues

- Out of boundary: `src/content/registry/blog/i2.test.ts` unused imports break `tsc` (not `next build`).
- Out of boundary: i-batch readMinutes/`<Term>`/FAQ/RFI-only failures listed above (i1/i3/i4 +
  `content.test.ts`); they hide later records in `content.test.ts`'s per-record loops — the S1/S2
  batches have no batch-scoped readMinutes pin like `s3.test.ts`, so re-run `content.test.ts` once
  the i-batches are green.
- `stories/index.ts` order S1 → S2 → S3 drives prev/next; `relatedArticles` cross-links only within
  S3 + existing articles (S1/S2 ids not referenced, per S2's note — orchestrator may add).

## Exact facts next agent may rely on

- Ids/slugs: `blog-aa-loses` (`/blog/aa-loses`), `blog-ak-flop-miss` (`/blog/ak-flop-miss`); both
  PUBLISHED, indexable, `contentType: 'hand-story'`, topic `hand-strength`, level BASIC, readMinutes
  7 / 6; `hand.showdown.winner` villain / hero; final pots 201.5BB / 20.5BB (summed by `resolve.ts`).
- All fact values are in "The stories" above, copied from the test's printout (`--reporter=verbose`
  is needed to see `console.info` from vitest here).
- A story needs ≥3 `##` headings and a batch-scoped readMinutes pin is worth adding (content.test.ts
  stops at the first failing record).

## Facts next agent MUST re-check

- If the i-batch fixes change `threshold.ts`/`measureContent`, re-run `s3.test.ts` (readMinutes 7/6).
- If the orchestrator adds S1/S2 ids to S3 `relatedArticles`, `stories.test.ts` forbids self/unpublished
  links — only PUBLISHED story ids.
