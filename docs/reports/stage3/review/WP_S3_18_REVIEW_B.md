# WP-S3-18 — INDEPENDENT REVIEW B — PRODUCT / UX / VISUAL

Reviewer B (fresh context, no code changed). Question: **is this a premium, coherent product a Korean
beginner would keep reading?**

**Verdict: yes, with reservations.** This does not read like a template site. The editorial system is
real — one typographic voice, `keep-all` Korean line-breaking, a numbered section rhythm on the home
page, dictionary-style glossary instead of a card wall, honest provenance lines under every number,
and full light/dark parity on every surface I sampled. The weaknesses are concentrated in three
places: **stock-identical illustration**, **how much of the product is visibly labelled "준비 중"**, and
**the undifferentiated link tail at the bottom of every article**. None of them is a ship-stopper.

## Counts

| Severity | Count |
| --- | --- |
| BLOCKER | 0 |
| MAJOR | 5 |
| MINOR | 11 |
| NOTE | 7 |

## Method / evidence base

Screenshots read as images (not just listed): `artifacts/3bettilt-stage3-visual-qa/wp17/{after,after5,crops,evidence}`.
Surfaces walked at 1440×900 dark **and** light, 390×844 dark and light, and 320×700: `/ko`, `/ko/learn`,
`/ko/learn/positions-6max`, `/ko/blog`, `/ko/blog/aks-vs-ako`, `/ko/blog/qq-vs-72o-flop-227`,
`/ko/glossary`, `/ko/glossary/pot-odds`, `/ko/glossary/three-bet`, `/ko/hands`, `/ko/hands/aks`,
`/ko/tools`, `/ko/tools/equity`, `/ko/tools/range`, `/ko/practice/hand-ranking-quiz`,
`/ko/practice/range-quiz` (incl. the answered state from `wp15/range-quiz-answered-*`), `/ko/search?q=3벳`,
`/ko/about`, 404, and the mobile nav panel (`wp15/header-menu-open-390x844-*`). Structure read from the
built HTML in `apps/fishtilt/.next/server/app/**`. No build, no e2e run.

---

## BLOCKER

None. Nothing I found would mislead a reader about what the site is, break a core flow, or make a
primary surface unusable.

---

## MAJOR

### B-M1 | visual | Four of the six hand stories ship the *same* picture, and it is also the hub's 450 px hero

**Evidence.** `wp17/after5/ko_blog-1440x900-dark.png` (hub) — the featured hero and the 1st, 4th and 5th
story cards are pixel-identical "chip stack over a club" drawings; only 2 of 6 differ (heart/venn,
diamond/bar). Same at 390: `wp17/crops/after-blog-390-rows.png`. Same drawing again as the story page
hero: `wp17/crops/b-story-1440-top.png`, and on the home page's featured story
(`ko-1440x900-dark.png`, y≈4700). Root cause is data, not layout: `src/content/registry/blog/stories/*.ts`
give `topic: 'hand-strength'` to `qq-vs-72o-flop-227`, `full-house-loses`, `aa-loses`, `ak-flop-miss`,
and `ContentThumbnail.tsx:115-125` keys the drawing on `(kind, topic)` only.

**Why it matters.** The hand-story grid is the most image-heavy screen on the site and the one a
beginner is most likely to browse. Four identical 380 px blocks in one column is the single clearest
"generated site" signal in the product, and it actively defeats the component's own stated goal
("a reader must recognise the picture they clicked", `ContentThumbnail.tsx:73`).

**Direction.** Either key the drawing on `slug` as well as `topic` (a deterministic variant index is
enough — different motif rotation/colour per story), or drop the thumbnail from the story rows entirely
and let the `BoardCards`/hero-hand strip be the picture. The board cards are already the most
informative graphic on those pages.

### B-M2 | navigation | `/ko/hands` (21 pages) and `/ko/about` are in the mobile menu but **not** the desktop header

