# FishTilt WP-R — the starting-hand strength dataset

The number behind the **상위 X%** slider, where it comes from, and the one thing it must not
be mistaken for.

Dataset generated **2026-09-04** (`generatedAt: 2026-09-04T15:54:19.629Z`), generator
`2.0.0`, file `packages/learn-core/src/strength/dataset.generated.ts`.
Read with `docs/reports/POKER_EDUCATIONAL_DATA_AUDIT.md` §4 (which chose the methodology)
and `docs/reports/FISHTILT_00_AUDIT_AND_PLAN.md` §5.3.

---

## 요약 (한국어)

- 169개 스타팅핸드의 순위를 **"올인 프리플랍에서 무작위 핸드 상대 승률"** 하나만으로 매겼다.
  누가 정한 의견이 아니라 **카드의 성질**이라서, 누구든 다시 계산하면 같은 값이 나온다.
- **추정치가 아니라 완전한 계산이다.** 각 핸드마다 2,118,760개의 보드 전부를 1225개의 상대
  핸드 전부와 맞붙였다. 총 **354,489,735,600번의 쇼다운**. 표본추출은 어디에도 없다.
- 따라서 오차범위도, 동률 구간(tie band)도 없다. 두 핸드가 같다는 것은 값이 **비트 단위로
  동일**하다는 뜻이고, 그런 쌍은 이 데이터셋에 **하나도 없다** (`exactTies: []`).
  169개는 완전한 순서를 이룬다.
- **수트 대칭성 검증 통과.** 같은 클래스를 다른 콤보로 한 번 더 완전 계산했을 때 **17개 전부가
  비트 단위로 완전히 일치**했다 (최대 차이 **정확히 0**, 허용오차 이내가 아니라 0이다).
  이것이 1326개가 아니라 169개만 계산해도 되는 근거를 직접 검증한 것이다.
- **가장 중요한 주의사항은 그대로 남는다:** 이 순위는 _플레이하기 좋은 핸드_ 순위가 **아니다.**
  76s가 A2o보다, 65s가 J2o보다도 아래에 있는 이유가 그것이다. §7을 반드시 읽을 것.

---

## 1. What was measured

For each of the 169 starting-hand classes:

> Hero holds the class. Both players are all-in **before the flop**. The opponent holds a
> hand drawn **uniformly from every legal two-card holding** that does not use one of hero's
> cards. The board runs out. `equity` is hero's expected share of the pot, ties split.

