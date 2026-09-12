# WP-O0 — Beginner-Language First-Use Link Pass (§48)

## 1. Scope

Linking-only pass across the 13 flagged content pages. No poker claims, numbers, `<Fact>`,
`<PokerCards>`, `<MiniQuiz>`, `<ToolCTA>`, or `<Callout>` content changed. `content/hands/**`,
`src/**`, `docs/**` (other than this report), tests, and `routes.ts` untouched. No new poker
prose written; only `<Term>` wraps on abbreviations already in the text, plus one short
BB-unit clause on 5 designated pages.

## 2. Files changed — term linked, sentence before/after

| File | Term linked (first use) | Before | After |
| --- | --- | --- | --- |
| `content/learn/position.mdx` | `term-utg` | "지금은 자리 두 개, UTG와 BTN만 놓고 비교합니다." | "지금은 자리 두 개, `<Term id="term-utg">언더더건(UTG)</Term>`과 BTN만 놓고 비교합니다." |
| `content/learn/preflop.mdx` | `term-utg` | "이 표는 UTG 한 자리만 보여줍니다." | "이 표는 `<Term id="term-utg">언더더건(UTG)</Term>` 한 자리만 보여줍니다." |
| `content/learn/preflop.mdx` | `term-hijack`, `term-button` | "...HJ나 BTN 같은 다른 자리도 똑같이 프리플랍을 거칩니다." | "...`<Term id="term-hijack">하이잭(HJ)</Term>`이나 `<Term id="term-button">버튼(BTN)</Term>` 같은 다른 자리도 똑같이 프리플랍을 거칩니다." |
| `content/learn/poker-range.mdx` | `term-utg`, `term-button` | "UTG와 BTN을 번갈아 눌러보세요." | "`<Term id="term-utg">언더더건(UTG)</Term>`과 `<Term id="term-button">버튼(BTN)</Term>`을 번갈아 눌러보세요." |
| `content/learn/three-bet.mdx` | `term-utg`, `term-button` (abbrev-only, list) | "- UTG가 3BB로... / - BTN이 9BB로..." | "- `<Term id="term-utg">UTG</Term>`가 3BB로... / - `<Term id="term-button">BTN</Term>`이 9BB로..." |
| `content/learn/three-bet.mdx` | `term-small-blind` | "만약 BTN 다음에 SB가 다시 27BB로 레이즈한다면," | "만약 BTN 다음에 `<Term id="term-small-blind">스몰 블라인드(SB)</Term>`가 다시 27BB로 레이즈한다면," |
| `content/blog/btn-why-wide.mdx` | `term-button` | "버튼(BTN)에서 더 많은 패를 쓰는 이유를..." | "`<Term id="term-button">버튼(BTN)</Term>`에서 더 많은 패를 쓰는 이유를..." |
| `content/blog/btn-why-wide.mdx` | `term-utg` (abbrev-only) | "...UTG(첫 번째 자리)가 프리플랍에서 가장 먼저 행동하고..." | "...`<Term id="term-utg">UTG</Term>`(첫 번째 자리)가 프리플랍에서 가장 먼저 행동하고..." |
| `content/blog/btn-why-wide.mdx` | `term-hijack`, `term-cutoff` | "...UTG나 HJ, CO의 첫 레이즈 목록에는 들어 있지 않습니다." | "...UTG나 `<Term id="term-hijack">하이잭(HJ)</Term>`, `<Term id="term-cutoff">컷오프(CO)</Term>`의 첫 레이즈 목록에는 들어 있지 않습니다." |
| `content/blog/why-use-range.mdx` | `term-utg`, `term-button` | "...UTG가 첫 레이즈로 쓰는 조합은... BTN이 쓰는 조합은..." | "...`<Term id="term-utg">언더더건(UTG)</Term>`이 첫 레이즈로 쓰는 조합은... `<Term id="term-button">버튼(BTN)</Term>`이 쓰는 조합은..." |

BB-unit clause pages are in §3.

## 3. BB-as-unit decision

**Clause settled on (used verbatim, 5 places):**

> 이 사이트는 금액을 `<Term id="term-big-blind">빅 블라인드(BB)</Term>`의 배수로 나타냅니다.

Wording matches the site's own existing explanations (`content/glossary/big-blind.mdx`: "스택이나 베팅 크기를 이야기할 때 쓰는 단위 BB는 바로 이 빅 블라인드 금액을 기준으로 합니다"; `content/blog/why-blinds-exist.mdx`: "이 사이트는 빅 블라인드 한 번 낸 금액을 1BB라는 기준 단위로 놓고 모든 숫자를 그 배수로 씁니다"). Inserted as one standalone sentence immediately after the sentence containing the first BB-unit occurrence; nothing else in those sentences changed.