**Evidence.** Built desktop header links in `.next/server/app/ko.html`: `/ko/learn`, `/ko/tools/range`,
`/ko/tools`, `/ko/practice`, `/ko/blog`, `/ko/glossary`, `/ko/search` — no `/ko/hands`, no `/ko/about`.
Mobile panel (`wp15/header-menu-open-390x844-dark.png`) shows a **더 보기** group with 검색 · 핸드 목록 · 소개.
Source confirms it is deliberate: `src/components/SiteHeader.tsx:86` `MOBILE_MORE_IDS = ['search','hands','about']`
with the comment "the header's six do not, plus search — so no page is reachable only by scrolling to
the footer".

**Why it matters.** On desktop — the wider canvas, with room to spare in a 6-item nav — a whole content
pillar (`/ko/hands` + 20 hand pages, the 169-cell index) is reachable only from the footer or an in-body
link, while the phone user gets it one tap away. That is backwards, and it makes the desktop
information scent worse than the mobile one. The site also devotes nav slot 2 to `핸드레인지`, which is a
dense 13×13 matrix tool, while the beginner-friendly `핸드 목록` is hidden.

**Direction.** Add `핸드` to the desktop header (7 items still fit at 1440 — the row is `whitespace-nowrap`
with ~500 px of slack), or promote it and demote `핸드레인지` into `무료 도구`.

### B-M3 | product promise | The flagship tool in nav slot 2 shows 5 of 8 controls disabled as `준비 중`

**Evidence.** `wp17/after/ko_tools_range-1440x900-dark.png` (top): under 상황, `앞 사람이 레이즈했을 때 (Facing Open)`
and `상대가 3벳을 했을 때 (Facing 3-Bet)` are greyed `준비 중`; under 스택, `40BB`, `60BB`, `150BB+` likewise.
Only `First In` and `100BB` are live. The same five reappear on `/ko/practice/range-quiz`
(`wp17/after/ko_practice_range-quiz-1440x900-dark.png`, right panel). Across the built site:
`grep -rl --include='*.html' '준비 중'` → 7 pages, 42 occurrences (range 14, range-quiz 10, blog 8, home 4,
hands 2, about 2, glossary/three-bet 2).

**Why it matters.** I want to be precise here, because the *honesty* is a strength and the FAQ
(`/ko` → "핸드레인지 표는 어떤 상황을 기준으로 하나요?") states the limit plainly — that is the right instinct and
should not change. The problem is the **form**: a grid of five dead buttons is the visual grammar of an
unfinished admin panel, and it is the second thing in the nav. A beginner reads "this product is 20 %
built", which is a harsher message than the truth ("this product covers one situation, thoroughly").

**Direction.** Keep the disclosure, drop the dead controls. One line above the matrix — "지금은 6인 ·
100BB · First In 한 가지 상황만 다룹니다" (already the exact wording of the FAQ answer) — says the same thing
without five disabled targets. Same treatment on `/ko/practice/range-quiz`.

### B-M4 | reading rhythm / CTA priority | Every lesson and article ends with 4–5 identical link groups, and the real next step is the smallest thing on screen

**Evidence.** Lesson tail (`wp17/crops/a-lesson-1440-bottom.png`): 같이 알아둘 용어 → 직접 확인하기 → 비슷한 핸드 →
더 배우기 → 이런 이야기도 있어요 → 이전/다음. Five headed, identically-ruled groups before the pagination, and
the 이전/다음 row is set in the *smallest* type of the whole tail. Article tail
(`wp17/crops/a-aks-1440-light-bottom.png`): same five groups, then a ToolCTA band, then 다음. Term tail
(`wp17/crops/a-term-1440-light-bottom.png`): three groups, no next step at all. Single-item groups
(비슷한 핸드 with one card, 더 배우기 with one) leave the right half of the two-column row empty.

**Why it matters.** After finishing a 5-minute lesson the reader faces ~12 links in five visually
identical blocks with no priority signal, and the one action the product actually wants (다음 레슨) is
last and quietest. That is where a beginner drops out of a course. The half-empty rows also make the
page bottom look ragged rather than composed.

**Direction.** Promote 다음 레슨 to a single full-width step above the related groups (it is the site's
own model — the home CTA band does exactly this), and collapse the remaining groups from five headed
blocks to at most two ("이어서 읽기" / "직접 확인하기"). Suppress a group entirely when it has one item, or
merge it into a neighbour so no row renders half-empty.

