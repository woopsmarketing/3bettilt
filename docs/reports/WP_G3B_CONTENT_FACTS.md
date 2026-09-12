# WP-G3b — The Content Facts Layer

## 1. Scope

Extended `apps/fishtilt/src/content/facts.ts` — the one module MDX prose is allowed to pull a
number from — with the 11 fact names `docs/FISHTILT_CONTENT_PLAN.md` §2.4 lists as blocking
15 blog articles and 5 lessons, now that `learn-core`'s domain API (`docs/reports/
WP_G3_DOMAIN_FACTS.md`) ships `CATEGORY_FREQUENCIES` and the frozen class-vs-class dataset.
Added the module's first test file. No other file touched.

## 2. Files changed

| File | What |
| --- | --- |
| `apps/fishtilt/src/content/facts.ts` | +11 fact names, their arg-parsing helpers, and an extended header doc comment |
| `apps/fishtilt/src/content/facts.test.ts` | NEW — 77 tests, this module's first |
| `docs/reports/WP_G3B_CONTENT_FACTS.md` | this report |

Nothing in `src/components/**`, `src/content/registry/**`, `src/content/lessons.ts`,
`src/content/graph.ts`, `src/content/allowList.ts`, `src/content/content.test.ts`, `src/app/**`
or `src/features/**` was touched.

## 3. Fact table

| Fact | Arg shape | Source call | Example |
| --- | --- | --- | --- |
| `HAND_RANK` | `<handKey>` | `handStrengthOf(requireHandClass(...)).rank` | `factValue('HAND_RANK','AA')` → `"1"` |
| `HAND_AT_RANK` | `<rank 1-169>` | `HAND_STRENGTH_BY_RANK[rank-1].key` | `factValue('HAND_AT_RANK','1')` → `"AA"` |
| `HAND_EQUITY_VS_RANDOM` | `<handKey>` | `handStrengthOf(...).equity` | `factValue('HAND_EQUITY_VS_RANDOM','AA')` → `"85.20%"` |
| `HAND_TOP_SHARE` | `<handKey>` | `handStrengthOf(...).cumulativeShare` | `factValue('HAND_TOP_SHARE','AA')` → `"0.45%"` |
| `HAND_ONE_IN_N` | `<handKey>` | `Math.round(COMBO_COUNT / comboCount)` | `factValue('HAND_ONE_IN_N','AA')` → `"221"` |
| `CATEGORY_RANK` | `<HandCategory>` | `categoryFrequencyOf(...).rank` | `factValue('CATEGORY_RANK','STRAIGHT_FLUSH')` → `"1"`; `'HIGH_CARD'` → `"9"` |
| `CATEGORY_FREQUENCY` | `<HandCategory>` | `categoryFrequencyOf(...).count` | `factValue('CATEGORY_FREQUENCY','FLUSH')` → `"5,108"`; `'STRAIGHT'` → `"10,200"` |
| `CLASS_VS_CLASS_EQUITY` | `<classAKey>\|<classBKey>` | `classVsClassMatchupFor(a, b).equity` | `factValue('CLASS_VS_CLASS_EQUITY','QQ\|AKs')` → `"53.95%"`; `'QQ\|AKo'` → `"56.76%"` |
| `EXACT_EQUITY` | `<hero 2 cards>\|<villain 2 cards>\|<board?>` | `exactHeadsUpEquity(hero, villain, board).equity` | `factValue('EXACT_EQUITY','AsKs\|AhKh')` → `"50.00%"` (four fixed cards; not a class average) |
| `OUTS_PROB` | `<outs>\|FLOP\|TURN\|<NEXT\|RIVER\|SHORTCUT_NEXT\|SHORTCUT_RIVER>` | `outsOdds({outs, street})`, picks one of 4 fields | `factValue('OUTS_PROB','9\|FLOP\|RIVER')` → `"34.97%"`; `'9\|FLOP\|SHORTCUT_RIVER'` → `"36.00%"` |
| `POT_ODDS_REQUIRED_EQUITY` | `<pot BB>\|<bet BB>` | `potOdds({...}).requiredEquity`, assumes call === bet | `factValue('POT_ODDS_REQUIRED_EQUITY','3\|2')` → `"28.57%"` |

Every example above was captured from an actual `factValue(...)` call during verification
(a throwaway script run via `npx tsx`, deleted afterward — not typed by hand), so all are
safe to cite as-is. `HAND_ONE_IN_N`, `HAND_EQUITY_VS_RANDOM` and `HAND_TOP_SHARE` for hands
other than `AA` will differ; the test suite (§6) asserts every one of them against
`handStrengthOf(...)` called directly, so a different hand's number can be trusted the same
way without re-deriving it by hand.

All nine pre-existing facts (`COMBO_COUNT`, `HAND_CLASS_COUNT`, `CLASSES_OF_KIND`,
`COMBOS_OF_KIND`, `HAND_COMBOS`, `HAND_SHARE`, `RFI_COMBOS`, `RFI_PERCENT`,
`RFI_POSITIONS_WITH`) are unchanged.

## 4. Rounding decision

**Every new percentage fact renders `(fraction * 100).toFixed(2)` + `'%'` — two decimal
places.** Chosen to match the existing `HAND_SHARE` fact's own convention, and because several
of the new datasets place values close enough together (e.g. class-vs-class equities in the
53–57% band) that one decimal would silently collapse a real difference. `HAND_ONE_IN_N` is a
count, not a percentage: `Math.round(COMBO_COUNT / comboCount)`, documented as an approximation
(`1326 / 12 = 110.5` for a 12-combo class does not divide evenly) — prose citing it should
write "약 N번에 한 번", never an unqualified exact count.

## 5. Throw-behavior table

| Condition | Facts affected | Throws |
| --- | --- | --- |
| Unknown fact name | all | `unknown fact: ...` |
| Missing arg | all except `COMBO_COUNT`/`HAND_CLASS_COUNT` | `needs an arg` |
| Not one of the 169 hand classes | `HAND_RANK`, `HAND_EQUITY_VS_RANDOM`, `HAND_TOP_SHARE`, `HAND_ONE_IN_N`, `CLASS_VS_CLASS_EQUITY` (either side) | `...must be one of the 169 hand classes...` |
| Rank outside 1..169 / non-integer | `HAND_AT_RANK` | `...must be an integer 1..169...` |
| Not one of the 9 categories | `CATEGORY_RANK`, `CATEGORY_FREQUENCY` | `...must be one of the 9 hand categories...` |
| Matchup not in the frozen dataset | `CLASS_VS_CLASS_EQUITY` | `...is not one of the frozen matchups` (never computes live) |
| Wrong `\|`-part count | `CLASS_VS_CLASS_EQUITY`, `EXACT_EQUITY`, `OUTS_PROB`, `POT_ODDS_REQUIRED_EQUITY` | `needs N (or N-M) '\|'-separated parts...` |
| Unparseable / wrong-count cards | `EXACT_EQUITY` | `could not parse "..." as cards: ...` or `needs N or M cards...` |
| Duplicate card across hero/villain/board | `EXACT_EQUITY` | `...is not a legal deal (DUPLICATE_CARD)` |
| Invalid board length | `EXACT_EQUITY` | `...(INVALID_BOARD_LENGTH)` |
| Non-integer / negative outs, outs > unseen | `OUTS_PROB` | `non-negative integer...` / `...(OUTS_EXCEED_UNSEEN)` |
| Street not FLOP/TURN | `OUTS_PROB` | `street must be FLOP or TURN...` |
| Target not NEXT/RIVER/SHORTCUT_NEXT/SHORTCUT_RIVER | `OUTS_PROB` | `target must be one of NEXT\|RIVER\|...` |
| Unparseable BB amount (empty, bad decimals, >3 decimal places) | `POT_ODDS_REQUIRED_EQUITY` | `could not parse "..." as a BB amount: ...` |
| Negative pot/bet, zero bet | `POT_ODDS_REQUIRED_EQUITY` | `...(NEGATIVE_POT)` / `...(NEGATIVE_BET)` / `...(NON_POSITIVE_CALL)` |

## 6. Tests run

| Command | Result |
| --- | --- |
| `pnpm vitest run --project fishtilt facts.test.ts` | **77 / 77 passed** (this module's first test file) |
| `pnpm vitest run --project fishtilt` (whole app) | **580 / 583 passed, 3 failed** — the 3 failures are in `src/lib/routes.test.ts`, `src/content/graph.test.ts`, `src/components/Term.test.tsx`, none of which this WP touched or owns; they are the concurrent content-restructuring agent's in-flight `/blog`/`/glossary`/`/hands`/`/about` work (confirmed via `git status --porcelain`: all three files are untracked, not modified by me). Prior baseline was 465 tests; 583 is consistent with two agents adding tests concurrently. |
| `pnpm --filter @gto-self/fishtilt typecheck` | PASS, no errors |
| `pnpm typecheck` (all 13 workspace packages) | PASS, no errors |
| `npx eslint apps/fishtilt/src/content/facts.ts apps/fishtilt/src/content/facts.test.ts --max-warnings=0` | PASS, no output |
| `npx eslint apps/fishtilt --max-warnings=0` (whole app) | PASS, no output |

## 7. Known limitations

- `CLASS_VS_CLASS_EQUITY` resolves only `QQ vs AKs` and `QQ vs AKo` (plus their mirrored key
  order) — the only two matchups `docs/FISHTILT_CONTENT_PLAN.md` cites and the only two the
  domain generator froze. Any other pair, however plausible-sounding ("AA vs KK"), throws
  `UNKNOWN_MATCHUP` by design; it must never be made to compute live (~85ms/pairing, ~8s for a
  matchup this size — `docs/reports/WP_G3_DOMAIN_FACTS.md` §7).
- `POT_ODDS_REQUIRED_EQUITY` always assumes hero calls the FULL bet (`callAmountMbb ===
  villainBetMbb`). It cannot price a short-stack call for less than the bet — the content
  plan's own arg shape (`docs/FISHTILT_CONTENT_PLAN.md` §2.4) only names pot and bet, no
  separate call amount. If a future article needs that case, the fact needs a third,
  optional `\|`-part and a documented default.
- `OUTS_PROB`'s `SHORTCUT_NEXT`/`SHORTCUT_RIVER` targets were added beyond the literal 11-name
  list in the assignment, specifically to serve blog #20's stated need to cite the "rule of 2
  and 4" shortcut next to the exact figure (`docs/FISHTILT_CONTENT_PLAN.md` row 20:
  "2·4 법칙의 오차 → 같은 결과의 ruleOfTwoAndFour"). No new top-level `Fact` name was created —
  these are two more values of `OUTS_PROB`'s existing third arg.
- `docs/FISHTILT_CONTENT_PLAN.md` §2.4/§4 predates `learn-core`'s `classVsClassMatchupFor`
  landing and explicitly tells blog #5's author to avoid a class-vs-class fact and fix four
  concrete cards instead ("클래스 대 클래스 평균값은 이 저장소에 없다"). That premise is now
  false — `CLASS_VS_CLASS_EQUITY` exists — per the orchestrator's own instruction for this WP.
  Flagging the plan document as stale on this one point; not changed here (out of file
  boundary).
- No fact in this file states a recommendation, a frequency of PLAY, or anything from audit
  category C. `HAND_EQUITY_VS_RANDOM` is phrased in code and comments strictly as "all-in
  equity against a uniformly random legal opponent hand" — never as how well a hand plays.

## 8. For content authors (copy-paste into author prompts)

**How to cite a number:** never type a figure. Use `<Fact name="..." arg="..." />`.

**Single-value facts** (unchanged, pass one plain string): `COMBO_COUNT`, `HAND_CLASS_COUNT`
(no arg), `CLASSES_OF_KIND`/`COMBOS_OF_KIND` (`PAIR`|`SUITED`|`OFFSUIT`), `HAND_COMBOS`/
`HAND_SHARE`/`HAND_RANK`/`HAND_EQUITY_VS_RANDOM`/`HAND_TOP_SHARE`/`HAND_ONE_IN_N`/
`RFI_POSITIONS_WITH` (a hand key like `AA`, `AKs`, `72o`), `RFI_COMBOS`/`RFI_PERCENT` (a
position like `BTN`), `HAND_AT_RANK` (an integer `1`–`169` as a string), `CATEGORY_RANK`/
`CATEGORY_FREQUENCY` (one of `HIGH_CARD PAIR TWO_PAIR TRIPS STRAIGHT FLUSH FULL_HOUSE QUADS
STRAIGHT_FLUSH`).

**Multi-value facts** pack every value into ONE string, parts separated by `|` (the `Fact`
component only takes a single `arg` string):

| Fact | `arg` format | Example |
| --- | --- | --- |
| `CLASS_VS_CLASS_EQUITY` | `classAKey\|classBKey` | `arg="QQ\|AKs"` |
| `EXACT_EQUITY` | `hero2cards\|villain2cards\|board?` | `arg="AsKs\|AhKh"` (preflop) or `arg="QsQh\|AsKh\|2h7d9c"` (with a board) |
| `OUTS_PROB` | `outs\|FLOP\|TURN\|target` | `arg="9\|FLOP\|RIVER"`; target is `NEXT`, `RIVER`, `SHORTCUT_NEXT` or `SHORTCUT_RIVER` |
| `POT_ODDS_REQUIRED_EQUITY` | `potBB\|betBB` | `arg="3\|2"` — assumes hero calls the full bet |

Card notation is the standard two-character form (`As`, `Td`, `7c`) and may be space- or
comma-separated within a `|`-part (`"As Ks"`, `"As,Ks"`, `"AsKs"` all work).

**Hard limits:**
- `CLASS_VS_CLASS_EQUITY` answers ONLY `QQ` vs `AKs` and `QQ` vs `AKo` (either key order). Any
  other pair throws at build time — do not try "AA vs KK" or anything else. If your article
  needs a different matchup, use `EXACT_EQUITY` with four concrete cards instead, and say in
  the sentence that it is those specific four cards, not a class average (per
  `docs/FISHTILT_CONTENT_PLAN.md`'s Article #5 special rule).
- `HAND_EQUITY_VS_RANDOM` is a hand's all-in equity against a random hand. It is NOT
  playability, NOT a recommendation, and must not be phrased as "how good this hand is to
  play" — only as "if the money went in right now against a random hand".
- `HAND_ONE_IN_N` is rounded (`약 N번에 한 번` in the sentence, never an exact "N번에 한 번" —
  most combo counts don't divide 1326 evenly).
- Every percentage prints to exactly two decimal places (`"53.95%"`, not `"54%"` or
  `"53.9515%"`). Do not reformat a Fact's output string.
- If a `<Fact />` throws during a build, that is the system working as intended — fix the
  `name`/`arg`, do not work around it by typing the number by hand.
