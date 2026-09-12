# FishTilt — beginner-UX, content-quality and SEO review

Independent review, read-only. Reviewer built none of this.
Date: 2026-09-05 · App: `apps/fishtilt` · Reviewed against a dev server on :3220.

**Verdict in one line:** the *writing* is genuinely good — better than almost any Korean
poker content on the open web — and the *no-advice discipline* holds in the lessons, blog
and hand pages. It breaks in the glossary. The bigger problem is not honesty but
**entry**: a first-time visitor's designated front door is a 169-cell grid with no route
back into the curriculum.

---

## 1. Scope and method

| What | How |
| --- | --- |
| Every page class | Rendered from a running dev server (`:3220`) to text and read as a reader sees it: `/`, `/learn`, `/blog`, `/glossary`, `/hands`, `/tools` ×6, `/practice` ×2, `/search`, `/about`, plus sampled detail pages of each kind. |
| All prose | Read 113 MDX files in full: 15 lessons, 20 blog, 58 glossary, 20 hands. |
| Components | Read `RangeMatrix`, `RangeSummary`, `RangeExplorer`, `CardPicker`, `EquityCalculator`, `HandChecker`, `ToolCTA`, `Term`, `SiteHeader`, `SiteFooter`, `features/range/copy.ts`, `features/strength/copy.ts`, `features/tools/*`. |
| Duplication | Not by impression. Built a concept→page matrix by grepping the explanation signature of each concept in `docs/FISHTILT_CONTENT_PLAN.md` §1.4's ownership ledger across `content/**` and `src/**`, then read every hit. |
| Link/SEO mechanics | Full crawl from `/` (130 URLs, closure reached), sitemap/robots diff, canonical + title + description per page, inbound-link counts per leaf page, per-file prose length. |
| Not covered (owned elsewhere) | Poker/mathematical correctness; `aria`/pixel-level responsive mechanics; settled ADRs incl. ADR-0053. |

Numbers below are all from the running site, not from the plan document.

---

## 2. Findings, most severe first

**Totals: 1 blocker · 14 major · 10 minor.**

### Blocker

| # | Page | What a beginner experiences | Why it fails them | Sev |
| --- | --- | --- | --- | --- |
| B1 | `content/glossary/pot-odds.mdx:5` | Reads: *"이 최소 승률보다 내 에퀴티가 높다고 판단되면 **콜을**, 낮다고 판단되면 **폴드를** 고려해 볼 수 있는 기준이 됩니다."* | This is the site telling a reader what action to take. Every other surface on the same concept explicitly refuses to: `/tools/pot-odds` answers *"이 숫자만 보고 콜하면 되나요? **아닙니다.**"*, and `/learn/pot-odds` says *"이 사이트가 대신 판단해주지 않습니다."* The one page a beginner reaches when they look the term **up** is the one that gives the advice — and it contradicts the tool and the lesson it links to. Hard product-boundary breach. | **blocker** |

### Major

