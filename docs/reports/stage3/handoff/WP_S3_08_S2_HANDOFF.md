# WP-S3-08 S2 — hand stories `qq-three-bet-frustration`, `river-changes-everything`

## Objective

Two new 3BetTilt hand stories (batch S2) as `HandStoryRecord`s + MDX, validated by the story gate
(`stories/validate.ts`, evaluator-verified showdown), rendered by `StoryArticleLayout`, visible on
`/ko/blog`. Villain hand / board differ from S1 (72o on 2-2-7; full-house-loses).

## Facts verified before work

- `HAND_STORY_S2_RECORDS` and `BLOG_S2_MDX` were empty; `src/content/blog/index.ts` already spreads
  `BLOG_S2_MDX`; `stories/index.ts` already concatenates S1–S3.
- Validator: heads-up showdown only, blinds 0.5/1 posted by the model, `amount` = total on the street
  ("raise to"), `ALL_IN` must bring the seat's total to `effectiveStack`, pots are summed never authored,
  declared `winner` must equal `compareHands` of `bestFiveOf`.
- `mdx.ts`: `<StreetSection street=…>` tags in record order + `showdown`; no `board/actions/pot/title`
  props; needs `## 흥미로운 지점` (or `<KeyPoint title>`) and `## 무엇을 배울 수 있나`.
- `threshold.ts` blog floor: 900 prose chars, **3 `##` sections**, 1 component, 1 tool, 1 next step,
  1 concept. The fixture MDX has only one `##` — a real `indexable: true` story needs two more `##`
  headings; I added `## 숫자로 다시 보기` between the two mandatory ones.
- `readMinutes` = `estimateReadMinutes(proseCharacters)` (400 chars/min, floor 2). Measured with
  `measureContent` on the final MDX: 1796 chars → 5 min; 1543 chars → 4 min.
- `seoTitleOf` returns `seoTitle` as-is; `metadata.ts` appends ` · 3BetTilt` itself → no brand in `seoTitle`.
- Facts available: `EXACT_EQUITY "<hero>|<villain>|<board>"` (board 0/3/4/5 cards), `OUTS_PROB
  "<outs>|FLOP|TURN|NEXT|RIVER"`, `POT_ODDS_REQUIRED_EQUITY "<pot before villain bet>|<bet>"` (call =
  bet, no separate call amount), `RFI_POSITIONS_WITH "<class>"`. `CLASS_VS_CLASS_EQUITY` only has the two
  frozen matchups (QQ|AKs, QQ|AKo) — `QQ|A4s` throws, so the story uses `EXACT_EQUITY` on the real cards.
