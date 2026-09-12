# WP-I1 — Blog batch 1 (시작 패 강도)

## 1. Scope

Wrote the five blog articles `docs/FISHTILT_CONTENT_PLAN.md` §7 "I1" assigns: `blog-next-best-after-aa`,
`blog-how-often-aa`, `blog-is-ak-good`, `blog-aks-vs-ako` (replacing WP-G2's placeholder), `blog-qq-vs-ak`
(ruling 24 — `CLASS_VS_CLASS_EQUITY`, not four concrete cards). All five flipped `PLANNED` → `PUBLISHED`
(aks-vs-ako was already `PUBLISHED` as a placeholder), registered in the MDX map, `indexable: true`,
`readMinutes` computed from measured prose. Resumed mid-task after a rate-limit interruption; the
handoff's blocking finding — all five under the 900-char blog floor — is fixed by real expansion, not
padding (detailed in §3/§4 below).

## 2. Files changed

| File | What |
| --- | --- |
| `apps/fishtilt/content/blog/aks-vs-ako.mdx` | Replaced WP-G2 placeholder with the real article |
| `apps/fishtilt/content/blog/next-best-after-aa.mdx` | New |
| `apps/fishtilt/content/blog/how-often-aa.mdx` | New |
| `apps/fishtilt/content/blog/is-ak-good.mdx` | New |
| `apps/fishtilt/content/blog/qq-vs-ak.mdx` | New |
| `apps/fishtilt/src/content/blog/i1.ts` | MDX map: added imports/entries for the four new slugs |
| `apps/fishtilt/src/content/registry/blog/i1.ts` | All five flipped to `PUBLISHED`, `indexable: true`, `readMinutes: 3`; `blog-next-best-after-aa.relatedConcepts` changed `term-combo` → `term-pocket-pair` (matches the `<Term>` the article actually uses) |
| `apps/fishtilt/src/content/registry/blog/i1.test.ts` | New — this batch's gate (22 tests) |
| `docs/reports/WP_I1_BLOG_STARTING_HANDS.md` | This report |

No file outside this boundary was touched.

## 3. Article table

| id | question | answer (one line) | facts cited | outbound links |
| --- | --- | --- | --- | --- |
| `blog-next-best-after-aa` | AA 다음으로 좋은 패는? | Rank 2/3/4 read live off the dataset via `HAND_AT_RANK` (→ KK, QQ, JJ) | `HAND_AT_RANK`, `HAND_RANK`, `HAND_TOP_SHARE`, `HAND_EQUITY_VS_RANDOM`, `COMBOS_OF_KIND` | `toolStartingHand`; lessons `starting-hand-ranking`, `starting-hands`; term `term-pocket-pair` |
| `blog-how-often-aa` | AA는 얼마나 자주 받을까? | ~221번에 한 번 (6/1326 조합) | `HAND_ONE_IN_N`, `COMBO_COUNT`, `HAND_COMBOS`, `HAND_SHARE` | `toolStartingHand`; lessons `hand-matrix`, `starting-hands`; term `term-combo` |
| `blog-is-ak-good` | AK는 좋은 패인가? | Reframed: states rank/top-share/equity/RFI positions for both, refuses a yes/no verdict | `HAND_RANK`, `HAND_TOP_SHARE`, `HAND_EQUITY_VS_RANDOM`, `RFI_POSITIONS_WITH` | `toolStartingHand`; lessons `starting-hand-ranking`, `position`; terms `term-suited`, `term-offsuit` |
| `blog-aks-vs-ako` | AKs와 AKo는 무슨 차이일까? | One letter → combos 4 vs 12, equity 67.04% vs 65.32%, same RFI positions | `HAND_COMBOS`, `HAND_SHARE`, `HAND_EQUITY_VS_RANDOM`, `HAND_RANK`, `RFI_POSITIONS_WITH` | `toolStartingHand`; lesson `starting-hands`; terms `term-suited`, `term-offsuit` |
| `blog-qq-vs-ak` | QQ와 AK 중 뭐가 강할까? | QQ beats AKs 53.95%, beats AKo 56.76% — stated separately, never blended | `CLASS_VS_CLASS_EQUITY` (`QQ\|AKs`, `QQ\|AKo`) | `toolEquity`; lessons `equity`, `starting-hand-ranking`; term `term-equity` |

Every `<Fact>`/`<Term>`/`<PokerCards>` call in all five files was run through the real `factValue`/
`handClassByKey`/glossary lookups by `i1.test.ts` — none reasoned about by hand. Verified concrete values
(for this report only, not typed into prose): `HAND_AT_RANK` 1-4 = AA, KK, QQ, JJ; `HAND_RANK`
AKs=8, AKo=12; `HAND_EQUITY_VS_RANDOM` AKs=67.04%, AKo=65.32%; `HAND_ONE_IN_N` AA=221; `CLASS_VS_CLASS_EQUITY`
QQ|AKs=53.95%, QQ|AKo=56.76%.

## 4. Strategy claims avoided

| id | The sentence that would have been a strategy claim | What was written instead |
| --- | --- | --- |
| `blog-next-best-after-aa` | "2위, 3위인 KK/QQ는 항상 레이즈해야 하는 패입니다" | `<Callout>` reusing the canonical distinction: "이 순위는 포지션별 전략이 아니라 시작 패 자체의 기본 강도를 비교한 것입니다... 항상 레이즈해야 한다거나 수익성이 있다는 뜻은 아닙니다." |
| `blog-how-often-aa` | "그러니 AA를 받으면 반드시 크게 베팅해야 합니다" | Stayed entirely inside combo-counting; no play advice appears at all — the article never crosses from "how often" into "what to do" |
| `blog-is-ak-good` (the batch's trap article) | "AK는 프리미엄 핸드이니 어디서든 레이즈해야 합니다" | Explicitly declined: "이 사이트에서는 AK를 '프리미엄 핸드'라고 부르지 않습니다... 지금 확인한 등수와 승률은 그런 판단을 내리기에 필요한 데이터가 아닙니다." Also declined "AKs와 AKo 중 어느 쪽을 더 써야 하는가" by name. |
| `blog-aks-vs-ako` | "조합도 적고 승률도 낮은 AKo는 버려야 합니다" | "이 글이 보여준 숫자만으로는 그 답이 나오지 않습니다... '버려야 한다/써야 한다'를 가르는 것은 이 순위표의 역할이 아닙니다." |
| `blog-qq-vs-ak` | "그러니 QQ로 AK 상대 올인을 받아야 합니다" | `<Callout>` + explicit refusal: "'그래서 이 상황에서 올인을 해야 하는가'는 이 글이 답하는 질문이 아닙니다. 그 판단에는... 이 계산에는 들어 있지 않은 정보가 더 필요합니다." |

`i1.test.ts` additionally asserts programmatically, across all five files: no `GTO`, no
`수익성 있`/`이득입니다`/`플러스 EV`, and no `(항상|무조건|반드시) ... 해야 합니다` pattern.

## 5. Anti-duplication check (vs. the lesson each article defers to)

| id | Defers to | What the lesson does that this article does NOT repeat |
| --- | --- | --- |
| `blog-next-best-after-aa` | `starting-hand-ranking` (04) | Lesson explains the EXACT all-in-vs-random methodology, provenance (`C(50,5)` boards × 1,225 opponents), rank-vs-top-share mechanics, and the AA/KK worked example in depth. Article states rank 2-4 as *read from the dataset* and stops at one sentence + link for "why". |
| `blog-how-often-aa` | `hand-matrix` (05), `starting-hands` (03) | Lesson 05 derives HOW combos are counted (13×13 grid, diagonal, off-diagonal cells). Article states the counted result (6 combos, 1/221) and explicitly defers the counting method ("이 조합을 세는 방법 자체는... 레슨에서 자세히 다룹니다"). |
| `blog-is-ak-good` | `starting-hand-ranking` (04), `position` (07) | Lesson 04 owns the methodology; lesson 07 owns why position changes what's playable. Article uses only the STRATEGY_DISTINCTION_SENTENCE (verbatim reuse from `features/strength/copy.ts`) and the hand-page's own disclaimer wording (verbatim reuse, ruling 38) rather than re-deriving either. |
| `blog-aks-vs-ako` | `starting-hands` (03) | Lesson 03 owns s/o notation itself (already uses this exact AKs/AKo pair as its own worked example, with `RFI_POSITIONS_WITH`/`HAND_COMBOS`/`HAND_SHARE`). Article does not re-explain what s/o mean (relies on `<PokerCards>`'s own auto-rendered reading/description + one-clause `<Term>` gloss) and instead leads with the two numbers lesson 03 does NOT state: `HAND_EQUITY_VS_RANDOM` and `HAND_RANK` for the pair. |
| `blog-qq-vs-ak` | `equity` (13), `starting-hand-ranking` (04) | Lesson 13 (not yet read by this agent, out of file boundary) owns what equity fundamentally is; article uses one `<Term id="term-equity">` gloss and moves straight to the two frozen numbers, never defining equity from scratch. |

## 6. Facts wanted and not available

None. All facts needed by §2.2/I1's source column existed in `facts.ts` as shipped by WP-G3b, including
`CLASS_VS_CLASS_EQUITY` for the ruling-24 correction. No `EXACT_EQUITY` fallback was needed for
`blog-qq-vs-ak` — verified by `i1.test.ts`'s explicit assertion that the file contains no
`<Fact name="EXACT_EQUITY">` call.

## 7. Tests run (real counts)

| Command | Result |
| --- | --- |
| `pnpm vitest run --project fishtilt src/content/registry/blog/i1.test.ts` | **22/22 passed** (this batch's own gate) |
| `pnpm vitest run --project fishtilt src/content/content.test.ts` | **37/37 passed** (shared graph/threshold suite) |
| `pnpm vitest run --project fishtilt` (whole app) | **872/872 passed, 81 files** (baseline handed to me was 850/850; +22 are this batch's new tests; zero failures elsewhere) |
| `pnpm --filter @gto-self/fishtilt typecheck` | PASS |
| `pnpm typecheck` (all 13 workspace projects) | PASS, no errors |
| `npx eslint apps/fishtilt --max-warnings=0` | PASS, no output |

`pnpm build:fishtilt` / `pnpm e2e:fishtilt` were **not** run — orchestrator holds that gate.

## 8. Known limitations

- `HAND_ONE_IN_N` is rounded (`Math.round`); `blog-how-often-aa` states it as "약 221번에 한 번" per
  `facts.ts`'s own documented convention, never as an exact unqualified count.
- `blog-qq-vs-ak` explicitly tells the reader that only `QQ vs AKs`/`QQ vs AKo` are frozen and any other
  pair is out of scope today (points to `toolEquity` for hand-vs-hand exact figures instead) — this is a
  real product limitation, not an authoring gap, and is now stated in the article itself rather than only
  in `facts.ts`'s doc comments.
- Per Ruling 26, `i1.test.ts`'s `OWNED_SLUGS` fixture is a literal, permanent list from the content plan,
  not derived from live registry state — correct per the ruling, but it means the test would not catch a
  future accidental sixth slug being added to this batch's files; `content.test.ts`'s global checks would.
- All five lessons this batch's `nextLessons` point at (`starting-hand-ranking`, `starting-hands`,
  `hand-matrix`, `position`, `equity`) are now `PUBLISHED` (confirmed via `routes.ts`/registry, per the
  coordinator's note that all 15 lessons shipped since this task started) — no dangling `PLANNED` targets.