| # | Page | What a beginner experiences | Why it fails them | Sev |
| --- | --- | --- | --- | --- |
| M1 | `/` §1 + `/tools/range` | The homepage's **primary** button is `13×13 핸드레인지 보기`; `처음부터 배우기` is the secondary. Section 3 then drops the full 169-cell grid with `UTG HJ CO BTN SB BB` buttons. Following the primary CTA lands on `/tools/range`, which contains **zero** links to `/learn/*` or `/glossary/*` (verified: `learn links: NONE, glossary links: 0`). | Someone who does not know what a blind is is sent, by the loudest control on the page, into the site's densest object — and that object has no way back into the curriculum. Three of the six tools (`equity`, `hand-checker`, `starting-hand`) *do* link to their lesson; the flagship and the two most-searched calculators do not. | major |
| M2 | `/tools/range` (`RangeSummary`, `showNotation`) | Under the conditions line, a monospace wall: `33+,A2s+,K2s+,Q3s+,J4s+,T6s+,96s+,85s+,75s+,64s+,53s+,A4o+,K8o+,Q9o+,J9o+,T8o+,98o+`. No label, no key, nothing explains `+`. | `RangeSummary.tsx:29-37` itself calls this "unexplained jargon — a wall of monospace shorthand aimed at a reader who is, right now, being told what a range even is", defaults it OFF, and says opting in is "a claim that the surrounding page has earned it… backed by the 이 기준은 무엇인가요? disclosure". That disclosure explains the range's *provenance*, not the *syntax*. The claim is not met on the one page that opts in. | major |
| M3 | `blog/same-pair-who-wins.mdx`, `blog/playing-the-board.mdx`, `blog/what-is-kicker.mdx` | *"**Hero**는 이런 두 장을 들고 있습니다. **Villain**은…"* — bare English, no gloss, no `<Term>`, not among the 58 glossary entries. | ADR-0053 exempts poker *notation* (ranks, position abbreviations); `Hero`/`Villain` are narrative role words, not notation. The site's own sibling articles do it correctly — `flush-vs-straight` and `full-house-vs-flush` say *"한 사람은… 다른 사람은…"*. So it is both unexplained **and** inconsistent with pages a reader may have just come from. | major |
| M4 | `/glossary` (`src/app/glossary/page.tsx:22`) | 58 entries in one flat list, no filter, no A–Z jump. Visible order reads: 다시 거는 세 번째 레이즈 (3-Bet) → 그 다음 레이즈 (4-Bet) → 내 차례의 행동 (Action) → 가진 칩 전부 (All-in) → 모두가 내는 참가비 (Ante) → 처음 돈을 거는 것 (Bet)… | Sorted by `entry.term` — the **English** name — while every visible label is Korean-first. To a Korean reader the ordering is indistinguishable from random, so looking up 블라인드 means scanning all 58. The page's own promise ("모르는 말이 나오면 여기서 찾아보세요") is the thing it makes hardest. | major |
| M5 | Site-wide | The same word is spelled differently depending on which page you are on: **오프수트** (16 files: all lessons, blogs, hand pages, tool UI) vs **오프슈트** (5 files: `glossary/{offsuit,suited,combo,hand-matrix,pocket-pair}`). **베팅** (36 files) vs **배팅** (`glossary/{preflop,river,flop,turn,board}`, plus the lesson-10 and preflop registry descriptions rendered on `/learn` and `/glossary`). **플랍** (all content) vs **플롭** (the outs calculator's own button: `플롭 (카드 2장 남음)`; the equity calculator's `프리플롭(0장), 플롭(3장)`). Plus one-off **수트드** in `features/strength/copy.ts:66`. | A beginner is learning these words for the first time. The glossary — the page whose job is to fix the spelling in their head — is the page that disagrees with the lessons. And a reader who learns 플랍 in lesson 11 then follows its `ToolCTA` finds the control labelled 플롭. The site's own alias list (`registry/glossary/j1.ts:385`) treats 배팅 as a *misspelling variant* of 베팅, then ships it in 7 user-visible places. | major |
| M6 | 9 places, incl. the **opening paragraph** of 3 blog articles | `blog/why-use-range.mdx:1` — *"표를 읽는 법 자체가 처음이라면 **핸드레인지란?**을 먼저 보세요."* `blog/outs-nine.mdx:1` — *"아웃츠라는 말 자체가 처음이라면 **아웃츠 레슨**이 먼저입니다."* `blog/pot-odds-quick.mdx:1` — *"…**팟오즈 레슨**을 먼저 읽어 주세요."* None of these are links. Also `hands/a5s.mdx:8` (*"**AQo 페이지**에서는 … 확인했습니다"*), `blog/why-called-3bet.mdx:19`, `blog/same-pair-who-wins.mdx:30`, `blog/full-house-vs-flush.mdx:21`, `learn/flop-turn-river.mdx:35`, `glossary/hand.mdx:15`. | The site identifies the exact reader who is lost, tells them where to go, and gives them nothing to click — they must scroll past the whole article to the footer relations. `hands/a5s` is worse: it asserts the reader *has already read* the AQo page ("확인했습니다"), which is false for anyone arriving from a search engine. | major |
| M7 | `/tools/starting-hand` (`features/strength/copy.ts:66`) | Under the heading *이 순위가 "좋은 패" 순서는 아닌가요?* the entire answer is one paragraph that **begins with "그래서"** — a connector with nothing before it, because its antecedent (`STRATEGY_DISTINCTION_SENTENCE`) lives in a different card two columns away. Its content: *"실제로 잘 플레이하기 어려운 오프수트 에이스가, 사람들이 좋아하는 수트드 커넥터나 낮은 페어보다 위에 있는 경우가 있습니다. … 실전에서 이기기 쉬운 패라는 뜻은 아닙니다."* | Two failures at once. The dangling "그래서" reads as a truncated page. And the caveat itself asserts unbacked strategy — *offsuit aces are hard to play well*, *suited connectors are liked* — on a site with no postflop dataset. A caveat that smuggles in the claim it is meant to prevent. | major |
| M8 | `/tools/equity`, `/tools/hand-checker` | `EquityCalculator.tsx:206` and `HandChecker.tsx:141` are `grid grid-cols-1` at **every** width. The 결과 section sits below all pickers — three 52-card pickers on `/tools/equity`. At 375px (`min-w-11` + gap ≈ 6 cards/row) that is roughly 36 rows of card buttons above the answer. | The reader can never see the output while changing the input. On a phone they pick two cards, then scroll past ~100 more card buttons to find out what happened — and cannot scroll back to adjust without losing sight of the number. The two calculators whose whole value is "change a card, watch the number move" are the two where you cannot watch it move. | major |
| M9 | `learn/three-bet.mdx` (owner), `blog/why-called-3bet.mdx`, `glossary/three-bet.mdx`, `glossary/four-bet.mdx` | The BB→open→re-raise counting ladder is explained **from zero in four places**, each with its own worked 1-2-3 list. | §1.4 of the plan assigns `bet-counting` to lesson 12; everyone else was to link. The blog whose entire subject *is* the convention restates it rather than owning the differentiator, and both glossary entries restate it rather than linking. See §4. | major |
| M10 | `blog/pot-odds-quick.mdx` CTA | *"다른 팟과 벳 크기도 3초 안에 확인해보세요"* → `/tools/pot-odds?pot=9&bet=6`. The calculator does not read the query (`PotOddsCalculator.tsx:209-212` seed from `DEFAULT_POT_BB='10'`/`DEFAULT_BET_BB='5'`; verified: fetching that URL returns `value="10"`, `value="5"`). | The article walks through a 9BB/6BB example, promises the calculator, and the calculator opens on a *different* example. The range tool's `?hero=&spot=&stack=` deep links **do** work (`RangeExplorer` reads them), so four of the six `params` CTAs land correctly and two silently do not — the reader has no way to tell which. | major |
| M11 | `/about` | In `sitemap.xml`, returns 200, and **not reachable from any page** — the full crawl from `/` reached 130 URLs and never found it. | The only page stating "제휴하지 않습니다 / 숫자는 어디서 나오나요" — the site's trust case — is unreachable by a human. Neither header nor footer lists it (`PRIMARY_NAV_IDS` is 5 ids), and the homepage does not link it. | major |
| M12 | `SiteHeader.tsx`, `SiteFooter.tsx` | The header's magnifier is `disabled` with `aria-label="검색 (준비 중)"`, and the comment says *"`/search` is `available: false` in the registry"* — but `routes.ts` now says `available: true` and `/search` works. Header and footer both show only 5 destinations; `/blog`, `/hands`, `/search`, `/about` appear in neither. | A beginner who does not know a word clicks the search icon — the universal affordance for exactly this problem — and nothing happens, on every page. Search is reachable only from one card in homepage section 9. `/hands` (20 pages) is reachable from no global nav at all. | major |
| M13 | `/hands/*` (all 20) | Order rendered: cards → one-line answer → **the article's own prose** (comparisons, rank/equity figures, FAQ) → *then* 이 패는 어떤 패인가요 / 13×13 표에서는 여기입니다 / 얼마나 강한가요 / 어느 자리에서…. | The plan's §4.2 fixed order puts the computed "what is this hand / how strong" sections at 3-6, before the discussion. As shipped, a first-time visitor to `/hands/aks` reads a *comparative* paragraph ("AKo는 조합이 12가지로 … 순위도 12위로") before being told AKs's own combo count or rank. Several pages compound it by assuming sibling pages were read (`a5s` → AQo, 22). | major |
| M14 | `blog/pot-odds-quick.mdx:7` | *"팟이 6BB일 때, 상대가 **콜 값어치(Pot Odds)를 따질 필요도 없이** 흔한 크기인 하프팟(3BB)을 베팅하면…"* | Ungrammatical and meaningless — the `<Term>` was clearly wedged into the sentence to satisfy the one-Term-per-file rule, and it lands in the exact clause where the key concept is introduced. The reader meets the article's central term inside a sentence that does not parse. | major |

