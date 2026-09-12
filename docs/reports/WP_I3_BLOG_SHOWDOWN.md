# WP-I3 — Blog batch 3: 쇼다운에서 실제로 벌어지는 일

## 1. Scope

Five blog answers on showdown mechanics, per `docs/FISHTILT_CONTENT_PLAN.md` §7 "I3" / §2.2
"I3", ruling 19 and ruling 28 (`docs/FISHTILT_STATE.md`): `blog-btn-why-wide` (replaced the
placeholder), `blog-same-pair-who-wins`, `blog-what-is-kicker`, `blog-playing-the-board`,
`blog-a2345-wheel`. Four of the five turn on who actually wins a specific showdown; every
such claim was verified by running the real evaluator (`evaluateHand`/`bestFiveOf`/
`compareHands` from `@gto-self/strategy-core`) over the exact cards printed — never reasoned
out. `blog-btn-why-wide` is the trap article: it states the button's mechanical fact (acts
last) and the site's `RFI_*` dataset facts, and explicitly names and denies the strategy
claim it refuses to make.

## 2. Files changed

| File | What |
| --- | --- |
| `apps/fishtilt/content/blog/btn-why-wide.mdx` | Rewrote placeholder — real article |
| `apps/fishtilt/content/blog/same-pair-who-wins.mdx` | New |
| `apps/fishtilt/content/blog/what-is-kicker.mdx` | New |
| `apps/fishtilt/content/blog/playing-the-board.mdx` | New |
| `apps/fishtilt/content/blog/a2345-wheel.mdx` | New |
| `apps/fishtilt/src/content/registry/blog/i3.ts` | Flipped all 5 `PLANNED`→`PUBLISHED`, `indexable: true`, `readMinutes: 3`; added `relatedArticles` cross-links between #11/#12/#13; added `term-split-pot` to `blog-what-is-kicker`'s `relatedConcepts` |
| `apps/fishtilt/src/content/blog/i3.ts` | MDX map — 5 imports registered by slug |
| `apps/fishtilt/src/content/registry/blog/i3.test.ts` | New — this batch's test file (30 tests) |
| `docs/reports/WP_I3_BLOG_SHOWDOWN.md` | This report |

Nothing outside this list was touched. Scratch verification scripts ran from
`/private/tmp/.../scratchpad/` only, never in the repo.

## 3. Article table

| id | question | answer (one line) | facts cited | outbound links |
| --- | --- | --- | --- | --- |
| `blog-btn-why-wide` | BTN이 좋은 자리인 이유 | BTN이 프리플랍 이후 모든 라운드에서 가장 마지막에 행동한다는 사실과, 학습용 기본 레인지에서 BTN의 조합 수/비율이 UTG보다 크다는 사실만 — "더 넓게 쓰는 게 이득"이라는 주장은 명시적으로 거부 | `RFI_COMBOS`(UTG,BTN), `RFI_PERCENT`(UTG,BTN), `RFI_POSITIONS_WITH`(65s) | `range` (deep link `hero=BTN&spot=RFI&stack=100`), lesson `position` |
| `blog-same-pair-who-wins` | 같은 원페어면 누가 이길까? | 같은 숫자로 페어가 같다면 남은 카드(키커)를 높은 순서로 비교 — Ks Kd 7h 4c 2s 보드에서 As Qc가 Ah Jc를 이김(첫 키커 A=A 타이, 둘째 키커 Q>J) | 없음 (숫자 없는 글) | `toolHandChecker`, `term-kicker`, lesson `hand-rankings`, article `blog-what-is-kicker` |
| `blog-what-is-kicker` | kicker란? | 족보 종류·숫자가 같을 때 승부를 가르는 나머지 카드; 다섯 장이 이미 족보를 다 쓰면(보드가 플레이하면) 키커 자체가 없음 — 두 사례 모두 실제 카드로 증명 | 없음 | `toolHandChecker`, `term-kicker`, `term-split-pot`, lesson `hand-rankings`, articles `blog-same-pair-who-wins`/`blog-playing-the-board` |
| `blog-playing-the-board` | 보드만으로 족보가 완성되면? | 보드 다섯 장 자체가 이미 최선이면 손패와 무관하게 스플릿; 손패로 보드를 넘어서면 스플릿 아님 — 두 보드 모두 실제 카드로 증명 | 없음 | `toolHandChecker`, `term-split-pot`, `term-board`, lessons `hand-rankings`/`flop-turn-river`, article `blog-what-is-kicker` |
| `blog-a2345-wheel` | A2345는 스트레이트인가? | 예, A2345(휠)는 스트레이트이자 가장 약한 스트레이트; QKA23은 감아 도는 모양이라 스트레이트 아님 — 둘 다, 그리고 휠이 23456에 진다는 것까지 실제 카드로 증명 | 없음 | `toolHandChecker`, `term-straight`, lesson `hand-rankings` |