- `outsOdds` counts 47/46 unseen cards (villain's cards NOT removed) — this is why 9-out turn probability
  (19.57%) differs from exact turn equity vs a known villain (20.45% = 9/44). Stated in prose as a
  difference of premise, no figure typed.

## Decisions made

- **Story 1** `qq-three-bet-frustration` (hero BB, villain BTN, 100BB): BTN opens 2.5, BB 3-bets 11, call
  (pot 22.5). Flop `9d 4c 2s`: BB bets 8, call (38.5). Turn `Ah`: check, BTN bets 20, call (78.5). River
  `7c`: check, BTN bets 30, call (138.5). Showdown villain `Ad 4d` → evaluator: hero PAIR vs villain
  TWO_PAIR → **villain**. Different from S1 by design (weak suited ace, gets there on the turn).
- **Story 2** `river-changes-everything` (hero BTN `Jh Th`, villain BB, 100BB): BTN opens 2.5, BB calls
  (5.5). Flop `Kh 7h 2d`: check, BTN bets 3, BB check-raises 10, call (25.5). Turn `4c`: BB bets 15, call
  (55.5). River `5h`: BB bets 30, BTN ALL_IN 72.5 (total 100), BB calls (200.5). Showdown villain `Kc 7c`
  → hero FLUSH vs villain TWO_PAIR → **hero**. Hero is behind on flop and turn (exact equity < 50%) and
  wins only on the river — `s2.test.ts` pins that.
- Prose restates cards but never a pot or a bet size (the timeline under each street shows them); the
  only typed numbers are `Fact` args, and `s2.test.ts` checks every `POT_ODDS_REQUIRED_EQUITY` pot arg
  equals a street pot `resolve.ts` sums for that story.
- Ranges: only `RFI_POSITIONS_WITH A4s` (real data, First-In only) and an explicit "3벳을 상대하는
  레인지는 제공하지 않으므로 그 콜이 맞았는지는 말하지 않는다". No "GTO", no calling range.
- Voice: 반말 1인칭, short paragraphs, 6 street/showdown sections + 3 `##` sections + one `<ToolCTA>`
  in 숫자로 다시 보기 (equity calculator / outs calculator). 무엇을 배울 수 있나 is hindsight learning,
  not table advice ("이 글은 '턴에서 폴드했어야 한다'고 말하지 않는다").
- Both stories say the showdown category/winner comes from the site's evaluator (as the template does).

## Files changed

- `apps/fishtilt/src/content/registry/blog/stories/s2.ts` — the two `HandStoryRecord`s.
- `apps/fishtilt/src/content/registry/blog/stories/s2.test.ts` — NEW: pins categories/winner, flop/turn
  hero share (<0.5 / >0.5), and pot-odds Fact args vs summed pots.
- `apps/fishtilt/src/content/blog/s2.ts` — MDX map for the two slugs.
- `apps/fishtilt/content/blog/qq-three-bet-frustration.mdx` — NEW.
- `apps/fishtilt/content/blog/river-changes-everything.mdx` — NEW.
- This handoff. Nothing outside the S2 boundary was edited.

## Tests run

- `pnpm vitest run --project fishtilt src/content/registry/blog/stories src/content` →
  **23 files: 22 PASS, 1 FAIL; 518 tests: 517 PASS, 1 FAIL.** The failure is
  `claims.test.ts › every in-prose link points at a page that exists` →
  `"blog-full-house-loses -> /learn/hand-rankings"` — **S1's story** (not S2). Zero failures name an S2 id.
  `s2.test.ts` 5/5 PASS; `stories.test.ts` PASS with both S2 records registered.
- `pnpm exec eslint` on the three S2 `.ts` files → 0.
- `pnpm exec prettier --write` on the five S2 files only.
- `pnpm --filter @gto-self/fishtilt typecheck` → **FAIL outside boundary**:
  `src/components/HomeHeroVisual.tsx(35,10): Module './ContentThumbnail.js' has no exported member
  'SUIT_PATH'` (homepage WP, in progress). No S2 type errors.

## Build/runtime evidence

- First build attempt (03:3x) failed on `HomeHeroVisual.tsx` (`SUIT_PATH`), outside boundary; polled
  `tsc` every 30 s until the homepage agent fixed it, then re-ran under `build-lock.sh` in the foreground:
  `pnpm build` → **BUILD_EXIT=0** (`artifacts/3bettilt-stage3-visual-qa/wp08-s2/build.log`), then
  `next start :3221` + `shoot.mjs` → 12 shots + `shots.jsonl`, all `status 200`, `h1 1`,
  **`overflowX 0`** at 1440x900 and 390x844, dark + light, `--fold`:
  `ko_blog`, `ko_blog_qq-three-bet-frustration`, `ko_blog_river-changes-everything` (full + fold PNGs).
- Looked at them (1440 dark/light, 390 dark/light): category "핸드 스토리" → H1 → deck → "승률 · 약 5분"
  → badge "재구성한 시나리오" + disclosure sentence, hero visual, game strip (NLHE 6인 · 100BB · BB/BTN),
  hero hand cards + class key (QQ / JTs), then per street: heading, board cards (flop / +turn / +river),
  timeline rows incl. derived blinds with amounts and notes (오픈, 3벳, 체크-레이즈, 남은 스택 전부), "팟
  N BB" line, narrative; showdown block with both hands, category + reading, verdict line; three `##`
  sections + TOC; ToolCTA; "이 핸드 다음에" footer; prev/next among hand stories. Nothing empty, no
  clipped H1 (break-keep), no horizontal scroll at 390.
- Prerendered HTML grep (`.next/server/app/ko/blog/<slug>.html`): `data-street` preflop/flop/turn/river/
  showdown present; disclosure sentence ×2 (meta + JSON-LD/meta); `data-winner="villain"` /
  `data-winner="hero"`; pots 22.5/38.5/78.5/138.5BB and 5.5/25.5/55.5/200.5BB; facts 66.79/73.84/4.55/
  25.48% and 19.15/34.97/19.57/35.86/20.45/27.03%; `<title>… · 3BetTilt</title>` once.
- `/ko/blog` hub screenshot: hand-story section shows four stories (S1's two + both S2), both also in
  the "전체 글" index.

## Known limitations

- Story pot-odds facts take "pot before villain's bet | bet" with call = bet, so the flop check-raise in
  story 2 (hero has 3 in, calls 7 more into 18.5) cannot be expressed — only the turn call is cited.
- `EXACT_EQUITY` is hindsight (villain's cards known); the prose says so explicitly each time.
- `relatedHands` uses existing pages only (`hand-qq`, `hand-jts`); there is no `hand-a4s`/`hand-k7s` page.
- 2 S2 stories cross-link each other via `relatedArticles`; S1/S3 story ids are not referenced (unknown at
  authoring time) — the orchestrator may add them once all six exist.

## Open issues

- Out of boundary: `HomeHeroVisual.tsx` import of `SUIT_PATH` breaks `tsc` and `next build` for everyone
  until the homepage agent exports it from `ContentThumbnail.tsx` (or drops the import).
- Out of boundary: S1's `blog-full-house-loses` links to `/learn/hand-rankings`, which `claims.test.ts`
  reports as dangling (the learn lesson id is `hand-rankings`; check the href helper used).

## Exact facts next agent may rely on

- Slugs/ids: `blog-qq-three-bet-frustration` (`/blog/qq-three-bet-frustration`),
  `blog-river-changes-everything` (`/blog/river-changes-everything`); both PUBLISHED, indexable,
  contentType `hand-story`, topics `equity` / `odds`, level BASIC, readMinutes 5 / 4.
- Fact values rendered (from `factValue`, two decimals): story 1 `EXACT_EQUITY` QQ vs A♦4♦ pre 66.79%,
  flop 73.84%, turn 4.55%; `POT_ODDS_REQUIRED_EQUITY 38.5|20` 25.48%; `RFI_POSITIONS_WITH A4s` =
  "UTG · HJ · CO · BTN · SB". Story 2 `OUTS_PROB 9|FLOP|NEXT` 19.15%, `9|FLOP|RIVER` 34.97%,
  `9|TURN|NEXT` 19.57%; `EXACT_EQUITY` flop 35.86%, turn 20.45%; `POT_ODDS_REQUIRED_EQUITY 25.5|15`
  27.03%. Final pots: 138.5BB / 200.5BB (summed by `resolve.ts`).
- A story needs ≥3 `##` headings in its MDX to be `indexable: true` (blog floor), on top of the two
  mandatory ones' names.

## Facts next agent MUST re-check

- Screenshots (once the build is green): StreetSection boards/timelines render from the record, the
  disclosure sits under the deck, showdown block shows both hands + verdict, no horizontal overflow at 390.
- If S1/S3 add stories, `NextRead`/prev-next order among hand stories follows `stories/index.ts` order
  (S1 → S2 → S3), not publish date.