| Page | Insertion point |
| --- | --- |
| `content/learn/pot-odds.mdx` | After "...상대가 5BB를 베팅했다고 해봅시다." |
| `content/blog/pot-odds-quick.mdx` | After "...필요한 최소 승률은 ...입니다." (first, 하프팟 3BB case) |
| `content/blog/outs-nine.mdx` | After "...이 콜에 필요한 최소 승률은 ...입니다." |
| `content/blog/aks-vs-ako.mdx` | After "...AKo도 ...로 똑같습니다." (the sentence containing "100BB") |
| `content/blog/is-ak-good.mdx` | After "...AKo는 ...입니다." (the sentence containing "100BB") |

## 4. Occurrences deliberately left unlinked

| Page | Occurrence | Why |
| --- | --- | --- |
| `content/learn/position.mdx` | "100BB" (line 12, stack-depth qualifier) | Money-unit form; this page is not one of the 5 designated BB-clause pages, and a single stray "100BB" inside a comparison clause isn't worth restructuring — matches instruction "you cannot wrap 10BB in a term link and have it read sensibly." |
| `content/learn/preflop.mdx` | "1BB"×3, "100BB"×1 | Same reasoning — money-unit only, page not in the 5-page clause list; "빅 블라인드" is already spelled out in Korean immediately before "1BB" so the meaning is already clear without a link. |
| `content/learn/poker-range.mdx` | "100BB" (line 65, boilerplate "6인 테이블, 100BB, ..." condition phrase) | Same — money-unit only, not in the 5-page clause list; this exact boilerplate phrase recurs across many pages site-wide, so fixing it here only would be inconsistent without a broader pass the orchestrator didn't ask for. |
| `content/blog/btn-why-wide.mdx` | "100BB" inside "(6인·100BB·...)" descriptor | Same reasoning as above. |
| `content/learn/hand-matrix.mdx` | UTG, BTN | **No prose occurrence exists at all.** Both abbreviations appear only inside `<RangeMatrixMini positions={['UTG','BTN']} initial="UTG" .../>` — a JS prop/array, not MDX children, so `<Term>` cannot be embedded there, and the caption text on this page never mentions UTG/BTN either. See §7 — this is a genuine gap needing a different fix (component or copy), not left "for cleanliness" but because no valid insertion point exists within my file boundary. |
| `content/learn/starting-hand-ranking.mdx` | UTG, BTN | Same as above — only appears in `<RangeMatrixMini positions={['UTG','BTN']} initial="BTN" .../>` props; zero prose mentions anywhere in the file. |

## 5. First occurrence in a bad spot — what I did instead

| Page | Problem | Resolution |
| --- | --- | --- |
| `content/learn/three-bet.mdx` | First UTG/BTN sit inside the numbered betting-sequence list ("- UTG가 3BB로 오픈 레이즈를 합니다 — 두 번째 벳"). Full "언더더건(UTG)"/"버튼(BTN)" form would bloat a terse sequence list. | Used the abbreviation alone as link text (`<Term id="term-utg">UTG</Term>`, `<Term id="term-button">BTN</Term>`), per the instruction's explicit exception for this exact "numbered list of a betting sequence" case. |
| `content/blog/btn-why-wide.mdx` | First UTG occurrence is "UTG(첫 번째 자리)가..." — inserting the full "언더더건(UTG)" would produce a clumsy double-parenthetical "언더더건(UTG)(첫 번째 자리)가". | Kept just the abbreviation as link text: `<Term id="term-utg">UTG</Term>(첫 번째 자리)가...`, preserving the existing explanatory parenthetical untouched. |

Grammar note: where the bare abbreviation is replaced by "Korean name(ABBR)" and the noun's final sound changes (e.g. "UTG" read as 유티지, vowel-final → "언더더건" read with final ㄴ, consonant-final), I adjusted the attached particle so the sentence still reads correctly (e.g. "UTG와" → "언더더건(UTG)과"). No wording, argument, or claim was changed — only case particles required by standard Korean euphonic agreement.

## 6. Tests run

`pnpm vitest run --project fishtilt`: **14 failed | 1036 passed** (1050 total, 94 files: 85 passed / 9 failed).

Failures caused by this change (6 of the 9 failed files — all the same root cause):
`src/content/content.test.ts`, `src/content/registry/learn/h2.test.ts`, `h3.test.ts`,
`src/content/registry/blog/i1.test.ts`, `i3.test.ts`, `i4.test.ts` — all fail with
`<Term id="..."> is not in relatedConcepts`. Adding a `<Term>` to prose requires a matching
entry in that page's `relatedConcepts: [...]` array, which lives in
`src/content/registry/{learn,blog}/*.ts` and `published.ts` — outside my permitted file
boundary (`src/**` is explicitly off-limits for me). I did not edit these files. The
orchestrator (or a `src/**`-authorized agent) needs to add, one array each:

| Registry file | Record id | Ids to add to `relatedConcepts` |
| --- | --- | --- |
| `src/content/registry/learn/h2.ts` | `position` | `term-utg` |
| `src/content/registry/learn/h2.ts` | `preflop` | `term-utg`, `term-hijack`, `term-button` |
| `src/content/registry/learn/h3.ts` | `three-bet` | `term-utg`, `term-button`, `term-small-blind` |
| `src/content/registry/learn/h3.ts` | `pot-odds` | `term-big-blind` |
| `src/content/registry/learn/published.ts` | `poker-range` | `term-utg`, `term-button` |
| `src/content/registry/blog/i1.ts` | `blog-aks-vs-ako` | `term-big-blind` |
| `src/content/registry/blog/i1.ts` | `blog-is-ak-good` | `term-big-blind` |
| `src/content/registry/blog/i3.ts` | `blog-btn-why-wide` | `term-button`, `term-utg`, `term-hijack`, `term-cutoff` |
| `src/content/registry/blog/i4.ts` | `blog-outs-nine` | `term-big-blind` |
| `src/content/registry/blog/i4.ts` | `blog-why-use-range` | `term-utg`, `term-button` |
| `src/content/registry/blog/i4.ts` | `blog-pot-odds-quick` | `term-big-blind` |

This table accounts for all 20 problems the aggregate `content.test.ts` reports. Once these
11 array edits land, all 6 of these test files should go green with no further content
changes needed. The `<Term>` ids themselves already resolve correctly against
`src/content/registry/glossary/` (verified by reading `index.ts`/`j1.ts` before writing any
id) — the only failing check is the relatedConcepts cross-declaration, not glossary
resolution or MDX syntax.

Failures **not caused by this change** (3 of the 9 failed files, unrelated to content/blog or
content/learn Term usage — likely a concurrent agent's work elsewhere in this repo):
`src/lib/routes.test.ts` (`route registry > availability matches the disk in BOTH
directions`), `src/features/quiz/hub.test.ts` (`practiceHubCards > resolves route to null...`),
`src/features/search/buildIndex.test.ts` (6 sub-tests re: tool-route inclusion). None of these
reference `<Term>`, glossary ids, or any file I touched.

`pnpm --filter fishtilt typecheck`: fails with 3 pre-existing errors, all in files I never
touched — `src/content/registry/glossary/j2.test.ts` (2 errors, `Object is possibly
'undefined'`) and `src/features/quiz/handRankingQuestions.ts` (1 error, unused
`isWheelHand`). Not mine.

## 7. Other §48 jargon spotted, not fixed (out of scope for this pass)

- `content/learn/preflop.mdx`, `content/learn/three-bet.mdx`: "RFI" never appears as bare
  text (always inside `<Fact name="RFI_..."/>` args, not rendered as visible jargon), so not
  a live gap — noted only in case a future audit greps source rather than rendered output.
- `content/learn/three-bet.mdx`: "4-Bet", "5-Bet", "6-Bet" are used and explained inline in
  prose (not abbreviations of a position/role, and the page defines them itself), so these
  don't fit the glossary-link pattern — flagging only for awareness, not a bug.
- `content/blog/aks-vs-ako.mdx`, `content/blog/is-ak-good.mdx`, `content/learn/poker-range.mdx`,
  `content/blog/btn-why-wide.mdx`: all reuse the identical boilerplate parenthetical
  "(6인 · 100BB · 아무도 참여하지 않았을 때 기준)" / "6인 테이블, 100BB, ..." to describe the
  standard baseline range conditions. This phrase is copy-pasted across many more pages than
  the 13 in scope here. If a future pass wants every "100BB" instance explained, this
  boilerplate is the highest-leverage single place to fix (one shared string/component),
  rather than editing each page's copy of it individually.
- `content/learn/hand-matrix.mdx` and `content/learn/starting-hand-ranking.mdx`: the
  `RangeMatrixMini` component renders "UTG"/"BTN" as clickable tab labels straight from its
  `positions` prop, with no accompanying prose mention on either page. This is the real
  §48 gap for these two pages (a reader sees the raw abbreviation as a button label with
  nothing to click through to) — but the fix is either a component-level change (add an
  optional legend to `RangeMatrixMini`, in `src/**`) or new prose linking each abbreviation on
  first mention (both out of bounds for this pass: `src/**` is off-limits and I was told not
  to write new poker prose). Flagging for the orchestrator to route to whichever agent owns
  that component or a follow-up copy pass.