That is a property of the cards. It needs no source, no licence and no citation, because
two people who agree on the rules of hold'em and start from an empty page arrive at the same
value — which is why `POKER_EDUCATIONAL_DATA_AUDIT.md` §4 chose it over adopting a published
ranking (someone else's judgement, not reproducible) and over a composite heuristic
(category C, which FishTilt does not display at all).

Nothing was authored. Nothing was copied. The word **GTO** does not appear anywhere near it.

## 2. It is EXACT, and that reverses the audit's original call

|                              |                                                        |
| ---------------------------- | ------------------------------------------------------ |
| boards per class             | **2,118,760** — `C(50, 5)`, every one of them          |
| opponent hands per class     | **1225** — `C(50, 2)`, every one of them               |
| showdowns scored per class   | **2,097,572,400** (the pairs that do not share a card) |
| showdowns behind the dataset | **354,489,735,600**                                    |
| sampled                      | **nothing, anywhere**                                  |

The first version of this dataset shipped as a `SUBSAMPLED` estimate, on the audit's premise
that "fully exact evaluation is out of reach". That premise was measured afterwards and found
to be false: the orchestrator timed one class, single-threaded, at **74.691 s**. Running all
169 through the generator's worker pool then took **2,452.8 s of wall clock — 40.9 minutes**.

CLAUDE.md rule 9 allows a settled decision to be reopened exactly when the falsifying evidence
an ADR names actually appears, and this is that case. The orchestrator reopened it and owns
the audit document; this package implements the reversal and does not re-argue it.

What that buys, concretely:

- `method` is the literal type `'EXACT'`. There is no sample count to display and no 추정
  label to attach. `trialCount` is `354_489_735_600` — the showdowns actually scored, not a
  budget that was asked for.
- There is **no error bar**, so there is nothing for a tie band to express. All of it is
  gone: `TIE_BAND_SIGMA_MULTIPLIER`, `assignTieBands`, `HandStrengthAccuracy`, the
  band-derivation test, and the straddling-band handling in the cut.
- Two classes are equal only when their equities are **bit-identical**. Every other pair is
  genuinely ordered, and the ordering is a fact rather than a 95% claim.
- The two-budget rank-stability gate is gone too. Re-running an exact computation at a
  different budget proves nothing; §4 replaces it with the check that is now meaningful.

### There are no exact ties, and that matters for the product

`exactTies` is `[]`. All **168 adjacent gaps in the ranking are strictly positive**, the
smallest being **6.0639e-6** between `72s` (#152, `0.3815589347476159`) and `54o` (#153,
`0.3815528708329686`). So the 169 classes form a **strict total order**.

`topHandsByShare` still carries a guard that refuses to split a bit-identical pair — two
classes with equal equity have equal claim to be included, and choosing between them would
invent an order the data does not contain. **On this dataset that guard never fires**, and
`ranking.test.ts` pins that by asserting `HAND_STRENGTH.exactTies` is empty. The guard stays
because it is a property of the API rather than of the current numbers: it is what keeps a
future regeneration honest if two classes ever do land on the same value.

## 3. Why 169 measurements and not 1326

Poker has no suit order, so relabelling the four suits by any permutation `σ` leaves every
hand ranking unchanged. `σ` is a bijection on the 52 cards, hence on the 1326 combos and on
the 5-card boards. Apply it to hero, the opponent and the runout at once and the showdown
result is identical.

Take two combos of one class — `A♠K♠` and `A♦K♦`. Some `σ` maps one onto the other. The
opponent's distribution is uniform over every legal hand and the board is uniform over the
rest of the deck, and **both are invariant under `σ`**. So the whole experiment for one combo
is the image under `σ` of the experiment for the other, and the two true equities are equal.
Measuring all 4 / 6 / 12 combos of a class would be measuring the same number several times.

With a sampled dataset that argument had to be taken on trust, because two sampled
measurements of the same class differ by sampling error whether the argument holds or not.
With an exact one it is directly testable, which is what §4 does.

## 4. The suit-symmetry check — what replaced the stability gate

**17** classes, at evenly spaced ranks (1, 12, 22, 33, 43, 54, 64, 75, 85, 96, 106, 117, 127,
138, 148, 159, 169) so the check covers the whole strength range, were enumerated
**exhaustively a second time from a different combo of the same class** — `HIGHEST_COMBO`
instead of the `LOWEST_COMBO` the dataset was built from. Different physical cards, a
different deck ordering, the same 2,097,572,400 showdowns.

| class | from `LOWEST_COMBO` | from `HIGHEST_COMBO` | \|diff\| |
| ----- | ------------------- | -------------------- | -------- |
| `AA`  | 0.8520371330210104  | 0.8520371330210104   | **0**    |
| `AKo` | 0.6532007178870203  | 0.6532007178870203   | **0**    |
| `KTs` | 0.6178855816848086  | 0.6178855816848086   | **0**    |
| `KTo` | 0.5973891513828080  | 0.5973891513828080   | **0**    |
| `Q9s` | 0.5766432171781055  | 0.5766432171781055   | **0**    |
| `K5s` | 0.5579291763659743  | 0.5579291763659743   | **0**    |
| `T9s` | 0.5402752865646020  | 0.5402752865646020   | **0**    |
| `J7s` | 0.5232478118514526  | 0.5232478118514526   | **0**    |
| `J6s` | 0.5060590714294295  | 0.5060590714294295   | **0**    |
| `T6s` | 0.4894067568299431  | 0.4894067568299431   | **0**    |
| `T5s` | 0.4721625897156160  | 0.4721625897156160   | **0**    |
| `87o` | 0.4505081226278531  | 0.4505081226278531   | **0**    |
| `86o` | 0.4324090186350659  | 0.4324090186350659   | **0**    |
| `64s` | 0.4133331903108565  | 0.4133331903108565   | **0**    |
| `84o` | 0.3944679146712647  | 0.3944679146712647   | **0**    |
| `82o` | 0.3682767410078432  | 0.3682767410078432   | **0**    |
| `32o` | 0.3230322812695285  | 0.3230322812695285   | **0**    |

> **`identicalCount: 17` of 17. `maxAbsoluteDifference: 0`.**

Read that literally. It is not "within tolerance" — it is **exactly zero**, on every one of
the 17 checks. What that licenses is the thing the whole dataset rests on: **a class's equity
does not depend on which suit-symmetric representative combo was measured**, so computing 169
representatives instead of all 1326 combos is not an approximation, it is an identity.

### Why zero, and not merely small

This is forced by how the equity is accumulated, not luck, and the mechanism was checked
rather than assumed:

- A uniform range in `strategy-core` stores per-combo weights in a `Uint16Array` of basis
  points. For the opponent range used here every live combo carries exactly one value,
  `BPS_FULL = 10000` — verified: the uniform range has exactly one distinct weight.
- Heads-up, the per-assignment weight is that single value, so `winWeight`, `loseWeight` and
  `scoredWeight` accumulate integer multiples of 10000, and the heads-up tie term adds
  `10000 / 2 = 5000`. Every accumulator is an integer.
- The largest of them in the shipped run is `scoredWeight = 10000 × 2,097,572,400 =
20,975,724,000,000`, which is **429× below `2^53 = 9,007,199,254,740,992`**. Every partial
  sum is therefore exactly representable, so float addition of them is exact and
  **order-independent**.
- The two runs consequently produce the _same integer_ numerator and denominator, and
  `equity` is a single correctly-rounded division of the same two operands. Bit-identity is
  the only possible outcome.

`HAND_STRENGTH_SYMMETRY_TOLERANCE = 1e-9` remains in source as the generator's failure gate —
it refuses to write the file if the check exceeds it — but on this path it is slack that
provably cannot be consumed. For scale, the tolerance is **6,064× smaller** than the smallest
real gap between two classes (6.0639e-6), so it could never mask a genuine ordering error
either. The dataset records `identicalCount` alongside `maxAbsoluteDifference` precisely so a
reader sees the actual result rather than "passed".

Anything above the tolerance would mean the symmetry argument, or its implementation, is
wrong — a stop-and-report condition, not a tolerance to widen.

## 5. What ships, and what reads it

### Files

| path                                                                  | what                                                                  |
| --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `packages/learn-core/scripts/generate-hand-strength.ts`               | the offline generator (main / symmetry / cheap passes, worker pool)   |
| `packages/learn-core/src/strength/measure.ts`                         | ONE measurement — the whole methodology, exported so it can be re-run |
| `packages/learn-core/src/strength/model.ts`                           | the types and the symmetry tolerance                                  |
| `packages/learn-core/src/strength/dataset.generated.ts`               | **the frozen dataset**                                                |
| `packages/learn-core/src/strength/ranking.ts`                         | the lookup and "top X%" API                                           |
| `packages/learn-core/src/strength/measure.test.ts`, `ranking.test.ts` | the fast tests                                                        |

```
pnpm --filter @gto-self/learn-core generate:strength             # the shipped, EXACT run
pnpm --filter @gto-self/learn-core generate:strength --sampled   # a fast preview
```

Same source, same output, byte for byte, apart from `generatedAt`. The preview exists so the
pipeline can be exercised in seconds; it **refuses to write the file**, because
`method: 'EXACT'` must never sit on top of sampled numbers. So does a run whose symmetry
check fails.

The generated file holds **only what was measured** — `[key, equity]` rows in rank order,
plus the metadata and evidence. Rank is the row's position; the matrix index, the 6/4/12
combo counts and the cumulative shares are rebuilt by `ranking.ts` from `strategy-core` and
**cross-checked at import**, so a corrupt dataset throws on load rather than producing a
ranking with a hole in it.

### The API

```ts
handStrengthOf(handClass: HandClass): HandStrengthEntry            // total
handStrengthAt(index: HandClassIndex): HandStrengthEntry           // total
handStrengthForKey(key: string): Result<HandStrengthEntry, HandStrengthError>
handStrengthTied(a: HandStrengthEntry, b: HandStrengthEntry): boolean   // exact equality
topHandsByShare(share: number): Result<TopHandSelection, HandStrengthError>

HAND_STRENGTH: HandStrengthDataset            // method, trialCount, enumeration, symmetry
HAND_STRENGTH_BY_RANK: readonly HandStrengthEntry[]   // rank order, strongest first

measureHandStrength(handClass, { runoutSamples, representative? }): HandStrengthMeasurement
```

`HandStrengthEntry` carries `key`, `classIndex`, `equity`, `rank`, `comboCount`,
`cumulativeCombos` and `cumulativeShare`.

### "Top X%" cuts by hands dealt, not by labels

There are 169 labels but 1326 hands, and they are not the same size: `AA` is one label and 6
combos, `AKo` is one label and 12. The classes at the top of the ranking are mostly pairs and
suited hands — the **small** ones — so cutting the ranked list at `0.15 × 169 = 25` labels
yields 166 combos, only **12.52%** of the hands actually dealt, while calling itself 15%. The
cut is therefore taken over cumulative combos.

With no tie bands, the cut is simply the smallest prefix of the ranking whose share of the
1326 combos is at least the request, so it can overshoot by at most one class — a class is
atomic and `AKo` alone is 0.9% of the deal. `actualShare` reports what the caller actually
got, and a UI showing "상위 15%" must show that number rather than the request, otherwise the
label lies. `>=` was chosen over `<=` so the answer to "top 15%" always _contains_ 15% of
hands and never comes back empty for a small positive request; both rules nest, so dragging
the slider only ever adds hands.

| requested | classes | combos | actual share | weakest included |
| --------- | ------- | ------ | ------------ | ---------------- |
| 5%        | 12      | 72     | **5.43%**    | `AKo`            |
| 10%       | 21      | 134    | **10.11%**   | `A8s`            |
| 15%       | 31      | 200    | **15.08%**   | `A6s`            |
| 20%       | 40      | 276    | **20.81%**   | `K9o`            |
| 25%       | 48      | 334    | **25.19%**   | `44`             |
| 30%       | 56      | 398    | **30.02%**   | `Q9o`            |

The top 15% is 31 classes: `AA KK QQ JJ TT 99 88 AKs 77 AQs AJs AKo ATs AQo AJo KQs 66 A9s
ATo KJs A8s KTs KQo A7s A9o KJo 55 QJs K9s A5s A6s`.

## 6. The ranking

### Top 10

| rank | class | equity    | combos | cumulative share |
| ---- | ----- | --------- | ------ | ---------------- |
| 1    | `AA`  | 0.8520371 | 6      | 0.45%            |
| 2    | `KK`  | 0.8239568 | 6      | 0.90%            |
| 3    | `QQ`  | 0.7992516 | 6      | 1.36%            |
| 4    | `JJ`  | 0.7746947 | 6      | 1.81%            |
| 5    | `TT`  | 0.7501178 | 6      | 2.26%            |
| 6    | `99`  | 0.7205725 | 6      | 2.71%            |
| 7    | `88`  | 0.6916304 | 6      | 3.17%            |
| 8    | `AKs` | 0.6704463 | 4      | 3.47%            |
| 9    | `77`  | 0.6623602 | 6      | 3.92%            |
| 10   | `AQs` | 0.6620886 | 4      | 4.22%            |

### Bottom 10

| rank | class | equity    | combos | cumulative share |
| ---- | ----- | --------- | ------ | ---------------- |
| 160  | `73o` | 0.3660226 | 12     | 92.46%           |
| 161  | `53o` | 0.3626477 | 12     | 93.36%           |
| 162  | `63o` | 0.3607763 | 12     | 94.27%           |
| 163  | `32s` | 0.3598443 | 4      | 94.57%           |
| 164  | `43o` | 0.3514589 | 12     | 95.48%           |
| 165  | `72o` | 0.3458365 | 12     | 96.38%           |
| 166  | `52o` | 0.3428465 | 12     | 97.29%           |
| 167  | `62o` | 0.3407514 | 12     | 98.19%           |
| 168  | `42o` | 0.3319975 | 12     | 99.10%           |
| 169  | `32o` | 0.3230323 | 12     | 100.00%          |

`AA` at the top and `32o` at the bottom are the smoke signals the work plan named, and `AA`'s
value is a hard gate rather than a vibe: the orchestrator measured `0.8520371330210104`
independently before the dataset existed, and `ranking.test.ts` asserts the shipped value with
`toBe` — bit equality, not a tolerance. The familiar textbook "aces are about 85% against a
random hand" is this number.

Note that the weakest hand is `32o`, not `72o`. `72o` is the worst hand to _play_ — it cannot
make a straight and has no suit — but against a random hand `32o` wins less often, because
`7` high beats `3` high in the many pots that go to showdown unimproved. That gap between
"loses most often" and "worst to play" is §7 in miniature.

## 7. The caveat — read this before putting it on screen

**All-in preflop equity is not playability, and this ranking is not a list of the best hands
to play.** This is the one caveat that does not go away when the numbers become exact: it is
a limitation of the **metric**, not of the computation. An exact answer to the wrong question
is still the wrong question.

It answers exactly one narrow thing: _if all the money goes in right now and nobody folds,
what share do I get?_ A hand's real value also comes from how often it flops something worth
betting, how easily it gets away from a bad flop, how much it wins when it connects, and
whether the money goes in at all. None of that is in this number.

The clearest symptom is where suited connectors land:

| class | rank | equity |                                        |
| ----- | ---- | ------ | -------------------------------------- |
| `A2o` | 59   | 54.93% | an offsuit ace nobody is happy to open |
| `98s` | 83   | 50.80% |                                        |
| `22`  | 87   | 50.33% |                                        |
| `Q2o` | 105  | 47.30% | **outranks `76s`**                     |
| `76s` | 115  | 45.37% |                                        |
| `J2o` | 121  | 44.35% | **outranks `65s` and `54s`**           |
| `65s` | 128  | 43.13% |                                        |
| `54s` | 136  | 41.45% |                                        |

`A2o` beats a random hand far more often than `76s` does, because an ace plays a lot of
showdowns against random junk and simply wins them. That does not make `A2o` the better hand
to open, to call a 3-bet with, or to stack off with postflop, and no competent player would
treat this table as saying so. The same effect puts small pairs below hands nobody would
rather hold: a pair against a random hand is close to a coin flip in both directions, and its
real value is in what happens when it flops a set — not an all-in-preflop property.

**What the UI must do:** state the basis next to the slider — _올인 프리플랍 무작위 상대 승률
기준_ — and link here. It no longer needs a 추정 label or a sample count, because the number
is exact; it still needs the basis, because an exact number invites more trust than a
sampled one and that trust must land on the right claim. FishTilt never calls this GTO, never
calls it a recommendation, and never presents it as an opening range.

## 8. What the sampled dataset needed, and no longer does

An earlier version of this document described a different dataset. If you read it and
remember any of the following, you remembered correctly — it was true then and is not true
now:

| the sampled version said                                                                                                                                                                                            | now                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **100,000 sampled boards** per class, of the 2,118,760 available                                                                                                                                                    | all 2,118,760, every class                                                                                               |
| `method: 'SUBSAMPLED'`, with a `sampleCount` field                                                                                                                                                                  | `method: 'EXACT'`, with `trialCount: 354_489_735_600`                                                                    |
| a **measured standard error of 3.29e-4**, itself estimated from 17 exhaustively enumerated oracle classes, exposed as `HandStrengthAccuracy`                                                                        | **gone** — there is no error to measure, and the type no longer exists                                                   |
| a **tie band of 9.13e-4** that grouped the 169 classes into **123 bands**, plus a disclosed risk that the band was 10–15% too narrow because the per-class error was heavy-tailed                                   | **gone** — equality is bit-identity, and there are no ties at all (§2)                                                   |
| `TIE_BAND_SIGMA_MULTIPLIER`, `assignTieBands`, `bandStraddledCut`, the `tieBand` entry field, the band-derivation test                                                                                              | **all deleted**                                                                                                          |
| a **two-budget rank-stability gate**, weakened by the two samples being nested — `strategy-core`'s Weyl walk at size _k_ is a prefix of the same walk at any larger _k_, so the second budget was never independent | **gone** — replaced by the suit-symmetry equality in §4, which tests something the sampled dataset could not test at all |
| error that did not shrink monotonically with budget (`72o` was closer to the truth at 10,000 boards than at 100,000 — a normal quasi-random discrepancy artefact, but one that had to be disclosed)                 | **gone** — nothing is sampled                                                                                            |

The price of removing all of that was **2,452.8 seconds of wall clock, 40.9 minutes**, once.
That is the entire cost of the difference between an estimate with an error bar and a number.

The caveat in §7 is **not** on this list. It survives the move to exact, unchanged.

## 9. Verification

| check                                                                  | result                                                                                                                                               |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm vitest run --project learn-core`                                 | **PASS** — 7 files, 82 tests, 3.76 s                                                                                                                 |
| `pnpm --filter @gto-self/learn-core typecheck`                         | **PASS**                                                                                                                                             |
| `npx eslint packages/learn-core`                                       | **PASS**, 0 errors, 0 warnings                                                                                                                       |
| `npx prettier --check` on every added file                             | **PASS**                                                                                                                                             |
| `pnpm --filter @gto-self/fishtilt typecheck` (the downstream consumer) | **PASS**                                                                                                                                             |
| generator, end to end                                                  | main + spot pass 2,267 s (338 tasks), symmetry pass 185 s (17 tasks), **total 2,452.8 s** on 12 workers (`availableParallelism() − 2`, Apple M4 Pro) |

The suite is discriminating, not decorative: when the exhaustive dataset had not yet been
written, the same tests ran **3 failed / 79 passed** against a sampled preview — failing
exactly on the exhaustive-enumeration assertion, the `AA` bit-equality, and the symmetry
record. With the exact dataset in place they are 82/82.

The default suite stays fast because the expensive work is not in it. `pnpm test` asserts the
structural invariants, checks that the recorded enumeration really is exhaustive
(`boardsPerClass === boardSpaceSize` and `scoredTrialsPerClass === 2_118_760 × 990`, rather
than trusting the `EXACT` label), checks the committed symmetry evidence, pins `AA` to
`0.8520371330210104`, and then **re-runs the real measurement for three classes on the cheap
2,000-board path** and compares against values the generator committed for that same budget.
That last one is the link between the committed table and the code that produced it: a
hand-typed dataset would pass everything else and fail it.

The generator is not picked up by Vitest (`vitest.config.ts` includes only `src/**/*.test.ts`
and `tests/**/*.test.ts`) and _is_ type-checked (`scripts/**/*.ts` is in
`packages/learn-core/tsconfig.json`) — a script this load-bearing should not be exempt from
`strict`.

## 10. Known limitations

1. **The metric, not the computation.** §7. All-in preflop equity says nothing about
   playability, position, stack depth, or any opponent range narrower than "any two cards".
   Everything about how to _play_ a hand is outside this dataset by construction. This is the
   only limitation that affects what a learner should conclude.
2. **Suit symmetry is checked on 17 of the 169 classes, not all of them.** Checking every
   class would mean a second full enumeration pass for every one of them, spent on a
   proposition that is a theorem about the rules of the game rather than an empirical
   hypothesis; the 17 were spaced across the whole strength range instead. The check exists
   to catch an implementation mistake in the argument, not to establish the argument.
3. **The cheap sampled path is still sampled.** `measureHandStrength` with a small
   `runoutSamples` — what the fast test uses, and what `--sampled` previews — carries real
   error: at 2,000 boards the worst deviation from the exact value across all 169 classes was
   **0.013678902821185002** (`spotCheckMaxDeviation`, 1.37 equity points). Nothing shipped is
   built from it; it exists so the pipeline can be exercised in seconds, and so the fast test
   can re-run the real measurement without a 40-minute wait.
4. **`generatedAt` is the only thing that changes between runs.** A regeneration on any
   machine produces byte-identical rows — there is no RNG, no seed and no wall-clock budget
   anywhere in the path.
