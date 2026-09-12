# WP-H2 — Learn lessons 07-10 (position, positions-6max, poker-actions, preflop)

## 1. Scope

Four Learn lessons, immediately after the published `poker-range` (lesson 06):

| Order | id | slug | Concepts owned |
| --- | --- | --- | --- |
| 7 | `position` | `position` | position, acting-order, information-advantage |
| 8 | `positions-6max` | `positions-6max` | seat-names, blinds, button-moves, six-max |
| 9 | `poker-actions` | `poker-actions` | action, check, bet, call, raise, fold |
| 10 | `preflop` | `preflop` | preflop, open-raise, limp, first-in |

`poker-range` (lesson 06) was not touched. No other batch's registry/MDX file was edited.

## 2. Files changed

| File | Change |
| --- | --- |
| `apps/fishtilt/content/learn/position.mdx` | new |
| `apps/fishtilt/content/learn/positions-6max.mdx` | new |
| `apps/fishtilt/content/learn/poker-actions.mdx` | new |
| `apps/fishtilt/content/learn/preflop.mdx` | new |
| `apps/fishtilt/src/content/learn/h2.ts` | MDX map: 4 slug -> component entries |
| `apps/fishtilt/src/content/registry/learn/h2.ts` | 4 records `PLANNED` -> `PUBLISHED`; lesson 09 title/description fixed; `readMinutes`/`indexable` set from measured text |
| `apps/fishtilt/src/content/registry/learn/h2.test.ts` | new — batch gate (19 tests) |
| `docs/reports/WP_H2_LEARN_RANGE_POSITION.md` | this report |

## 3. Lesson table

| slug | Promise | Interactive element | Facts cited | Outbound links |
| --- | --- | --- | --- | --- |
| `position` | Same hand, different seat -> different amount of known information, shown not asserted | `RangeMatrixMini positions={['UTG','BTN']}` (toggle) | `RFI_POSITIONS_WITH("87s")` | prereq `poker-range`; tools `range`; concepts `term-position`, `term-button`; next `positions-6max`; article `blog-btn-why-wide` |
| `positions-6max` | Names + rotation of the six seats, not memorised as a list | `RangeMatrixMini` (5-toggle) + a second `RangeMatrixMini positions={['SB','BB']}` to show BB's own explanation live | none (structural, no numeric fact needed) | prereq `position`; tools `range`; concepts all 8 seat/position terms; next `poker-actions`; articles `blog-btn-why-wide`, `blog-why-blinds-exist` |
| `poker-actions` | Five actions, correctly, replacing the wrong "four" | `PokerCards` board + `MiniQuiz` + `Callout` | none | prereq `holdem-basics`; tools `toolPotOdds`; concepts all 6 action/open-raise terms; next `preflop` |
| `preflop` | What "preflop" is, open-raise vs. limp, and an explicit "facing an open is not shipped yet" disclosure | `RangeMatrixMini positions={['UTG']}` | `RFI_POSITIONS_WITH("ATo")`, `RFI_POSITIONS_WITH("72o")` | prereq `poker-actions`, `poker-range`; tools `range`; concepts `term-preflop`, `term-open-raise`, `term-limp`; next `flop-turn-river`; article `blog-why-use-range` |