### B-M5 | mobile 320 | The `DataTable` caption is clipped — the "6인 · 100BB · First In" condition disclosure becomes unreadable

**Evidence.** `wp17/crops/a-pos-320.png` and `wp17/evidence/table-scroll-320-{dark,light}.png`
(`/ko/learn/positions-6max` at 320): the visible caption renders as
`자리별 학습용 기본 레인지의 크기 · 6인 · 100BB` [cut at the right edge] / `In(아무도 들어오지 않았을 때 가장 먼저 레이즈)` —
the words `· First` are lost, in **both** themes. At 390 the identical caption reads in full
(`after/ko_learn_positions-6max-390x844-dark.png`). The caption sits *outside* `[data-scroller]`
by design (`DataTable.tsx:68-72`), so unlike the table it cannot be scrolled to reveal the rest —
the text is simply gone.

**Why it matters.** This is not a decorative string. It is the provenance line the product promises
always to show beside a range number, and it is the exact sentence that keeps the table from reading as
a universal recommendation. Losing it silently on the narrowest phones undercuts the site's core
honesty commitment, and the reader has no affordance telling them anything is missing.

**Direction.** Let the visible caption wrap to the column rather than the table's min-content width
(give it its own block outside `.table-scroll`, or `min-w-0` on the caption's containing block), and add
an e2e assertion that the caption's `scrollWidth <= clientWidth` at 320 on a page with a wide table.

---

## MINOR

### B-m1 | home | The numbered section sequence starts at **02** and the FAQ band has no number
`src/app/[locale]/page.tsx:293-395` passes `index={2}`…`index={9}`; the hero carries the eyebrow
`무료 텍사스 홀덤 학습` rather than `01`, and the closing `자주 묻는 질문` band
(`wp17/crops/a-home-faq-1440-dark.png`) has no eyebrow at all. On screen the reader sees 02·시작점,
03·배우는 순서 … 09·포커 용어 and then an unnumbered block. A visible counter that begins at 02 and stops
before the last section reads as a missing section, not as a design choice. Either number the hero 01
and the FAQ 10, or drop the numbers.

### B-m2 | footer / trust | No copyright, no year, no contact, no legal line
`.next/server/app/ko.html` footer text ends at the five link columns and the two blurbs; there is no
`©`, no operator name, no contact route, no last-updated date (verified by extracting the whole
`<footer>` element). Visually confirmed on every page shot. For an educational site that asks a
beginner to trust its numbers, the absence of *any* identity line at the bottom is the cheapest
possible credibility gap to close. The `/ko/about` page is strong and does this work — it just is not
linked from the footer's bottom rail where people look for it.

### B-m3 | blog hub | "콘텐츠 타입 5" counts a type with zero articles
`wp17/after5/ko_blog-1440x900-dark.png` (stat strip): 전체 글 25편 · 핸드 스토리 6편 · 콘텐츠 타입 **5**, and the
type row reads 핸드 스토리 6 · 검색 가이드 10 · **초보자 실수 (준비 중)** · 데이터와 확률 6 · 포커 개념·문화 3 — 6+10+6+3 = 25,
so 초보자 실수 has none. The `준비 중` chip is honest; the headline number `5` is not, because it counts a
category the reader cannot open. Count the 4 that exist, or drop the empty chip until it has content.

### B-m4 | tools/equity | The **결과** panel sits above the **카드를 선택하세요** panel
`wp17/after/ko_tools_equity-1440x900-dark-fold.png`: a first-time visitor's entire first screen is an
answer (82.4 % / 0.5 % / 17.1 %) to a question they have not asked; the card picker only starts at
y≈950. Same on mobile (`equity-390x844-dark`, picker begins below the fold). A persistent result panel
is a defensible pattern, but it needs to *follow* the input on first paint or carry a "예시" framing.

### B-m5 | tools/equity | The card grids leave the right half of a 1200 px panel empty
Same shot: the four suit rows stop at x≈760 inside a panel that runs to x≈1320. ~45 % of the widest
panel on the site is blank, three times over (내 핸드 / 상대 핸드 / 보드). Two columns of suits, or a
narrower panel, would read as composed rather than unfinished.

### B-m6 | design system | The "correct answer" colour is the poker **call** colour
`QuizQuestionCard.tsx:124,151,186`, `MiniQuiz.tsx:104`, `QuizProgress.tsx:27`, `QuizResult.tsx:92,151`
all use `act-call-500` (#2ba3a3 teal). The same token is the `RangeCompareMatrix` "DIFFERS" fill
(`RangeCompareMatrix.tsx:37`) and the learn thumbnail accent (`ContentThumbnail.tsx:109`). Visible in
`wp15/range-quiz-answered-1440x900-dark-fold.png`, where the correct option 제외 is ringed teal next to a
red ✕. One hue carries four unrelated meanings, and teal appears nowhere else in a charcoal+red system,
so the quiz feedback reads as a different product's component. A dedicated positive token (or reusing
`brand-500` for "correct" with a ✓ and a different weight) would keep the palette honest.

### B-m7 | quiz at 320 | A five-card hand wraps 4 + 1
`wp17/crops/after-quiz-320-options.png` and `evidence/quiz-options-320.png`: on
`/ko/practice/hand-ranking-quiz`, 핸드 A renders `K 9 7 4` then `2` on a second line. Flagged as a known
limitation in the WP-17 handoff, and page-level overflow is indeed the worse failure — but this is
specifically the *hand-ranking* quiz, where "these five cards are one hand" is the thing being taught.
Shrinking the card glyph below 272 px of available width would preserve the row.

### B-m8 | practice/range-quiz | ~500 px of dead left column
`wp17/after/ko_practice_range-quiz-1440x900-dark.png`: below the 퀴즈 시작 button the left column is empty
down to the next section while the right card runs on. Reads as a layout that lost its content.

### B-m9 | glossary term | Related groups render single-column inside a two-column grid
`wp17/crops/a-term-1440-light-bottom.png`: 더 배우기, 직접 확인하기 and 이런 이야기도 있어요 each hold one item, all
left-aligned in a grid whose right half is blank, and the page then ends with no next step. Compare the
lesson template, which at least has 이전/다음.

### B-m10 | 320 | The royal-flush hero is clipped on both edges
`wp17/after/ko-320x700-dark.png` (y≈760-1140, zoomed): the A♠ is cut on the left and the 10♠ renders as
a clipped `1O` on the right. At 390 the fan is intact. The five-card royal flush is the site's single
strongest brand asset and the one image a 320 px visitor sees first; it should scale, not crop.

### B-m11 | beginner comprehension | `/ko/glossary/pot-odds` derives 28.57 % from an unstated bet size
`wp17/after5/ko_glossary_pot-odds-1440x900-light.png`, §예로 보면: "상대가 팟(Pot)보다 조금 작은 금액을 베팅한 상황을
가정하면, 이때 콜에 필요한 최소 승률은 **28.57 %**로 계산됩니다." A beginner cannot reproduce 28.57 % from "조금 작은
금액", and 28.57 % corresponds to a bet of 0.4× pot — which is not what "팟보다 조금 작은" suggests. The one
page in the site whose whole job is teaching this arithmetic is the one that hides the inputs. (Flagging
the comprehension failure; the numeric claim itself is Reviewer A's call.)

---

## NOTE (observations, not defects)

- **B-n1** `/ko/learn` lists all 15 lessons twice — once in the 3-stage roadmap, once regrouped under
  특정 주제 배우기 (`wp17/after5/ko_learn-1440x900-dark_01.png`). It is a deliberate A/B path model and the
  eyebrow explains it ("주제 안의 순서는 학습 순서와 같고, 번호도 같습니다"), but it doubles the page and a scanner may
  think the list repeated by mistake.
- **B-n2** `/ko/hands` renders 169 cells of which 20 are links (`wp17/after/ko_hands-1440x900-dark.png`).
  The subtitle says so plainly and the stat strip reads 페이지가 있는 패 20개 / 전체 시작 패 169개, so this is
  honest — but 149 inert look-alike cells is a lot of invitation to click nothing.
- **B-n3** An article/story hero band is ~450 px of generic decoration before the first paragraph
  (`crops/b-aks-1440-top.png`, `b-story-1440-top.png`). Acceptable editorially; worth re-checking once
  real assets land, because today it costs a screen of scroll for no information.
- **B-n4** The featured-story block on the home page duplicates the top row of `/ko/blog` exactly (same
  story, same copy, same picture). Fine, but it means the two most likely entry points show the same
  thing.
- **B-n5** The home `자주 묻는 질문` block answers "what is this site", not poker questions, and says so in
  its own dek. Correct scoping — noting it because it is easy to mistake for thin content.
- **B-n6** `준비 중` also appears inside body prose (`/ko/glossary/three-bet`: "…3BetTilt가 아직 다루지 않는
  부분이라, 준비 중입니다"). Individually fine and honest; see B-M3 for the cumulative effect.
- **B-n7** Footer column 콘텐츠 holds only 블로그 · 검색 against columns of 5 and 7, so the footer grid reads
  ragged at every width.

---

## Checked and found FINE (stated explicitly, per the brief)

- **No horizontal overflow anywhere.** `wp17/after/shots*.jsonl`: 127 shot records across 1440 / 390 /
  320, every one `overflowX: 0` and `h1: 1`. I spot-confirmed visually at 320 on home, learn, quiz,
  positions-6max, tools/starting-hand.
- **Light mode is a first-class theme, not an afterthought.** Home, learn hub, glossary term, blog
  article, quiz-answered and 404 all hold their hierarchy, accents and card/table contrast in light
  (`*-light.png` pairs). No inverted-only or unreadable element found.
- **Glossary hub is genuinely good.** Dictionary index, not a card wall: search box, 6 category chips
  with counts, initial-consonant index, "가장 많이 연결된 용어" with an explicit "숫자는 연결된 페이지 수이고, 검색량이
  아닙니다" disclaimer, then a ruled 64-term list with Korean + English + aliases.
- **Empty initial-consonant letters are handled correctly** — `ㅁ` renders as
  `<span aria-disabled="true">`, every other letter as an anchor (verified in `ko/glossary.html`). No
  dead links.
- **Search works as a product.** `/ko/search?q=3벳` groups by 용어 / 읽을거리 / 배우기 with per-group counts,
  highlights the query in both title and snippet, and handles the 3벳/3-Bet/three-bet alias family
  (`wp17/after/ko_search_q_3-1440x900-dark.png`).
- **404 is helpful, branded and bilingual-safe** — search box, 홈으로 가기, and seven described
  destinations including 핸드 목록 (`wp17/after/ko_no-such-page-1440x900-dark.png`).
- **Provenance discipline holds in the UI.** Every range surface I opened labels itself
  `학습용 기본 레인지 · 6인 · 100BB · First In` and never says GTO; every hand story shows the
  `재구성한 시나리오` chip in the hero and the reconstruction sentence in hub rows and on the home page.
- **Mobile nav panel is well built** — 6 primary items plus a 더 보기 group, current item marked, large
  targets, search and theme in the bar (`wp15/header-menu-open-390x844-*`).
- **The 13×13 matrix is usable on a phone** — it scrolls inside its own box with an explicit
  `↔ 표를 옆으로 밀면 나머지 칸도 볼 수 있어요.` hint and a legend below (`ko-390x844-dark`, y≈4800).
- **Focus rings draw** on nav, CTAs, related rows and the range position chips, in both themes
  (`wp17/evidence/focus-*.png`, `lesson-chip-focus-390-*.png`).

## If only three things get fixed

1. **B-M1** — give the six hand stories six different pictures (or no picture).
2. **B-M3** — replace the five `준비 중` chips on `/ko/tools/range` and `/ko/practice/range-quiz` with the
   one-line scope statement the FAQ already uses.
3. **B-M4** — promote 다음 레슨 above the related tail and cut the tail from five groups to two.

`B-M2` (desktop nav) is a two-line change and `B-M5` (320 caption) is a real content-loss bug; both are
cheap enough that they should not wait for a second pass.