### Minor

| # | Page | Issue | Sev |
| --- | --- | --- | --- |
| m1 | `/tools/range` (`page.tsx:82`) | Heading renders **"학습용 기본 레인지이란 무엇인가요?"** — `${RANGE_LABEL}이란`. 레인지 ends in a vowel; must be 레인지**란**. A grammar error in an `<h2>` on the flagship page. | minor |
| m2 | Site-wide | Refusal boilerplate is the most-repeated content on the site: `뜻은 아닙니다` in 13 files, `범위 밖` in 7, plus `이 사이트가 대신 정해주지 않습니다` / `아직 답할 수 있는 범위 밖` / `정직한 답 중 하나입니다`. Most articles carry 2-3. The discipline is right; the *phrasing* is copy-pasted, so a reader who reads three articles in a row is refused in the same words three times. | minor |
| m3 | `glossary/{flop,turn,river,draw}.mdx` | Final section padded to the 400-자 floor with unbacked, advice-adjacent generalisation: *"그래서 플랍이 열리는 순간의 배팅을 특히 신중하게 다루는 경우가 많고"*, *"리버가 열리는 순간의 배팅이 한 판 전체에서 가장 무거운 결정이 되는 경우가 많고"*, *"그래서 드로우 상태에서는 완성될 가능성을 확률로 미리 가늠해 보는 것이 특히 중요합니다."* `turn.mdx` says "커지는 경우가 많습니다" twice in one paragraph. | minor |
| m4 | `hands/{kjs,qjs,jts}.mdx` | **브로드웨이** used bare, no gloss, not a glossary term. `hands/t9s.mdx` glosses it inline (`브로드웨이 카드(10·J·Q·K·A)`) — so one page in four teaches the word the other three assume. Also `9-high 스트레이트` / `King-high 스트레이트` (`playing-the-board`, `what-is-kicker`) unexplained. | minor |
| m5 | `glossary/vpip.mdx` ↔ `glossary/pfr.mdx` | Mutually duplicative: both carry a near-identical "FishTilt는 이 숫자를 계산하지 않습니다" section, and each explains the *other's* relationship (vpip §"PFR과 함께 볼 때", pfr §"VPIP와 나란히" **and** §"VPIP와의 차이가 알려주는 것"). `pfr` runs five sections for a statistic the site states it does not compute. | minor |
| m6 | `blog/why-called-3bet.mdx` | FAQ *"이 세는 방식 말고 다른 방식도 널리 쓰이나요?"* is answered with editorial policy: *"다른 세는 방식이 실제로 널리 쓰인다는 근거는 이 사이트에 없고, 없는 근거를 있는 것처럼 쓰지 않습니다."* The reader asked a poker question and got the style guide. | minor |
| m7 | `registry/glossary/j2.ts:376` | `two-pair` alias list contains **`쓰리페어 아님`** — not a search term any human types. Filler alias. | minor |
| m8 | 10 glossary pages | Zero inbound links from any non-index content page: `bluff, c-bet, hand, heads-up, high-card, nuts, pfr, straight-flush, three-of-a-kind, vpip`. Reachable only from the 58-item list in M4. | minor |
| m9 | `/practice/range-quiz` | Before 퀴즈 시작 the reader must look past six `준비 중` options (2 spots, 4 stack depths). No link to lesson 06 anywhere on the page, and `학습용 기본 레인지` is used with no definition. | minor |
| m10 | `features/tools/draws.ts` | `것샷 스트레이트 드로우 (Gutshot)` — standard Korean rendering is 거트샷. Low confidence, flagging only for consistency review. | minor |

---

## 3. The nine persona questions

