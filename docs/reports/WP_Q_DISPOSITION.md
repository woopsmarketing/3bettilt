# WP-Q — MASTER disposition of the two independent reviews

Both independent reviews are in. Per CLAUDE.md §44 they are dispositioned **together**, by
MASTER, before any fix is written — so that a fix for one review cannot quietly re-open the
other's finding.

| review | report | findings |
| --- | --- | --- |
| WP-P1 — poker & mathematics correctness | `docs/reports/WP_P1_POKER_CORRECTNESS_REVIEW.md` | 3 blocker · 5 should-fix · 5 note |
| WP-P2 — beginner UX, IA, SEO | `docs/reports/REVIEW_BEGINNER_UX_SEO.md` | 1 blocker · 14 major · 10 minor |

**Blocker count: 4. One (P2-B1) is already fixed. Three remain.**

MASTER verified P1's three blockers personally in source before accepting them — F1's
`<Fact>` does render `12` two clauses before the sentence claiming top-10; `about/page.tsx:51`
does say the range is *not* copied from a specific site while `strategy-core/preflop/tables.ts:39`
says four of five positions are "transcribed VERBATIM" from one; `glossary/equity.mdx` does
define equity as 이길 확률 while rendering a ties-split number.

---

## 1. Standing decisions that bind every fix agent

These are MASTER decisions, not suggestions. An agent that disagrees reports it and stops;
it does not decide differently.

### D1 — The equity metric may never be called "the proportion of the time you win"

`HAND_STRENGTH.entries[].equity` and `EXACT_EQUITY` are **hero's expected share of the pot
with ties split** (`packages/learn-core/src/strength/model.ts:10`). P1-F4 measured the gap
between that and P(win) at up to **2.87 pp** (72o: equity 34.58%, P(win) 31.71%, P(tie) 5.83%)
— on numbers the site prints to two decimals. Calling it 이기는 비율 / 이길 확률 is therefore
wrong past the precision the site itself claims. This is CLAUDE.md rule 2 and rule 5 territory:
the number is real, the sentence about it is not.

**The metric is NOT renamed site-wide.** 승률 stays as the friendly label — a late, wholesale
rename of the site's most-used word is high-churn and low-value, and `learn/equity.mdx` already
shows the right pattern. What changes:

1. Every **definitional** sentence must carry the ties-split meaning. The canonical form, taken
   from the page that already gets it right (`learn/equity.mdx:1,15`):
   > 지금 이 패가 끝까지 갔을 때 **팟에서 가져갈 것으로 기대되는 몫**입니다. 정확히 비기는
   > 경우는 절반만 이긴 것으로 계산에 들어갑니다.
2. `이기는 비율`, `이길 확률`, `X%를 이깁니다` → wording that does not assert P(win).
   `X%의 몫을 기대할 수 있습니다` / `기대되는 몫은 X%입니다`.
3. Where 승률 appears as a bare label next to a number, the ties-split definition must be
   reachable **on that surface** — an adjacent clause, or the existing methodology disclosure.

### D2 — The range's provenance must be described as what it is

