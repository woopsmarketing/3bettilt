# GTO design notes — Phase 9 input

**Status: RECORDED, NOT IMPLEMENTED.** Nothing here is built yet. This file exists so the
Phase 9 agent inherits the constraints that were already reasoned about, instead of
rediscovering them halfway through a schema.

Scope: the `GTOProvider` / `SolutionSet` / `Spot` / `Strategy` / `NearestSolutionMatcher`
design in `packages/gto-core`. Companion documents:

- `docs/GTO_BASELINE.md` — the never-invent-numbers rule, mock policy, baseline identity.
- `docs/ARCHITECTURE.md` — the matching-priority list these notes constrain.
- `docs/DECISIONS.md` — **ADR-0016** already adopted seven schema inputs from the
  open-source evaluation. Notes D and E below _refine_ two of them; they do not reverse them.

---

## A. A scalar effective stack is not enough for 6-max preflop

A single `effectiveStack` number describes a two-player relationship. Preflop 6-max is not a
two-player relationship: an UTG open faces five different stack relationships at once, and the
correct strategy depends on the whole distribution behind, not on one scalar.

**Constraint.** A spot carries a **per-position stack profile**, and it carries it twice —
**actual** and **normalized** — per `CLAUDE.md` rule 3 and the actual-vs-model rule in
`docs/ARCHITECTURE.md`. Collapsing six stacks to one number before storage destroys input the
user actually entered.

A **pairwise effective stack is sufficient only where the solution's coverage is heads-up.**
That is a property of the dataset's coverage segment (ADR-0019, ADR-0028), so the matcher can
check it from the identifier rather than guessing. Using a pairwise reduction against a
6-max-coverage dataset is a bug, not an approximation.

## B. Postflop sizing normalization needs two formulas, not one

`amount / potBefore` is the right formula for a **first bet** and the wrong formula for a
**raise**. Applied to a raise it silently produces a number that means nothing — it mixes the
raiser's total with a pot that already contains the bet being raised.

**Constraint.** Define, separately and by name:

```
first bet:   bet             / potBefore
raise:       raiseIncrement  / potAfterCall
```

where `raiseIncrement` is the amount above the bet being raised, and `potAfterCall` is the pot
as it would stand if the raiser had merely called. One formula for both cases is a defect even
when it happens to produce a plausible-looking fraction.

`poker-core` already supplies the raw inputs on `ActionRecord` (`potBefore`,
`currentBetBefore`, `amount`, `toAmount`, `effectiveStackBefore`) and deliberately defines no
sizing convention — see `docs/POKER_CORE_API.md` §7. The convention is `gto-core`'s to pick,
and this note fixes it.

## C. The nearest matcher must be allowed to say "no"

A nearest-neighbour lookup always returns something. That is the hazard: a 12 BB spot matched
against a 100 BB-only dataset has a mathematically nearest candidate, and returning it silently
presents a wrong answer with full confidence.

**Constraint.** Every match result is one of three typed outcomes:

```
EXACT | APPROXIMATE | UNSUPPORTED
```

- Nearest numeric matching (stack bucket, bet sizing) carries an **explicit maximum tolerance**
  per dimension. Outside the tolerance the result is `UNSUPPORTED`, never a distant
  `APPROXIMATE`.
- `APPROXIMATE` must report _what_ was approximated and by how much, so the UI can show the
  actual-vs-model pair the architecture already requires.
- Never map an arbitrarily distant stack or sizing merely because one candidate is
  mathematically nearest. "Nearest" is not "close".

This is what makes the UI able to say _"no solution covers this lineup"_ — the outcome
ADR-0019 and ADR-0028 exist to make detectable.

## D. Unreached strategies are a different type, not a flagged one

_Refines ADR-0016 item 6, which required unreached to be typed rather than inferred._

ADR-0016 recorded the evidence: 4.9% of one shipped open-source blueprint's rows (1,540 of
31,434) are a uniform `1/n` fallback emitted for infosets the solve never reached, and in the
serialized asset those are byte-indistinguishable from a genuine mixed strategy. A boolean
`unreached` flag sitting next to a plausible frequency does not fix that — it leaves a
renderable number in the row, and every consumer must remember to check the flag first.

**Constraint.** Use a **discriminated union**, not a boolean plus a frequency:

- An `UNREACHED` entry **must not contain a renderable strategy frequency at all.** The
  information is structurally absent, so a consumer cannot render it by forgetting a check.
- A `REACHED` entry carries frequencies, and its **action frequencies are validated to sum to
  10000** (integer ten-thousandths, ADR-0016 item 4).

## E. Solution quality is a named metric kind, not a hard-coded exploitability column

_Refines the ADR-0016 `quality_kind` / `exploitability_mbb_per_100` refinement, on a second
axis._

ADR-0016 already prevents storing a fabricated quality number (`MEASURED` | `UNMEASURED`, with
the value required only when measured). That axis is _whether_ it was measured. This note adds
_what was measured_: exploitability is one metric among several, and hard-coding the schema to
it means the first alternative measurement forces a migration.

**Constraint.** The quality metric's **kind is extensible** — e.g. `EXPLOITABILITY`,
`NASH_CONV` — with its unit recorded alongside the value. Do not permanently bind the schema to
exploitability. This does not license storing an unmeasured number: ADR-0016's rule stands.

## F. Name the poker → GTO adapter seam

`gto-core` must not re-derive poker rules. If it computes positions, pot sizes, call amounts or
action legality itself, there are two poker engines in the repo and they will disagree — and the
one inside `gto-core` will be the wrong one, because `poker-core` is the authority
(`CLAUDE.md` rule 4).

**Constraint.** There is exactly one documented seam where poker state becomes a GTO query.
`HandView` / `ActionRecord` (poker-core's read models) are converted into a **neutral
`GtoQuery` DTO** at that seam, and `gto-core` consumes only the DTO. The conversion lives on
the poker side of the boundary or in an explicit adapter — never inside `gto-core` reaching
back into poker semantics. Phase 9 must document where that seam is, by file.

## G. Baseline identity names the lineup

**Prefer:**

```
CP_NL50_6MAX_ANTE_100BB_PREFLOP_V1
```

**over** any identifier that omits the lineup. `CP_NL50_ANTE_100BB_PREFLOP_V1` cannot
distinguish a six-handed preflop dataset from a four-handed one, so two different solutions
collide on one name — the exact failure ADR-0019 exists to prevent.

Accepted as **ADR-0028**, which amends ADR-0019's format to
`<site>_<stake>_<lineup>_<ante>_<stack>_<coverage>_V<n>`. ADR-0019 otherwise stands: coverage is
still mandatory and `..._BASELINE_V1` is still retired.