| # | Question | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Does the homepage make it obvious what the site is for? | **Partial** | Hero *"홀덤, 외우지 말고 눈으로 이해하세요 / 직접 눌러보며 배우는 무료 텍사스 홀덤 도구"* is clear, and section 2's four intents are well chosen. But the **primary** CTA is `13×13 핸드레인지 보기` and the sub-line already says "레인지" — jargon in the first two sentences, with `처음부터 배우기` demoted to secondary (M1). |
| 2 | Can a beginner read the 13×13 matrix? | **Pass on `/tools/range` and in lessons; fail on `/`** | `/tools/range` has an explicit *"표는 어떻게 읽나요?"* card (대각선=페어 / 위=수티드 / 아래=오프수트 + 169 vs 1,326), lesson 05 owns it properly, and every embed carries `6인 · 100BB · 아무도 참여하지 않았을 때` plus a 3-item colour legend and a *measured* horizontal-scroll cue. On the **homepage** the same grid appears in section 3 with only the colour legend and no structural explanation and no link to lesson 05 — and that is where a first-time visitor meets it. |
| 3 | Can they find out what `AKs` means at the moment they first meet it? | **Pass** | Strongest part of the site. `<Term>` renders an inline popover with a definition and a `자세히 보기 →` link, so `수티드`/`오프수트`/`콤보` are answerable in place. `/hands/aks` carries a dedicated *"s/o 표기, 처음 본다면"* section. Lesson 03 teaches the notation from zero. Every matrix cell's accessible name is `AKs 에이스 킹 수티드`. Caveat: the *spelling* they learn depends on the page (M5). |
| 4 | Do `BTN`/`UTG`/`CO`/`HJ`/`SB`/`BB` ever appear unexplained on the page you land on? | **Pass for positions; fail for `BB` the unit** | `PositionLegend` renders `UTG 언더더건 · HJ 하이잭 · CO 컷오프 · BTN 버튼 · SB 스몰 블라인드 · BB 빅 블라인드` under every position control — homepage, `/tools/range`, `/practice/range-quiz`, every `RangeMatrixMini`. Lessons gloss on first use. **But** `/tools/pot-odds` labels both money inputs `BB` with no gloss and no glossary link anywhere on the page, and `/tools/range`'s stack filter shows `40BB / 60BB / 100BB / 150BB+` likewise. A reader arriving at the pot-odds calculator from a search does not learn what unit they are typing in. |
| 5 | Are calculator inputs and outputs clear? | **Pass (best work on the site)** | `/tools/pot-odds` labels the trap directly: *"지금 팟에 있는 돈 — 상대의 이번 베팅은 빼고, 그 전까지 쌓인 금액입니다"*, gives 1/3·1/2·2/3·팟 shortcut buttons, shows the arithmetic line by line (`10 + 5 + 5 = 20 BB`, `5 ÷ 20 = 25.0%`), restates the output three ways (필요 승률 / 몇 번에 한 번 / 오즈 표기), and closes with *"이 숫자만 보고 콜하면 되나요? 아닙니다."* `/tools/outs` ships seven named preset draws each with its own count derivation, and shows the ×2/×4 rule error signed and in %p. `/tools/starting-hand` explains that 상위 X% is combo-weighted, not name-weighted. Deductions are M7 (dangling caveat), M8 (output placement) and the unglossed `BB`. |
| 6 | Do internal links feel natural or bolted on? | **Mixed** | In-prose `ToolCTA`s are contextual and well-titled, and `<Term>` popovers are excellent. Footer relations (`이 글에 나온 말들` / `이제 이것도 이해해보세요` / `이 핸드도 같이 보세요`) are consistent and correctly labelled. Bolted-on: the 9 unlinked "go read X first" references (M6) are the opposite problem — a link the writer clearly intended that never became one; and the tool→lesson direction is only wired on 3 of 6 tools (M1). |
| 7 | Is the same explanation repeated across pages? | **Partly held — see §4** | The ledger held for the *big* concepts (range, position, streets, actions, equity). It broke on four: 3-bet counting (4 places), the strength-methodology caveat (4 places, one verbatim sentence), the pocket-pair head-start (3 places), and the 족보-frequency article pair (a near-verbatim shared paragraph). |
| 8 | Do the blog articles read like genuine answers or SEO filler? | **Pass — genuine, 20/20** | Zero instances of the banned openers (`알아보겠습니다`, `살펴보겠습니다`, `안녕하세요`, `오늘은`, `결론적으로`). Every article opens with the answer in sentence one. Each has a distinct FAQ block addressing real misconceptions — `how-often-aa` takes on "온라인은 카드를 덜 섞는다" and "6명이 앉아 있으면 누군가는 자주 AA일 것"; `next-best-after-aa` takes on "KK인데 상대가 AA면 어쩌지". No article recycles another's intro. See §5. |
| 9 | Is the site usable on mobile? | **Mostly — one real failure** | See §8. Matrix scrolls with a measured cue rather than shrinking; Compare mode has a dedicated `mobileCompareView` tab switcher; nav collapses to a conditionally-*rendered* panel; touch targets are 44px throughout. The failure is M8: the equity calculator and hand checker put the answer below every picker at all widths. |

---

## 4. Duplication analysis

Method: concept → every page containing a substantive explanation (not a `<Term>` or a one-line pointer).