`packages/strategy-core/src/preflop/tables.ts:39` (the project's own comment): UTG / HJ / CO /
BTN are **transcribed VERBATIM** from one public teaching chart — "the only public source found
that publishes 13x13 hand-class detail for this spot", i.e. **single-sourced**. Only SB is
computed by this project (`trimSbCompositeToRaiseOnly`, because that source's SB list is a
raise-or-limp composite).

So `about/page.tsx:51` ("특정 사이트의 데이터를 베낀 것이 아니라 … 계산한 값") is the opposite of
true, and "**여러** 무료 포커 교육 자료를 참고해 정리한" overstates the sourcing on two more
surfaces. All three must say: 공개된 무료 포커 교육 자료 한 곳의 6인·100BB 차트를 그대로 옮긴
목록이고, SB만 그 자료의 목록이 레이즈와 림프를 합친 형태여서 레이즈 부분만 남기도록 이 사이트가
다시 계산했다. The percentages those lists produce are corroborated three ways — that part may
stay, stated as being about the percentages.

**Naming the source site on a public page is not an agent's call.** Describe accurately without
naming it; MASTER raises naming as an open question for the user in the final report.

### D3 — A wider range is never explained by saying it does not lose money

`blog/btn-why-wide.mdx` is the site's settled stance on this exact question and it is correct:
it states the one structural fact (BTN acts last on every postflop street), shows the table
difference in `<Fact>` numbers, and says in as many words that more cells does **not** mean
opening wider is 이득 or 맞는 방식, and that *why* the table has that shape is "이 사이트가 아직
답할 수 있는 범위 밖". Any surface explaining range width adopts that stance verbatim in spirit.

P1-F2's second half also stands on its own: "앞사람들이 이미 폴드했을 가능성이 높아" is **factually
wrong for the spot being displayed**. These are RFI ranges — everyone before hero has folded by
definition, at UTG exactly as much as at BTN. The quantity that actually differs is how many
players remain **to act behind**.

### D4 — Every number stays a `<Fact>`

No fix may introduce a numeric literal into prose. If a fix needs a number that has no fact
name, the agent **reports it and leaves the sentence unfixed** rather than typing the digits.
This rule is why P1's Filter C found zero invented numbers across 113 files; the fix round does
not get to be the exception.

### D5 — Fixing a sentence must not delete the caveat around it

Several findings sit inside refusal blocks (F2, F8, F9, m3, M7). The refusal is the site's
product. Narrow the claim, correct the mechanism, add the missing assumption — do not remove
a 뜻은 아닙니다 / 범위 밖 caveat to make a paragraph flow.

---

## 2. Disposition — P1 (poker & mathematics)

| # | Sev | Disposition | Owner |
| --- | --- | --- | --- |
| F1 `blog/is-ak-good.mdx:11` AKo claimed top-10, is 12th | blocker | **ACCEPT — fix** | Q1 |
| F2 `RangeExplorer.tsx:396` profitability claim + wrong mechanism | blocker | **ACCEPT — fix per D3** | Q2 |
| F3 `glossary/equity.mdx` equity = 이길 확률; example reason wrong | blocker | **ACCEPT — fix per D1** | Q1 |
| F4 site-wide "이기는 비율" (15 places) | should-fix | **ACCEPT — fix per D1** | Q1 (content+registry) · Q2 (features) · Q3 (`hands/[hand]/page.tsx`) |
| F5 `/tools/outs` ×2/×4 error direction backwards | should-fix | **ACCEPT — fix** | Q2 |
| F6 `/tools/hand-checker` kicker as universal tiebreaker | should-fix | **ACCEPT — fix** | Q2 |
| F7 range provenance on 3 surfaces | should-fix | **ACCEPT — fix per D2** | Q2 |
| F8 `blog/outs-nine.mdx` two-card prob priced against one call | should-fix | **ACCEPT — fix; the conclusion flips** | Q1 |
| F9 `learn/pot-odds.mdx` same shape, unstated assumption | note | **ACCEPT — fix** | Q1 |
| F10 `strength/copy.ts:103` wrong cause for top-X% overshoot | note | **ACCEPT — fix** | Q2 |
| F11 `handRank.ts:259` "보드가 당신의 핸드보다 강합니다" | note | **ACCEPT — fix** | Q2 |
| F12 `/tools/starting-hand` CTA drops the 학습용 기본 레인지 label | note | **ACCEPT — fix** | Q2 |
| F13 `blog/small-pocket-pairs.mdx:11` "폭이 크지는 않습니다" (22=87th, 55=27th) | note | **ACCEPT — fix** | Q1 |

**13 of 13 accepted. Nothing rejected.** Every one is the same defect class the audit round
already named: a sentence reasoning on top of a correct computed number. P1 found six of them
in `src/**`, which no previous sweep had ever been pointed at — see §4.

## 3. Disposition — P2 (beginner UX, IA, SEO)

| # | Sev | Disposition | Owner |
| --- | --- | --- | --- |
| B1 `glossary/pot-odds.mdx` call/fold advice | blocker | **DONE** — fixed by MASTER before dispatch; a site-wide guard now pins the class (`src/content/content.test.ts`) | — |
| M1 homepage primary CTA → `/tools/range`, which has no way back into the curriculum | major | **ACCEPT, split.** `처음부터 배우기` becomes the primary CTA (the product loop is SEARCH→LEARN→SEE; the densest object on the site must not be the loudest control on a beginner's front door). Separately, `/tools/range`, `/tools/pot-odds`, `/tools/outs` gain a link back to their lesson, matching the three tools that already have one. | Q3 (homepage) · Q2 (tool pages) |
| M2 unexplained notation wall on `/tools/range` | major | **ACCEPT — add the syntax key.** `RangeSummary`'s own doc says opting in is "a claim that the surrounding page has earned it"; earn it rather than retreat to `showNotation={false}`. | Q2 |
| M3 bare `Hero`/`Villain` in 3 blog posts | major | **ACCEPT — fix.** ADR-0053 exempts notation; these are narrative role words, and sibling articles already say 한 사람/다른 사람. | Q1 |
| M4 `/glossary` sorted by the English term | major | **ACCEPT — sort by the Korean title.** | Q3 |
| M5 오프수트/오프슈트, 베팅/배팅, 플랍/플롭, 수트드 | major | **ACCEPT — canonicalise** to 오프수트 · 베팅 · 플랍 · 수트드→수티드 per majority usage. Search **aliases** keep the variants deliberately (배팅 is a real thing people type); only user-visible prose and control labels change. | Q1 (content+registry) · Q2 (tool labels) |
| M6 9 "go read X first" references that are not links | major | **ACCEPT — fix.** Also fix `hands/a5s.mdx:8`'s false assumption that the reader has already read another page. | Q1 |
| M7 dangling "그래서" + unbacked strategy inside a caveat | major | **ACCEPT — fix per D5.** | Q2 |
| M8 `/tools/equity`, `/tools/hand-checker` — result unreachable while changing input on mobile | major | **ACCEPT — fix.** Requirement: at 375 px the result stays visible while a card is picked. | Q3 |
| M9 bet-counting ladder taught from zero in 4 places | major | **ACCEPT, bounded.** Lesson 12 owns it (plan §1.4, ADR-0081); the blog and both glossary entries keep one sentence and link. Glossary entries must still clear their length floor — if trimming would break it, report rather than pad. | Q1 |
| M10 `/tools/pot-odds` ignores its own deep-link params | major | **ACCEPT — make it read them**, matching `RangeExplorer`. Parse through the existing money guard; a malformed param falls back to the default, never throws. | Q2 |
| M11 `/about` reachable from no page | major | **ACCEPT — link from the footer.** | Q3 |
| M12 header search `disabled`; `/blog`, `/hands`, `/search`, `/about` in no global nav | major | **ACCEPT — enable the header search** (`routes.ts` already says `available: true` and the page works), and surface `/blog`, `/hands`, `/about` in the footer. | Q3 |
| M13 `/hands/*` renders the article before the computed sections | major | **ACCEPT — reorder to plan §4.2.** | Q3 |
| M14 `blog/pot-odds-quick.mdx:7` ungrammatical `<Term>` insertion | major | **ACCEPT — fix.** | Q1 |
| m1 "학습용 기본 레인지**이란**" | minor | **ACCEPT — fix** (레인지**란**). | Q2 |
| m2 refusal boilerplate is copy-pasted across 13 files | minor | **REJECT.** See §5. | — |
| m3 glossary flop/turn/river/draw padded with advice-adjacent generalisation | minor | **ACCEPT — fix.** Same class as B1; upgraded in practice. | Q1 |
| m4 브로드웨이 / "9-high 스트레이트" used bare | minor | **ACCEPT — gloss inline**, as `hands/t9s.mdx` already does. | Q1 |
| m5 `vpip` ↔ `pfr` mutually duplicative | minor | **ACCEPT, bounded** — drop the duplicated "계산하지 않습니다" section from one page and one of `pfr`'s two VPIP-relationship sections. | Q1 |
| m6 `why-called-3bet` FAQ answered with the style guide | minor | **ACCEPT — reword** to answer the poker question, keeping the honest "이 사이트에 근거가 없다" as the reason rather than the whole answer. | Q1 |
| m7 `쓰리페어 아님` filler alias | minor | **ACCEPT — remove.** | Q1 |
| m8 10 glossary pages with zero inbound links | minor | **ACCEPT — one inbound `<Term>` each**, from a page where the word genuinely occurs. No link farming. | Q1 |
| m9 `/practice/range-quiz` — six 준비 중 options before the start button, no lesson link | minor | **ACCEPT — fix.** | Q2 |
| m10 것샷 → 거트샷 | minor | **ACCEPT — fix.** | Q2 |
| ruling 85 — card suits announce in English (`A♠` → "A black spade suit") | carried | **ACCEPT — fix.** `SUIT_KOREAN` already exists. The e2e locator churn (~20) is mechanical; a Korean product speaking English to assistive tech on its most fundamental object is not. | Q3 |

**25 of 26 accepted, 1 rejected.**

## 4. The structural finding, which outranks any individual fix

P1 and P2 converged, independently, on the same thing: **`src/**` Korean prose was never
audited.** P1 ran its filters over `src/**` as an addition to its brief and got six of its
thirteen findings there — including the strategy claim (F2), the kicker rule (F6), the shortcut's
error direction (F5) and the data's provenance (F7). P2 found the notation wall, the dangling
connector and the disabled search button in the same half of the tree.

Every sweep this project has run — the §47 audit, the ruling-26 sweep, both content filter
passes — pointed at `content/**`. Roughly half the user-visible sentences on this site live in
`app/**/page.tsx` explanation cards, `features/*/copy.ts` and `components/*.tsx`, and that half
is where the site's most confident claims turned out to sit. The site-wide advice guard MASTER
added to `src/content/content.test.ts` inherits the same blind spot: it reads MDX only.

**Consequence:** Q2's brief is the largest of the three, and after the fix round the advice
guard is extended to Korean string literals under `src/**`.

Second structural note, from P1: the specified Filter C matched percentages and decimals only,
so F1's "10위" — a bare integer — was invisible to it. Any future sweep uses the widened form
(integer + Korean counter), which is what surfaced it.

## 5. The one rejection, with its reason

**m2 — "refusal boilerplate is the most-repeated content on the site."** The finding is
accurate: `뜻은 아닙니다` appears in 13 files, `범위 밖` in 7, and a reader who reads three
articles in a row is refused in the same words three times.

It is rejected for the fix round anyway. Rewording thirteen files' refusal language is the
highest-risk, lowest-value edit available in this round — and the risk is specific, not
theoretical: this is the same round in which two independent reviewers found advice *leaking
into* content in four separate places (B1, F2, M7, m3). The refusals are the mechanism that
keeps that from happening. Loosening thirteen of them for prose variety, at the end of the
cycle, trades the site's actual product for a style improvement.

The discipline is right and the reviewer says so. Sameness of phrasing is a cost, not a defect.
Recorded as a post-MVP follow-up.

## 6. Split, and why it is a file-ownership split rather than a topic split

§44 forbids handing one agent every unrelated fix. The obvious split — math / UX / SEO — was
**not** used, because the findings do not partition that way: F4 alone touches content MDX, the
content registry, `features/*/copy.ts` and a route template, and M1, M2, F2 and F7 all land on
the range surfaces. A topic split would have put three writers in `RangeExplorer.tsx`.

So the split is by **disjoint file ownership**, which CLAUDE.md §5 requires for concurrent
writers, with the topic assigned to whoever owns the file:

| agent | owns | findings |
| --- | --- | --- |
| **Q1 — content** | `apps/fishtilt/content/**`, `apps/fishtilt/src/content/registry/**` | F1, F3, F4 (content+registry), F8, F9, F13, M3, M5 (content), M6, M9, M14, m3, m4, m5, m6, m7, m8 |
| **Q2 — tools & data description** | `apps/fishtilt/src/features/**`, `src/app/tools/**`, `src/app/about/page.tsx`, `src/app/practice/**`, `src/components/Range*.tsx` | F2, F4 (features), F5, F6, F7, F10, F11, F12, M1 (tool half), M2, M5 (labels), M7, M10, m1, m9, m10 |
| **Q3 — navigation, IA, layout, a11y** | `src/app/page.tsx`, `src/app/glossary/page.tsx`, `src/app/hands/[hand]/page.tsx`, `src/components/Site*.tsx`, `src/components/{EquityCalculator,HandChecker,PokerCards,CardPicker}.tsx`, `src/lib/routes.ts` | F4 (`hands/[hand]`), M1 (homepage half), M4, M8, M11, M12, M13, ruling 85 |

No file appears in two columns. `hands/[hand]/page.tsx` carries an F4 wording fix **and** M13's
reorder; both go to Q3 rather than splitting the file. The tool pages carry F-findings **and**
M1's back-links; both go to Q2.