Every "숫자 없음" row matches `docs/FISHTILT_CONTENT_PLAN.md` §2.2/I3's own "숫자 없음"
annotation — no `<Fact>` was needed or invented for #11–#14.

## 4. Evaluator output — every showdown claim, card by card

Script: `/private/tmp/claude-501/-Users-woops-projects-GTO-SELF/409b3b64-c5fb-4fa3-955b-a5c869474a5b/scratchpad/verify-showdowns-final.ts`, run via `npx tsx`, importing `evaluateHand`/
`bestFiveOf`/`compareHands` from `@gto-self/strategy-core` directly (never reasoned by hand).
Full captured output:

```
=== CASE A: blog-same-pair-who-wins — same pair (Kings), tied first kicker, second kicker decides ===
Hero (As Qc + board): input=[As Qc Ks Kd 7h 4c 2s] -> category=PAIR ranks=[11,12,10,5]
Villain (Ah Jc + board): input=[Ah Jc Ks Kd 7h 4c 2s] -> category=PAIR ranks=[11,12,9,5]
compareHands(hero, villain) = 1 (expect 1, hero wins on 2nd kicker Q>J after both tie on 1st kicker A=A)

=== CASE B: blog-what-is-kicker (part 1) — same pair (Aces), single kicker decides ===
Hero (Ac Kd + board): input=[Ac Kd Ah Td 6c 3s 2d] -> category=PAIR ranks=[12,11,8,4]
Villain (Ad Qh + board): input=[Ad Qh Ah Td 6c 3s 2d] -> category=PAIR ranks=[12,10,8,4]
compareHands(hero, villain) = 1 (expect 1, hero wins: K kicker beats Q kicker)

=== CASE C: blog-what-is-kicker (part 2) — board plays, kicker comparison never reached ===
Hero (2c 3d + board): input=[2c 3d Kh Qd Jc Ts 9h] -> category=STRAIGHT ranks=[11]
Villain (4s 5c + board): input=[4s 5c Kh Qd Jc Ts 9h] -> category=STRAIGHT ranks=[11]
compareHands(hero, villain) = 0 (expect 0, both just play the board straight)

=== CASE D: blog-playing-the-board — board genuinely best five for both -> SPLIT ===
Hero (2c 3d + board): input=[2c 3d 5h 6d 7c 8s 9h] -> category=STRAIGHT ranks=[7]
Villain (Ac Kd + board): input=[Ac Kd 5h 6d 7c 8s 9h] -> category=STRAIGHT ranks=[7]
compareHands(hero, villain) = 0 (expect 0 = split)

=== CASE E: blog-playing-the-board — board NOT best five for both -> no split ===
Hero (Ac 9c + board): input=[Ac 9c 9h 9d 7c 4s 2h] -> category=TRIPS ranks=[7,12,5]
Villain (Kd Qd + board): input=[Kd Qd 9h 9d 7c 4s 2h] -> category=PAIR ranks=[7,11,10,5]
compareHands(hero, villain) = 1 (expect nonzero = no split; hero trips beats villain pair)

=== CASE F: blog-a2345-wheel — A2345 IS a straight (five-high / the wheel) ===
A2345: input=[Ah 2c 3d 4c 5s] -> category=STRAIGHT ranks=[3]
category === STRAIGHT ? true

=== CASE G: blog-a2345-wheel — QKA23 is NOT a straight (no wrap-around) ===
QKA23: input=[Qh Kc Ad 2c 3s] -> category=HIGH_CARD ranks=[12,11,10,1,0]
category === STRAIGHT ? false (expect false)

=== CASE H: blog-a2345-wheel — the wheel (A2345) loses to 23456 (six-high) ===
A2345: input=[Ah 2c 3d 4c 5s] -> category=STRAIGHT ranks=[3]
23456: input=[2h 3c 4d 5c 6s] -> category=STRAIGHT ranks=[4]
compareHands(wheel, sixHigh) = -1 (expect -1, wheel is the lowest straight)
```

All eight outcomes matched the predicted result on the first run. `ranks[0]` encoding is
0-indexed from `2` (`3`=`5`, `11`=`K`, `12`=`A`), consistent with `evaluate.ts`'s own decode.