All four also carry the mandatory in-prose `<ToolCTA>` (content.test.ts's mid-content rule), and every `<Term>` used is exactly once per file and listed in that record's `relatedConcepts` (verified by `h2.test.ts`, not by inspection).

## 4. Lesson 09 fix (ruling 12 / plan §1.1 R3)

| | Before | After |
| --- | --- | --- |
| title | `콜 · 체크 · 레이즈 · 폴드는 언제 하나요?` (names four) | `체크 · 베팅 · 콜 · 레이즈 · 폴드, 다섯 가지 행동` |
| description | `내 차례에 고를 수 있는 행동은 네 가지뿐입니다. 각각이 무엇을 뜻하는지부터 확실히 합니다.` | `내 차례에 고를 수 있는 행동은 다섯 가지입니다. 체크, 베팅, 콜, 레이즈, 폴드가 각각 무엇을 뜻하고 언제 고를 수 있는지 확실히 합니다.` |

The MDX itself opens with the corrected count ("다섯 가지: 체크, 베팅, 콜, 레이즈, 폴드") and a `Callout` states the two legal-action groups. `h2.test.ts` asserts the registry text contains "다섯 가지", names all five actions, and does not contain "네 가지".

## 5. Strategic claims avoided, and what was written instead

This is the point of the batch — "position" and "preflop" are exactly where a writer starts asserting what to do.

| What I wanted to say | What I wrote instead |
| --- | --- |
| "Late position is better because you see more before you act" (implies you should play differently) | "정보가 많다고 그 판을 반드시 이긴다는 뜻은 아닙니다. 이 글은 자리마다 아는 정보의 양이 다르다는 사실만 확인합니다." (`position`, explicit Callout) |
| "That's why BTN opens wider than UTG" (causal strategy claim) | Showed the two facts side by side (information differs by seat; the shipped range differs by seat) without asserting the second is *caused by* or *justified by* the first |
| A "why UTG/HJ/CO are named that" folklore etymology (I drafted one, then removed it — see below) | "이름의 유래를 외울 필요는 없고, 몇 번째로 행동하는 자리인가라는 위치만 기억하면 충분합니다." |
| A bet-sizing convention (e.g. "raise 3x the blind") | "얼마를 걸지는 상황마다 다르고, 정해진 배수 같은 규칙이 있는 것은 아닙니다. 이 사이트는 그 금액을 얼마로 정해야 하는지는 알려주지 않습니다." |
| "Limping is a mistake / weaker than raising" | Defined limp neutrally as "빅 블라인드와 같은 금액만 맞추는 것" with no value judgement |
| "If it's in the range, you should raise it" | "표에 칠해져 있으면 무조건 레이즈해야 하나요? 아닙니다. 이 표는 학습용 기본 레인지일 뿐이고, 실제 선택은 상황과 상대에 따라 달라질 수 있습니다." |
| Facing-open / facing-3-bet ranges (not shipped) | `preflop` states plainly: "누군가 이미 레이즈한 뒐 내가 무엇을 해야 하는지는 아직 이 사이트에 준비되어 있지 않습니다." |

One self-caught near-miss: an early draft of `positions-6max` asserted a specific reason "UTG" is named that way (tied to caution/information). That is an invented, unsourced etymology — removed and replaced with the neutral "the name doesn't matter, the seat position does" framing above, per CLAUDE.md rule 7.

Every `RangeMatrixMini` renders `학습용 기본 레인지` and its 6인·100BB·아무도 참여하지 않았을 때 condition itself (component-owned, not prose-owned); `preflop` additionally restates the condition once in its own Callout. `h2.test.ts` asserts any prose mentioning "6인"/"100BB" also carries the fixed label nearby.

## 6. Facts wanted and not available

None. Every number the four lessons needed already existed in `facts.ts` (`RFI_POSITIONS_WITH`). No new fact was requested or blocked.

## 7. Tests run, with real counts

| Command | Result |
| --- | --- |
| `pnpm vitest run --project fishtilt src/content/registry/learn/h2.test.ts` | **19/19 passed** (my batch gate) |
| `pnpm vitest run --project fishtilt content.test.ts` | **43/43 passed** |
| `pnpm vitest run --project fishtilt graph.test.ts` | **14/15 passed** — 1 failure not mine, see §8 |
| `pnpm vitest run --project fishtilt` (whole app) | **785/788 passed, 3 files failed** — all 3 not mine, see §8 |
| `pnpm typecheck` (all 13 workspace projects) | **0 errors** |
| `npx eslint apps/fishtilt --max-warnings=0` | **1 error, 1 warning — in `apps/fishtilt/measure-h1-tmp.mjs`, a file I did not create and do not own** (unused import + a `console` call). My own four files (`h2.ts` x2, `h2.test.ts`) lint clean in isolation. |

## 8. Failures not caused by this batch's content, with root cause

Ran the suite repeatedly as the codebase moved under concurrent agents; by the final run only 3 of an earlier 5 failures remained (2 resolved on their own as the concurrent glossary batch progressed). All 3 remaining are outside this batch's file boundary (`graph.test.ts`, `src/components/**`, `src/app/**` are explicitly off-limits) and are root-caused, not just observed:

1. **`src/content/graph.test.ts` > "states only the level when there is no text to time yet"** — hard-codes `contentById('position')` expecting `status: 'PLANNED'`. Caused by my (correct, in-scope) publish of `position`. This is exactly the failure mode `docs/FISHTILT_STATE.md` ruling 26 names and warns against ("a test asserting how the product behaves in a state must construct that state, not borrow a real record that will later publish").
2. **`src/components/RelatedContent.test.tsx` > "never links a piece that is not written yet"** — hard-codes `LESSON = contentById('poker-range')` and asserts `LESSON.nextLessons[0]` (`= 'position'`) is still `PLANNED`. Same cause and same ruling-26 pattern.
3. **`src/app/learn/page.test.tsx` > "links a written lesson and marks an unwritten one 준비 중"** — a genuine latent bug, not a stale-fixture one: the test builds `new RegExp(lesson.title, 'u')` **without escaping regex metacharacters**. Lesson 07's title (`자리(포지션)가 왜 그렇게 중요할까요?`, written before this batch by WP-G4, not edited by me) contains literal `(` `)`, which the unescaped regex reinterprets as a capture group instead of literal characters, so it can never match the very text it is supposed to find. Verified directly: `new RegExp('자리(포지션)가 왜 그렇게 중요할까요?').test('자리(포지션)가 왜 그렇게 중요할까요?')` -> `false`. This bug was dormant while `position` was `PLANNED` (the earlier "lists every lesson" test in the same file uses plain `getByText`, not a regex, so it never tripped it) and surfaces now that `position` is correctly `PUBLISHED`. `src/app/glossary/page.test.tsx` already has an `escapeRegExp` helper for exactly this reason (its own comment: glossary titles "always carry a literal parenthesised English gloss"); `src/app/learn/page.test.tsx` needs the same fix, since at least one lesson title also carries parentheses.

None of these three touch my batch's own correctness (registry relations, threshold, Fact/Term validity, five-actions fix) — all verified independently by `content.test.ts`, `graph.test.ts`'s other 14 tests, and my own `h2.test.ts`.

Also **not mine**, found during the lint gate: `apps/fishtilt/measure-h1-tmp.mjs` is an untracked scratch file (unused `unmetIndexRequirements` import, a bare `console.log`) that is not part of my four-file boundary and appears to be another concurrent agent's leftover probe script.

## 9. Known limitations

- `preflop` explicitly states that facing-an-open / facing-a-3-bet ranges are not shipped (settled decision 2) — this is a genuine product gap, not something introduced by this batch.
- `positions-6max` does not explain postflop acting order (SB acts first postflop) — out of scope for "seat-names, blinds, button-moves, six-max"; deferred implicitly to `flop-turn-river` (H3), not claimed here.

## 10. Needs a source change

- `src/app/learn/page.test.tsx` should escape lesson titles before building its match regex, the same way `src/app/glossary/page.test.tsx` already does with its local `escapeRegExp` helper (§8 item 3). This is a pre-existing latent bug, not something this batch is authorized to fix (`src/app/**` is out of this batch's boundary).
- `src/content/graph.test.ts` and `src/components/RelatedContent.test.tsx` should stop hard-coding `'poker-range'`/`'position'` as their "still-PLANNED" fixture and instead construct a synthetic record, per ruling 26's own prescription (the fix `src/components/Term.test.tsx` already applies, via `glossaryRecords().find((entry) => entry.status === 'PLANNED')`).

**Note on suite stability:** other batches were landing concurrently while this report was written. A rerun immediately before finishing showed a 4th, structurally identical failure — `src/app/tools/hand-checker/page.test.tsx` expecting the still-`PLANNED` `hand-rankings` lesson (owned by H1) to render `준비 중`, which flipped when H1 published it mid-session. This is the same ruling-26 pattern, in a file this batch never touched (`src/app/**`), confirming the suite's remaining red is a moving target driven by concurrent content batches finishing, not a defect in this batch's four lessons — which are independently gated by `h2.test.ts` (19/19) regardless of what else in the repo publishes next.