| Concept | Owner (§1.4) | Also explained in | Verdict |
| --- | --- | --- | --- |
| **3-bet bet-counting** | L12 `three-bet` | `blog/why-called-3bet` (own 1-2-3 callout), `glossary/three-bet` (own §"왜 세 번째라고 부르나요"), `glossary/four-bet` (restates the whole ladder) | **Redundancy — the clearest breach.** Four independent from-zero explanations. Aggravated by three different epistemic framings of the same convention: L12 *"이것이 이 세는 방식입니다"* (no hedge), blog *"가장 널리 쓰이는 세는 방식"*, glossary *"표준적인 세는 방식"*. ADR-0081's stated consequence is "the three pages state one convention **and agree with each other**" — they agree on substance, not on how certain it is. |
| **Strength methodology caveat** | L04 `starting-hand-ranking` | `blog/is-ak-good:20`, `blog/next-best-after-aa:24`, `features/strength/copy.ts:54` (`/tools/starting-hand`) | **Borderline → acceptable.** The sentence *"이 순위는 포지션별 전략이 아니라 시작 패 자체의 기본 강도를 비교한 것입니다"* is **verbatim identical** in all four. It is a safety caveat on pages a reader can land on cold, so repetition is defensible — but it should be one shared string, not four copies that can drift (and `copy.ts:66` has already drifted into 수트드/잘 플레이하기 어려운, M7). |
| **Pocket-pair head start** | L04 | `blog/small-pocket-pairs:15`, `blog/next-best-after-aa:19` | **Redundancy.** Paraphrases of one idea ("이미 페어를 만들어 놓고 승부를 시작"). Both blogs should have used the one-sentence-plus-link form the ledger prescribes. |
| **플러시/스트레이트 frequency ordering** | B9 `flush-vs-straight` | `blog/full-house-vs-flush` | **Redundancy in form, correct in substance.** B10 *does* defer the reason ("그 이야기는 다른 글에서 자세히 다룹니다"), but the two articles share a **near-verbatim paragraph** — *"두 사람 모두 다섯 장을 온전히 채워 확실한 조합을 만들었습니다. 겉보기에는 둘 다 {대등해/강해} 보이지만, 포커는 아홉 가지 조합에 미리 고정된 순서를 매겨 두고 그 순서로만 승부를 가릅니다."* — and an identical `ToolCTA` body. Two pages competing for the same 족보-순서 intent with the same words. |
| **13×13 diagonal structure** | L05 `hand-matrix` | `glossary/hand-matrix` (full re-explanation), `glossary/{suited,offsuit,pocket-pair}` (one line each), `/tools/range` card, `/hands/*` template (one line + link) | **Legitimate reinforcement, one exception.** The one-liners and the tool card are correct: a landed reader needs them. `glossary/hand-matrix` re-teaches the whole thing including "왜 169개일까요" — that is L05's job. |
| **suited → flush possibility** | L03 `starting-hands` | `glossary/suited`, `glossary/offsuit`, `blog/why-suited-matters`, `blog/aks-vs-ako` | **Legitimate.** Each states it in one sentence for its own frame; `why-suited-matters` owns the "얼마나 큰 차이인가" angle with different hands (J9s/T8s, correctly avoiding lesson 06's K9s). |
| **BB has no first-in range** | L08 `positions-6max` | `features/range/copy.ts` (`BB_HAS_NO_RFI_RANGE`) rendered anywhere BB is selected | **Legitimate and good.** One shared string, surfaced as a teaching moment rather than an error, wherever the reader triggers it. |
| **Position → information asymmetry** | L07 `position` | `glossary/position`, `glossary/button`, `blog/btn-why-wide` | **Redundancy + a contradiction.** `glossary/position` heads a section **"왜 늦은 자리가 유리한가요"** and `glossary/button` asserts *"오픈 레이즈에 쓸 수 있는 패가 자리 중 가장 넓은 것도 이 때문입니다"* — a causal claim. L07 explicitly refuses it (*"이 글에서 확인한 것은 '정보의 양이 다르다'는 사실뿐"*), and `blog/btn-why-wide` refuses it twice, by name (*"그 정보 차이가 실제로 어떻게 유리하게 쓰이는지 … 이 글의 범위 밖입니다"*). Two glossary entries assert what two other pages spend paragraphs declining to assert. |

**Verdict.** The ownership table mostly held. Where it broke, it broke in one direction: **the glossary re-teaches what the lessons own, and in re-teaching it drops the epistemic care the lessons maintain.** The two blog pairs the plan singled out (§2.3: L14↔B19, L15↔B20, L06↔B18) held cleanly — all three use their hand-off sentence and stay in their lane.

---

## 5. Blog quality, article by article

Scale: **Answers** = a real question genuinely answered · **Thin** = correct but under-delivers · **Filler** = padded.

| # | Article | Verdict | Note |
| --- | --- | --- | --- |
| 1 | `next-best-after-aa` | Answers | Answer in sentence 1; adds the *"등수가 붙어 있어도 승률 차이는 붙어 있지 않다"* nuance and the real "KK vs AA 걱정" question. |
| 2 | `how-often-aa` | Answers (best of the 20) | Takes on three genuine reader beliefs — 온라인 셔플 의심, 6명이면 누군가는 자주, 평균의 의미 — none of which is padding. |
| 3 | `is-ak-good` | Answers | Refuses the framing honestly and explains *why* it will not call AK "프리미엄 핸드". |
| 4 | `aks-vs-ako` | Answers | Delivers the non-obvious result: different equity, **same** first-raise positions. |
| 5 | `qq-vs-ak` | Answers | Correctly splits AKs from AKo instead of averaging, and says why. |
| 6 | `small-pocket-pairs` | Answers | 순위 앞쪽 vs 실제로 자주 오는지 — a distinction beginners genuinely conflate. |
| 7 | `why-72o-is-weak` | Answers | Delivers a counter-intuitive fact (72o is not last) rather than confirming the meme. |
| 8 | `why-suited-matters` | Answers | Honest about magnitude (*"숫자로 보면 크지 않습니다"*). Correctly avoids lesson 06's K9s example. |
| 9 | `flush-vs-straight` | Answers | Frequency reasoning is the real "왜". Shares a paragraph with #10 (§4). |
| 10 | `full-house-vs-flush` | **Thin** | Defers the reason and reuses #9's paragraph almost word for word; its unique content is one frequency comparison and a same-full-house tiebreak callout. Closest thing on the site to a page that exists to hold a keyword. |
| 11 | `same-pair-who-wins` | Answers | Two-kicker walkthrough. Damaged by `Hero`/`Villain` (M3). |
| 12 | `what-is-kicker` | Answers | The "키커가 끼어들 자리가 없는 경우" half is the genuinely useful part, and it is not in #11. Clean split. Damaged by M3. |
| 13 | `playing-the-board` | Answers | Split and non-split boards side by side. Damaged by M3. |
| 14 | `a2345-wheel` | Answers | Answers both halves (A2345 yes, QKA23 no) and names the wheel as the weakest straight. |
| 15 | `btn-why-wide` | Answers | Unusually disciplined — states the fact, shows the combo counts, and explicitly fences off "이 표가 말하지 않는 것". |
| 16 | `why-blinds-exist` | Answers | Stays in rules territory as required; the "왜 강제로" reasoning is the real answer. |
| 17 | `why-called-3bet` | **Thin** | Its whole subject is the counting ladder, which L12 already opens with. Its differentiator is a "여기서 다루지 않는 것" section, i.e. it defines itself by what it removed. FAQ leaks editorial policy (m6). |
| 18 | `why-use-range` | Answers | Answers the one question ("why not just guess one hand") with UTG-vs-BTN combo counts. Note *"넓은 레인지는 '강한 레인지'가 아니라 '많은 패를 쓰는 레인지'"* — a real misconception, well killed. |
| 19 | `pot-odds-quick` | Answers, damaged | The three-bet-size table plus the ratio-invariance point is genuinely the "quick" version. Undercut by the garbled Term sentence (M14) and the broken deep link (M10). |
| 20 | `outs-nine` | Answers | Follows one number end to end exactly as scoped; pairs it with pot odds without telling the reader to call. |

**18 answer, 2 thin, 0 filler.** No shared intros, no banned constructions, no article opens with a definition it does not own. This is not SEO filler.

---

## 6. SEO findings by category

| Category | Result |
| --- | --- |
| **Dead links** | **Clean.** Crawl from `/` reached closure at 130 URLs; all 130 returned 200. No `available:false` route is linked as an `<a>` — `ToolCTA`/`RelatedContent` degrade to `준비 중` text as designed. |
| **Canonical** | **Clean.** Every page has a `<link rel="canonical">` whose path matches its own URL. Origin is the RFC-2606 placeholder `https://fishtilt.example` because `NEXT_PUBLIC_SITE_URL` is unset — correct dev behaviour, **but confirm the production env var is set before launch**, or 130 canonicals will point at a non-existent domain. |
| **Index explosion** | **Clean.** 130 sitemap URLs = 15 learn + 20 blog + 58 glossary + 20 hands + 6 tools + 3 practice + 8 hubs. No parameterised, faceted or paginated duplicates. `/search` is correctly `noindex` and correctly absent from the sitemap. |
| **Duplicate titles / descriptions** | **Clean.** 0 duplicate `<title>`, 0 duplicate meta descriptions across 130 pages; none missing. |
| **Duplicate intent** | Three pairs (details in §4): `blog/why-called-3bet` ↔ `learn/three-bet` (both target "3벳 뜻"); `blog/full-house-vs-flush` ↔ `blog/flush-vs-straight` (near-verbatim paragraph, same 족보-순서 intent); `glossary/hand-matrix` ↔ `learn/hand-matrix`. |
| **Thin pages** | No page is thin by length in a way that matters (glossary min 573자 against a 400자 floor; blog min ~1,350자; hands min ~1,200자). The real thinness is **padding**: m3 (four street entries) and m5 (`pfr`'s five sections for an uncomputed statistic) reach their floor with filler rather than substance. `blog/full-house-vs-flush` is thin on *originality*, not length. |
| **Orphans** | **`/about`** — in the sitemap, 200, zero inbound links from anywhere (M11). Plus **10 glossary pages** with zero inbound links from any content page (m8), reachable only via the unsorted 58-item index. |
| **Notes on the settled calls** | `/search` `noindex` — agree, no reservation. Not building curated `/ranges/*` — agree; generating 6 landing pages with no per-range explanatory content would be exactly the thin-page mass generation the rest of the site avoids. No dates on content — agree, and the homepage correctly declines to claim recency (`page.tsx` comments this explicitly and ships "배우기와 읽을거리 더 보기" instead of "최신"). |

---

## 7. Strategy-claim audit

Every sentence found that approaches advice, with a verdict. Method: read all 113 MDX files plus all user-visible strings in `src/`, then targeted sweeps for 콜을/폴드를, 유리, 이득, 수익, 해야 합니다, 하는 것이 좋, 중요합니다, 추천/권장.

| Page | Sentence | Verdict |
| --- | --- | --- |
| `glossary/pot-odds.mdx:5` | "이 최소 승률보다 내 에퀴티가 높다고 판단되면 콜을, 낮다고 판단되면 폴드를 고려해 볼 수 있는 기준이 됩니다." | **CROSSES.** Names both actions. Hedged ("고려해 볼 수 있는"), but every sibling surface refuses even this. **Blocker (B1).** |
| `glossary/position.mdx:3` | Section heading: "왜 늦은 자리가 **유리**한가요" | **CROSSES.** Asserts positional advantage as fact. L07 and `blog/btn-why-wide` both explicitly decline to. |
| `glossary/button.mdx` | "아무도 들어오지 않은 판에서 오픈 레이즈에 쓸 수 있는 패가 자리 중 가장 넓은 것도 **이 때문입니다**." | **CROSSES.** Causal claim (acts last → widest range) that `blog/btn-why-wide` spends a whole callout refusing to make. |
| `features/strength/copy.ts:66` (`/tools/starting-hand`) | "실제로 잘 플레이하기 어려운 오프수트 에이스가, 사람들이 좋아하는 수트드 커넥터나 낮은 페어보다 위에… 실전에서 이기기 쉬운 패라는 뜻은 아닙니다." | **CROSSES (as a caveat).** Asserts playability rankings the site has no data for, inside the sentence meant to prevent exactly that. **M7.** |
| `learn/starting-hand-ranking.mdx:17` | Same claim, softened: "실제로 **다루기** 어려운 오프수트 에이스가… 실전에서 **다루기 쉬운** 패라는 뜻은 아닙니다." | **Borderline — acceptable.** 다루기 (handle) rather than 플레이하기/이기기 keeps it about the reader's difficulty, not about profitability. Worth aligning `copy.ts` to this wording. |
| `glossary/{flop,turn,river}.mdx` | "플랍이 열리는 순간의 배팅을 특히 신중하게 다루는 경우가 많고" / "리버가 열리는 순간의 배팅이 한 판 전체에서 가장 무거운 결정이 되는 경우가 많고" / "턴부터는 배팅 크기도 함께 커지는 경우가 많습니다" | **Borderline — flag.** Reported as observed norms ("경우가 많습니다"), not instructions, but unbacked and advice-adjacent, and they exist to fill the char floor. **m3.** |
| `glossary/draw.mdx:15` | "그래서 드로우 상태에서는 완성될 가능성을 확률로 미리 가늠해 보는 것이 특히 **중요합니다**." | **Borderline — flag.** Tells the reader what matters. Nearest thing to an instruction outside B1. |
| `glossary/range.mdx:1` | "'이 패다'라고 하나만 찍는 대신 '이 정도 묶음 중 하나겠구나'라고 생각하는 쪽이 실제로는 훨씬 더 잘 맞습니다." | **Borderline — acceptable.** A claim about accuracy of a mental model, not about action or profit. |
| `glossary/pfr.mdx` | "VPIP는 높은데 PFR은 낮다면, 그 판에 참여는 자주 하되 레이즈보다 콜로 들어가는 경우가 많다는 뜻입니다." | **Borderline — acceptable.** Teaches how to read a statistic, states no "good" value, and the entry says twice that FishTilt does not compute it. Plan §3.5 satisfied. |
| `/tools/outs` FAQ | "한 번의 콜을 계산할 때는 '다음 카드 한 장' 확률이 더 **안전한** 기준입니다." | **Acceptable.** A statement about which *arithmetic* is valid given a possible turn bet, not about whether to call. |
| `learn/pot-odds.mdx` | "이 승률이 필요 승률보다 높으므로, 이 조건에서 이 콜은 **산술적으로** 손해가 아닙니다." | **Acceptable.** Explicitly scoped to arithmetic, and immediately followed by a callout saying the site does not decide. |
| `/` §2 intent card | Title: "어떤 패를 해야 하나요?" → links `/tools/range` | **Borderline — flag.** Not a claim, but it frames the flagship as the answer to a question the site states everywhere else that it does not answer. |
| `/tools/range` hero | "상황에 따라 어떤 시작 패를 **사용하는지** 색으로 확인해보세요." | **Acceptable.** Descriptive of the dataset ("what is used"), not prescriptive. |
| Whole site | The string **"GTO"** | **Clean — zero occurrences** in any user-visible string. `학습용 기본 레인지` is used consistently, always with `6인 · 100BB · 아무도 참여하지 않았을 때`. |
| Whole site | 수익 / 이득 / 플러스 EV / 항상 레이즈 | **Clean.** Every occurrence of 수익성 is inside a **negation** ("…수익성이 있다는 뜻은 아닙니다"). No affiliate, deposit, bonus or signup surface anywhere. |

---

## 8. Mobile usability as a reader

| Surface | Reading | 
| --- | --- |
| **13×13 matrix** | **Works.** 44px cells × 13 = 608px, wider than a phone by design; the wrapper scrolls horizontally so the page body never does, and a `ResizeObserver` shows *"↔ 표를 옆으로 밀면 나머지 칸도 볼 수 있어요"* only when it genuinely overflows. This is the right trade — legible cells over a shrunken unreadable grid — and the cue prevents the "chopped table = broken" read. |
| **Compare mode** | **Works.** Does not attempt two 608px grids side by side on a phone: `RangeExplorer` carries a `mobileCompareView: 'hero' \| 'compare' \| 'diff'` switcher. |
| **Navigation** | **Works, but thin.** Hamburger panel is conditionally *rendered*, not CSS-hidden. Only 5 destinations; `/blog`, `/hands`, `/search`, `/about` are unreachable from it (M12), which hurts more on mobile where the homepage's section-9 cards are a long scroll away. |
| **Equity calculator / hand checker** | **Fails (M8).** `grid grid-cols-1` at every width. Three 52-card pickers stack above 결과; at 375px that is ~36 rows of buttons between the last card tapped and the answer. The reader cannot see the percentage change as they pick, which is the entire point of the tool. |
| **Pot-odds / outs calculators** | **Work well.** Small input sets, so 계산 결과 and 계산 과정 sit close to the controls; the outs preset chips (`플러시 드로우 9장` etc.) are especially good on touch. |
| **Prose** | **Works.** `PokerCards` and `Callout` are flex-wrapped; `PositionLegend` uses `whitespace-nowrap` per entry specifically so Korean does not break mid-abbreviation. `MiniQuiz` options are full-width tappable. |
| **Touch targets** | 44px minimum throughout (`h-11`/`min-h-11`/`min-w-11`) — matrix cells, card buttons, filter chips, nav. |

---

## 9. What I established as good, and how

Stated so the clean results are auditable, not just asserted.

| Area | Finding | How established |
| --- | --- | --- |
| **Link integrity** | No dead internal links anywhere. | Full crawl from `/`, same-origin, to closure: 130 URLs, all 200. |
| **Canonical / titles / descriptions** | No mismatched or missing canonical; no duplicate title or description across 130 pages. | Parsed `<link rel=canonical>`, `<title>`, `meta[name=description]` on every crawled page and diffed. |
| **Index hygiene** | No index explosion; `/search` correctly `noindex` and correctly excluded from the sitemap; no orphaned indexable content except `/about`. | Sitemap ↔ crawl set difference, both directions. |
| **"GTO" never appears** | Zero user-visible occurrences. | `grep -r` across `content/**` and `src/**`. |
| **Profitability language** | Every occurrence of 수익성 is inside a negation. No 항상/무조건 레이즈, no EV claim, no affiliate or deposit surface. | Targeted sweeps for 수익, 이득, 유리, 해야 합니다, 하는 것이 좋, 추천/권장, then read every hit in context (§7). |
| **Range conditions labelling** | `학습용 기본 레인지` + `6인 · 100BB · 아무도 참여하지 않았을 때 (First In)` appear together on every surface that shows a range — homepage, `/tools/range`, `/practice/range-quiz`, every lesson embed, every hand page. | Built once in `describeRangeConditions`; verified in the rendered HTML of each surface. |
| **Numbers are computed, not typed** | No poker statistic is hand-typed in prose. | Every number in MDX goes through `<Fact name=... />`; spot-checked rendered output (`CATEGORY_RANK` → 9등/8등/7등, `HAND_ONE_IN_N` → 332, `RFI_COMBOS` → 226/568). |
| **Honest empty states** | Unshipped spots/stacks render `준비 중`, and BB's missing first-in range renders a *teaching* explanation, not an error. | Read `UNSUPPORTED_REASON_LABEL`; confirmed in `/tools/range` and `/practice/range-quiz` renders. |
| **Blog originality** | 20/20 open with the answer; no banned construction; no shared intro. | Read all 20 in full; grepped every banned phrase from the plan's §6.2 — zero hits. |
| **Jargon glossing on first use** | `<Term>` popovers carry a definition **and** a `자세히 보기 →` link inline, so the reader never leaves the page to decode a word. | Read the rendered HTML of `/blog/why-use-range` and `/hands/aks`. |
| **Quiz honesty** | Range-quiz explanations state membership only, never a recommended action. | Read `features/quiz/rangeQuestions.ts` `explanationFor`. |
| **Lessons 01-15** | All fifteen are genuinely beginner-safe: each closes with a "사람들이 자주 헷갈리는 부분" that answers the advice-shaped question by declining it (e.g. L04 *"순위가 낮은 패는 절대 쓰면 안 되나요?" → "이 레슨은 그런 판단까지 내리지 않습니다"*). | Read all 15 in full. |

---

## 10. The three highest-value changes

1. **Fix the beginner's front door.** Swap the homepage's primary CTA to `처음부터 배우기` (keep the matrix CTA as secondary), add a one-line "이 표가 처음이라면 → 13×13 표는 어떻게 읽나요?" link into homepage section 3, and give `/tools/range`, `/tools/pot-odds` and `/tools/outs` the same lesson-link block the other three tools already have. Also either enable the header search button or add `/search`, `/blog`, `/hands`, `/about` to the footer. *Addresses M1, M11, M12 — the single largest gap between what this site is and what a first-time visitor can get out of it.*

2. **Bring the glossary up to the standard the rest of the site already meets.** Remove the call/fold sentence in `pot-odds`, re-title `position`'s section from 유리한가요 to an information-asymmetry framing, drop `button`'s causal clause, delete the padded final paragraphs in `flop`/`turn`/`river`/`draw`, and normalise 오프슈트→오프수트 and 배팅→베팅 across the 5+5 affected files (plus 플롭→플랍 in the two calculators' UI strings). Then sort `/glossary` by the Korean title it actually displays and add a filter box. *Addresses B1, M4, M5, m3 — the glossary is currently the weakest surface and it is the one a confused reader is sent to.*

3. **Make the site's own cross-references clickable, and its examples honest.** Turn the 9 unlinked "먼저 보세요 / 레슨이 먼저입니다 / AQo 페이지에서는" references into real links (M6), replace `Hero`/`Villain` with the 한 사람/다른 사람 phrasing the sibling articles already use (M3), and either teach `?pot=&bet=` to `PotOddsCalculator` or change `pot-odds-quick`'s CTA to match the calculator's defaults (M10). *Cheap, entirely local, and each one currently strands a reader at the exact moment the writing correctly identified that they were lost.*