These same eight cases are now also asserted as permanent regression tests in
`apps/fishtilt/src/content/registry/blog/i3.test.ts` (describe block "ruling 28: showdown
claims are evaluator-verified, not reasoned"), so a future edit that silently changed a card
in the MDX would fail the suite, not just a one-off script.

## 5. What `blog-btn-why-wide` says instead of a strategy claim

Quoted directly from the published article:

> 이것이 이 글에서 사실로 확인할 수 있는 전부입니다. 그 정보 차이가 실제로 어떻게 유리하게 쓰이는지, 얼마나 유리한지는 이 글의 범위 밖입니다.

> 칸이 더 많다는 사실이 "버튼에서 패를 더 넓게 쓰는 게 이득이다"라거나 "이렇게 쓰는 것이 맞는 방식이다"라는 뜻은 아닙니다. 이 글은 학습용 기본 레인지 표 안에 실제로 어떤 패가 들어 있는지, 그리고 그 표가 왜 자리마다 다른 모양을 하고 있는지를 보여줄 뿐입니다. 그 표가 왜 이런 모양으로 만들어졌는지, 실전에서 이 정보를 어떻게 다뤄야 하는지는 이 사이트가 아직 답할 수 있는 범위 밖에 있습니다.

> 이 글에서 확실하게 말할 수 있는 것은 두 가지뿐입니다. 버튼은 행동 순서상 가장 마지막에 결정하는 자리라는 것, 그리고 그 자리를 기준으로 한 학습용 기본 레인지가 더 많은 조합을 담고 있다는 것입니다. 그 정보를 실전에서 어떻게 활용해야 하는지는 다루지 않습니다.

The article names the exact claims a competent poker writer would reach for ("이득이다",
"맞는 방식이다") and explicitly denies making them, per ruling 38's pattern (honest content
discusses the claim it refuses to make). `i3.test.ts` asserts both halves: that the denial
is present, and — stripping the `<Callout>` and every negated sentence first, to avoid the
exact "a substring check cannot tell a claim from its denial" trap ruling 38 warns about —
that no unhedged affirmative version of the claim survives outside the negation.

## 6. Facts wanted and not obtained

None. `docs/reports/WP_G3B_CONTENT_FACTS.md` shipped every fact this batch's plan row
(§2.2/I3) called for (`RFI_COMBOS`, `RFI_PERCENT`, `RFI_POSITIONS_WITH`), and the other four
articles are explicitly "숫자 없음" per the plan — no fact was needed, wanted, or invented for
them.

## 7. Tests run

| Command | Result |
| --- | --- |
| `pnpm vitest run --project fishtilt -t "blog batch I3"` | **30/30 passed** (this batch's own file) |
| `pnpm vitest run --project fishtilt` (whole app, run twice to confirm stability) | **926/931 passed, 5 failed, 3 failed files** — stable across two runs. All 5 failures are in files this batch does not own and never touched: `src/content/content.test.ts` (2 failures — both name only I4's slugs, `blog-outs-nine`/`blog-why-blinds-exist`/`blog-why-called-3bet`/`blog-why-use-range`/`blog-pot-odds-quick`, all under the 900-char blog threshold or with a wrong `readMinutes`), `src/content/registry/blog/i4.test.ts` (1 failure, I4's own threshold assertion on its own record), and `src/app/blog/page.test.tsx` (1 failure — `screen.getAllByText('준비 중')` throws now that all 20 registered blog records across I1–I4 are `PUBLISHED`, i.e. zero remain `PLANNED`; this is the ruling-26 pattern `docs/FISHTILT_STATE.md` describes recurring, in a shared file under `src/app/**` outside this batch's boundary — reported, not fixed, per that ruling's precedent). Confirmed via `git status --porcelain` that none of `content.test.ts`, `i4.ts`, `i4.test.ts`, or `page.test.tsx` were touched by this batch. |
| `pnpm typecheck` (13 workspace projects) | PASS, no errors |
| `npx eslint apps/fishtilt --max-warnings=0` | PASS, no output |

## 8. Known limitations

- `blog-what-is-kicker`'s "kicker decides" example (Case B) and `blog-same-pair-who-wins`'s
  primary example (Case A) are deliberately different card sets (Aces-full-house-adjacent
  board vs. a paired board) so the two articles do not show the reader an identical scenario
  twice, per the ownership split in the brief (#11 owns "what actually happens", #12 owns
  "the definition + the case it cannot decide").
- `blog-playing-the-board`'s "does not split" example (Case E, trips vs. pair) is a clean,
  intentionally unambiguous contrast rather than a close one — appropriate for a `BASIC`
  beginner article per `docs/FISHTILT_CONTENT_PLAN.md` §6.3's own rule against forcing
  advanced content into an MVP article.
- `blog-btn-why-wide`'s deep-linked `<ToolCTA tool="range" params={{ hero: 'BTN', spot: 'RFI', stack: '100' }}>` relies on `/tools/range`'s existing client-side query parsing
  (`features/range/url.ts`), confirmed by reading that module — not assumed.
- The five `.mdx` files could not be render-tested under vitest (`docs/reports/
  WP_QA_MDX_TEST_GAP.md`, `docs/FISHTILT_STATE.md` ruling 37); `pnpm build:fishtilt` is the
  orchestrator's gate to run, per that ruling, and was not run here as instructed.
