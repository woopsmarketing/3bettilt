# WP-Q1 — content & registry fixes

Owner of `apps/fishtilt/content/**` and `apps/fishtilt/src/content/registry/**` for the
FishTilt MVP fix round. Every card claim below was verified by running `HAND_STRENGTH`,
`exactHeadsUpEquity` and `evaluateHand` from the repo's own packages; the scripts lived in
the session scratchpad and no throwaway file was left in the repo.

**Gate run:** `pnpm vitest run --project fishtilt` → **1306 passed, 1 failed**. The one
failure is `src/components/HandChecker.test.tsx`, outside this agent's boundary and mid-flight
under another agent (its copy fixture still pins the pre-F11 `handRank.ts` sentence). Scoped
to this boundary: `pnpm vitest run --project fishtilt src/content` → **394 passed, 0 failed**.
No build, lint, typecheck or e2e was run, per brief.

---

## 1. Disposition, finding by finding

| # | Verdict | What was done |
| --- | --- | --- |
| **F1** blocker | **fixed** | `blog/is-ak-good.mdx:11`. The "위쪽 10위 안쪽" claim is gone. The paragraph now says AKs is the strongest non-pair and AKo is not, and names the three classes the ranking actually puts between them as `<Fact name="HAND_AT_RANK" arg="9\|10\|11" />` (77 · AQs · AJs). Verified: AKs rank 8 is the first entry with `comboCount !== 6`; AKo rank 12; AKo is the 4th non-pair. |
| **F3** blocker | **fixed** | `glossary/equity.mdx`. (a) Both definitional sentences (`:1`, `:5`) now say 팟에서 기대되는 몫 and carry the ties-split clause. (b) The worked example no longer says 두 손의 강도가 정확히 같아서. It says most runouts tie, one side wins outright when its suit fills to a flush, and the 50.00% comes from the two hands being mirror images. Verified by full enumeration of all 1,712,304 runouts: tie 1,467,192 · hero 122,556 · villain 122,556, and **every** outright win on either side is `FLUSH` (121,523) or `STRAIGHT_FLUSH` (1,033). Aligned with `learn/equity.mdx` in meaning, not copied from it. |
| **F4** should-fix | **fixed** (content + registry half) | 14 places. Content: `learn/starting-hand-ranking.mdx:1,5,9,90`; `blog/{why-72o-is-weak:7, small-pocket-pairs:7, is-ak-good:7, aks-vs-ako:15, next-best-after-aa:1,7, qq-vs-ak:1,23, why-suited-matters:15}`. Registry: `registry/glossary/j2.ts` (`term-equity.shortDefinition`), `registry/learn/h3.ts` (lesson 13 description). 승률 is **not** renamed; the P(win) assertions are. `why-suited-matters:15` and `qq-vs-ak:23` were not in P1's table — found by the grep the brief asked for. `term-equity`'s **alias** `이길 확률` was deliberately left in place (search alias, not prose). |
| **F8** should-fix | **fixed; the conclusion flipped** | `blog/outs-nine.mdx:7`. The synthesis now states that `9\|FLOP\|RIVER` needs both cards, that the number matching **one** call on the flop is `9\|FLOP\|NEXT`, and that it does **not** clear `POT_ODDS_REQUIRED_EQUITY 9\|3`. It states the no-further-betting assumption in the site's own words ("뒤에 추가 베팅이 없어서 두 장을 다 본다고 가정하면 … 넘지만") and closes with `/tools/outs`'s own line ("콜 한 번을 계산할 때는 다음 카드 한 장 확률이 더 안전한 기준"). The 손익분기점/콜하라는 뜻이 아닙니다 Callout was kept and extended, not removed (D5). **This required narrowing one existing assertion — see §4.** |
| **F13** note | **fixed** | `blog/small-pocket-pairs.mdx:11`. "그 폭이 아주 크지는 않습니다" is gone; the paragraph now says the move is not small and shows `<Fact HAND_RANK 33/>` = 66 and `<Fact HAND_RANK 44/>` = 48 between 22 (87) and 55 (27). |
| **F9** note | **fixed** | `learn/pot-odds.mdx:31`. The comparison now names its assumption (쇼다운까지, 뒤에 추가 베팅 없이) before drawing the 손해가 아닙니다 conclusion, and adds that a turn/river bet breaks the comparison. The surrounding Callout was kept intact (D5). Side effect: the lesson crossed a reading-time boundary, so `registry/learn/h3.ts` `pot-odds.readMinutes` 4 → 5 (the threshold test requires it). |
| **M3** major | **fixed** | `blog/{same-pair-who-wins, playing-the-board, what-is-kicker}.mdx` — 11 occurrences of bare `Hero`/`Villain` replaced with 한 사람 / 다른 사람 / 두 사람, matching `flush-vs-straight` and `full-house-vs-flush`. Result sentences reworded so the winner is identified by the card ("퀸을 든 쪽", "9를 든 쪽"), not by a role name. Zero `Hero`/`Villain` left in `content/**`. |
| **M5** major | **fixed** (content + registry half) | 오프슈트 → **오프수트**, 14 occurrences across `glossary/{suited, offsuit, combo, hand-matrix, pocket-pair}.mdx`. 배팅 → **베팅**, 11 occurrences across `glossary/{preflop, river, flop, turn, board}.mdx` plus `registry/learn/h2.ts:99` and `registry/glossary/j2.ts:156,158`. **플롭 does not occur in `content/**` at all** — the only occurrences are the deliberate search aliases and the two tool labels in Q2's boundary. 수트드 is in `features/strength/copy.ts` (Q2). No alias array was touched; `registry/glossary/j1.ts:385`'s 배팅 misspelling alias is intact. |
| **M6** major | **fixed** | All 9 references are now links, using markdown links — the mechanism `mdx-components.tsx` already maps and styles (`a:` in `TYPOGRAPHY`), verified to compile through `@mdx-js/mdx` both in normal prose and inside a `<Callout>`. `hands/a5s.mdx:8`'s false "확인했습니다" is gone ("[AQo 페이지](/hands/aqo)를 보면, …"). `glossary/hand.mdx:15`'s vague "이 사이트의 다른 글에서도" now names both lessons. A new test asserts every in-prose link resolves to a PUBLISHED content path — see §3. |
| **M9** major | **fixed, no floor breach** | `blog/why-called-3bet.mdx`: the second from-zero 1-2-3 Callout is gone; the section now states only *what* is counted (금액이 커진 순간) and links to lesson 12. `glossary/three-bet.mdx` and `glossary/four-bet.mdx`: each keeps one sentence and links to lesson 12. Final lengths 1093 / 408 / 445 against floors 900 / 400 / 400, and section counts 3 / 4 / 4 against floors 3 / 2 / 2 — **nothing needed padding.** See §4 for the ruling-18 constraint this ran into. |
| **M14** major | **fixed** | `blog/pot-odds-quick.mdx:5`. "상대가 콜 값어치(Pot Odds)를 따질 필요도 없이 흔한 크기인 하프팟(3BB)을 베팅하면" → "팟이 6BB일 때 상대가 흔한 크기인 하프팟(3BB)을 베팅하면, 이 콜의 `<Term>`팟오즈(Pot Odds)`</Term>`가 요구하는 최소 승률은 …". |
| **m3** minor | **fixed** | `glossary/{flop, turn, river, draw}.mdx` final sections. Each advice-adjacent generalisation was replaced with something the site can back: flop = five cards first exist there so a 족보 first becomes判定-able (the evaluator needs five); turn = the same out count gives a different probability because two unseen cards became one (`outsOdds` street); river = the five are fixed and `DRAW_STREETS` has no `RIVER` member because nothing is left to count; draw = the probability is fixed by unseen cards and outs, and is not the probability of winning the pot. `turn.mdx`'s doubled "커지는 경우가 많습니다" is gone. Lengths 456 / 410 / 421 / 453, all above the 400 floor. |
| **m4** minor | **fixed, partly stale** | `hands/qjs.mdx:13` used 브로드웨이 bare and is now glossed `브로드웨이 패(10·J·Q·K·A 중 두 장으로 이루어진 패)`. **`kjs.mdx` and `jts.mdx` were already glossed** at first use inside their own Callouts ("흔히 10·J·Q·K·A처럼 10 이상인 다섯 장…") — the review's list of three was one page too long; they were left alone. `9-high` / `King-high` are now glossed in place in `playing-the-board` and `what-is-kicker`, and both labels are pinned by a test that re-derives the straight's top rank from `evaluateHand`. |
| **m5** minor | **fixed** | `glossary/pfr.mdx` rewritten: two VPIP sections merged into one, and the duplicated "FishTilt는 이 숫자를 계산하지 않습니다" section dropped (its honest content folded into the HUD-program section that already said it; `vpip.mdx` keeps the standalone version). Five sections → three. One genuinely new, non-duplicative fact added to clear the floor rather than filler: every raised pot is also a voluntary pot, so PFR's set is always inside VPIP's. 485 → 448 chars, 2 sections, above both floors. |
| **m6** minor | **fixed, bounded by ruling 18** | The FAQ now answers the poker question: the only place the count can diverge is whether the forced big blind is counted as the first bet, and dropping it shifts every name down one. The honest "이 사이트에 근거가 없다" stays as the *reason* for not asserting a competing convention, which is exactly what ruling 18's test requires. See §4. |
| **m7** minor | **fixed** | `registry/glossary/j2.ts` — `쓰리페어 아님` removed from `term-two-pair.aliases`. |
| **m8** minor | **7 of 10 fixed; 3 reported instead** | Added exactly one inbound `<Term>` each, on a page where the word already occurs, with the matching `relatedConcepts` entry: `term-high-card`, `term-three-of-a-kind`, `term-straight-flush` → `learn/poker-hand-rankings.mdx` (하이카드 / 트리플 / 스트레이트 플러시 all already in that lesson's prose); `term-hand` → `hands/aks.mdx:12` ("핸드 뒤에 붙는 s는"); `term-heads-up` → `glossary/small-blind.mdx:17` ("두 사람만 남는 헤즈업 상황"); `term-pfr` → `glossary/vpip.mdx:17`; `term-vpip` → `glossary/pfr.mdx`. **`bluff`, `c-bet`, `nuts` were not fixed**: 블러프, C-Bet/컨티뉴에이션/씨벳 and 넛츠 occur **nowhere** in `content/**` outside their own entries (checked with every spelling variant). Per the brief, reporting rather than inserting the word to link it. |

---

## 2. Files changed

**Content (39):** `content/blog/{is-ak-good, small-pocket-pairs, why-72o-is-weak, aks-vs-ako,
next-best-after-aa, qq-vs-ak, why-suited-matters, outs-nine, pot-odds-quick, same-pair-who-wins,
playing-the-board, what-is-kicker, why-use-range, why-called-3bet, full-house-vs-flush}.mdx` ·
`content/learn/{starting-hand-ranking, pot-odds, flop-turn-river, poker-hand-rankings}.mdx` ·
`content/glossary/{equity, flop, turn, river, draw, pfr, vpip, three-bet, four-bet, hand,
small-blind, suited, offsuit, combo, hand-matrix, pocket-pair, preflop, board}.mdx` ·
`content/hands/{qjs, a5s, aks}.mdx`

**Registry (6):** `src/content/registry/glossary/{j1,j2}.ts` ·
`src/content/registry/learn/{h1,h2,h3}.ts` · `src/content/registry/hands/e3.ts`

**Tests (2):** `src/content/claims.test.ts` (new) · `src/content/registry/blog/i4.test.ts` (§4)

Only files I edited were formatted (`npx prettier --write <paths>`); `pnpm format` was not run.

---

## 3. Tests added — `src/content/claims.test.ts` (17 assertions, all green)

Each test **derives the relationship from the shipped dataset** and then checks the prose
against it, so a regenerated dataset changes the precondition rather than breaking a copied
literal. Every one was confirmed to fail against the original defective sentence by
re-introducing that sentence and re-running the file:

| Test | Derived from | Re-introduced defect | Result |
| --- | --- | --- | --- |
| AKs is the strongest non-pair; AKo is not adjacent to it | `HAND_STRENGTH.entries` (`comboCount !== 6`) | — (invariant) | passes |
| is-ak-good never claims a top-N cut the ranking does not support — every `N위 안/이내/안쪽` in the file must hold for both `AKs.rank` and `AKo.rank` | `HAND_STRENGTH` ranks | `둘 다 169가지 중 위쪽 10위 안쪽에…` | **2 failed** |
| is-ak-good names every class between AKs and AKo as a `HAND_AT_RANK` fact | ranks strictly between the two | same sentence | **2 failed** |
| AsKs/AhKh: `equity === 0.5`, `winProb === loseProb > 0`, `tieProb < 1` | `exactHeadsUpEquity` | — (invariant) | passes |
| One side can make a flush the other cannot (`2s 7s 9s 4d 8c`) | `evaluateHand` | — (invariant) | passes |
| glossary/equity explains the 50% by 대칭 + 플러시 and never by 강도가 정확히 같아 | the three derived facts above | `두 손의 강도가 정확히 같아서…` | **1 failed** |
| glossary/equity defines equity as 기대되는 몫 with 절반만 이긴 것으로, never 이길 확률 | D1 | `…끝까지 갔을 때 이길 확률을 말합니다.` | **1 failed** |
| 22 → 55 moves more than a quarter of the whole ranking | `HAND_STRENGTH` ranks | — (invariant) | passes |
| small-pocket-pairs does not call that move small, and shows every pair between them | ranks between 55 and 22 | `그 폭이 아주 크지는 않습니다.` | **1 failed** |
| the 9-high / King-high straight labels match the boards they sit under | `evaluateHand(...).ranks[0]` | bare `9-high 스트레이트` / `King-high 스트레이트` | **1 failed each** |
| equity and P(win) really do differ (`8h8c` vs `AdKd`: `tieProb > 0`, `equity !== winProb`) | `exactHeadsUpEquity` | — (invariant) | passes |
| **D1 site-wide guard:** no paragraph that renders `HAND_EQUITY_VS_RANDOM` / `CLASS_VS_CLASS_EQUITY` / `EXACT_EQUITY` may also contain 이기는 비율 / 이길 확률 / 를 이깁니다 / 을 이깁니다 | D1 | `…이기는 비율은 <Fact HAND_EQUITY_VS_RANDOM 72o/>입니다.` | **1 failed** |
| **M6 guard:** every `](/…)` in any published MDX that points into a content root resolves to a PUBLISHED content path, and there is at least one such link | the content graph | `](/learn/outz)` | **1 failed** |

The D1 guard is the one worth keeping past this round: it is the mechanical form of the rule,
and it covers every future page rather than the 14 places P1 happened to find.

---

## 4. The one existing test that was changed, and why

`src/content/registry/blog/i4.test.ts`, three edits. Nothing was deleted or skipped.

**(a) Three verbatim hand-off pins — literal updated, assertion unchanged.** The §2.3 hand-off
sentences in `why-use-range`, `pot-odds-quick` and `outs-nine` are pinned verbatim. M6 turned
the lesson reference inside each into a link, so the pinned literal was updated to the linked
form. The assertion is now strictly stronger — it pins the href as well as the sentence.

**(b) The `9|FLOP|NEXT` anti-duplication ban — narrowed, with a compensating assertion.** This
is the one real conflict in this work package and it needs MASTER's eye.

The rule was: `outs-nine` must never cite `OUTS_PROB 9|FLOP|NEXT`, because `learn/outs.mdx`
already shows the per-street breakdown for the same 9-out flush draw. F8 is the finding that
the article's own synthesis priced the **by-river** probability against **one** call — and the
honest comparison needs the next-card number. MASTER accepted F8 explicitly ("the conclusion
flips"). The correctness requirement and the anti-duplication rule collide, and there is no
third option: the article cannot state which side of the price it lands on without that number.

So the ban was narrowed rather than dropped. `FLOP|NEXT` must now appear **exactly once**, and
its index must fall **inside the pot-odds synthesis section** (between `## 이 숫자, 콜에 쓸 수
있나요?` and the next heading) — which is what makes it a synthesis rather than a restatement of
the lesson's breakdown. `TURN|NEXT` stays banned outright. The reasoning is written into the
test as a comment naming the disposition. If MASTER would rather keep the absolute ban, the
alternative is a weaker F8 that states the assumption but withdraws the conclusion instead of
flipping it; say so and I will do that instead.

**(c) Ruling 18 (`가장 널리 쓰이는 세는 방식`) — restored, not overridden.** My first pass at m6
dropped that phrase from `why-called-3bet.mdx` because it looked unbacked next to the FAQ's own
"이 사이트에 근거가 없다". `i4.test.ts` pins it as ruling 18. Per CLAUDE.md rule 9 the phrase was
restored verbatim and the FAQ was rewritten to sit inside the ruling instead: it answers the
poker question (the count can only diverge on whether the forced BB is the first bet), and keeps
the original closing sentence "없는 근거를 있는 것처럼 쓰지 않습니다" as the reason for not asserting
a competing convention. **Flagging it because the tension is real:** ruling 18 has the site
assert its convention is the most widely used, and the site has no source for that either. That
is a ruling-level question, not a fix-agent one.

---

## 5. Left for another agent's file boundary

| What | Whose | Note |
| --- | --- | --- |
| M5: 플롭 → 플랍 on the outs calculator's street buttons and the equity calculator's board-length line | **Q2** | `content/**` has zero occurrences of 플롭; both live in tool labels. |
| M5: 수트드 → 수티드, `features/strength/copy.ts:66` | **Q2** | — |
| F4: `features/strength/copy.ts:45,61`, `features/quiz/startingHandQuestions.ts:55`, `app/hands/[hand]/page.tsx:181,187` | **Q2 / Q3** | The new D1 guard in `claims.test.ts` reads MDX only, so it does **not** cover these. §4 of the disposition already schedules extending the advice guard to `src/**` Korean literals; the D1 guard should be extended the same way and at the same time. |
| `src/components/HandChecker.test.tsx` still pins the pre-F11 `handRank.ts` sentence | **Q3** | The only failing test in the suite as of this hand-off. Not touched. |

---

## 6. Residual risk

1. **The `9|FLOP|NEXT` narrowing (§4b)** is the one place a guard got looser. It is bounded
   (exactly one occurrence, in one named section) and documented in the test, but it is a real
   relaxation of an anti-duplication rule and MASTER should ratify or reverse it.
2. **Ruling 18's own unbacked claim (§4c)** — flagged, not touched.
3. **`bluff`, `c-bet`, `nuts` still have zero inbound links.** Nothing on the site says those
   words outside their own entries, so any link would have required inserting the word first.
   If MASTER wants them reachable, the honest route is a page that genuinely needs the concept
   (`playing-the-board` describes the nuts situation without ever naming it), which is new
   content, not a link fix.
4. **Markdown links are new to `content/**`.** No MDX file used one before this round; the
   mechanism is real (`mdx-components.tsx` maps and styles `a`, and I compiled both the plain
   and the inside-`<Callout>` cases through `@mdx-js/mdx` 3.1.1), but it has never been through
   a production build or a browser here. The new link-resolution test covers dead paths, not
   rendering. Worth one glance during MASTER's build gate.
5. **Length margins are thin site-wide.** Several glossary entries sit within ~10 characters of
   the 400 floor, and `three-bet.mdx` is at 408. Any future trim of those pages will breach the
   threshold test before anyone notices the prose got worse.
6. **`learn/pot-odds` now claims 5분 instead of 4분.** That is the threshold test's own
   arithmetic on the longer text, not a judgement call, but it is a user-visible change that
   came out of F9 rather than being asked for.
