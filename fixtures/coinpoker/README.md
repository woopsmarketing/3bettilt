# CoinPoker hand-history fixtures

## What goes here

Real CoinPoker text hand-history exports, used **only** as test input for
`@gto-self/coinpoker-parser` (Phase 11) and for replay validation against
`@gto-self/poker-core`.

Drop your export here as e.g. `session-2026-08-28.txt`. If it contains real opponent
nicknames you would rather not commit, put it in `fixtures/coinpoker/private/`, which
is git-ignored. **When in doubt, use `private/`** — a real export is the default case.

> **Currently empty, and no export is expected right now (ADR-0033).** Do not request or
> wait for one. Phase 11 is deferred past the first usable MVP, and Phase 2 does no further
> rake forensics without a fixture — it ships the unknowns as explicit, validated policy
> fields instead, so a later correction is a configuration change. If an export does arrive,
> the two tasks it unblocks are Phase 11 in full and confirming the real settlement rule
> (a pre-Phase-13 validation item). See `docs/STATE.md`.

## What this data is NOT for

Hand-history opponent identifiers are not stable across hands on CoinPoker, so they
are **not** the player identity system. Player identity comes from the manually
entered nickname in the player database. Never key a long-lived player record off a
hand-history id.

## Nothing here may be fabricated

If no real fixture is present, the parser phase does not start. Writing a plausible
looking hand history by hand and testing against it proves nothing — it only encodes
our guesses about the format as if they were facts. Leave the directory empty instead.

## Observed behaviour

Recorded as **observations from one export, not as site rules and not as universal poker
rules** (ADR-0018). Each is marked with how far the evidence actually goes:

1. **Preflop-only hands can show `Rake = 0`.** _Still unconfirmed._ It resembles the common
   "no flop, no drop" convention, but resemblance is not evidence. Modelled as
   `RakeConfig.triggerPolicy`, so a correction changes a preset value rather than any code.
2. **Rake is NOT floored at milliBB granularity — this is now settled** (ADR-0027). The
   arithmetic:

   | pot   | 5% of pot | milliBB floor (ADR-0009) | history records |
   | ----- | --------- | ------------------------ | --------------- |
   | ₮5.37 | ₮0.2685   | ₮0.2685                  | **₮0.27**       |
   | ₮6.87 | ₮0.3435   | ₮0.3435                  | **₮0.34**       |

   The site settles in whole currency cents (₮0.01 = 20 milliBB at NL50). Row 1 also rules
   out flooring _at cent granularity_ (that would give ₮0.26); row 2 rules out ceiling (that
   would give ₮0.35). Both are consistent with rounding to the nearest cent. **Neither is an
   exact half-cent tie, so the tie-breaking rule is undetermined — do not guess it.** The
   full inference over the complete fixture is the bounded Phase-2 evidence task.

3. **Splash Fee is a separate deduction from the pot payout — confirmed by the hand-history
   arithmetic.** So it is modelled separately, as `FeeConfig`, and never collapsed into rake.
   When it applies, and how it interacts with the rake cap, is **still unknown** — the
   configuration models the amount without inventing the trigger. Phase 2 owns `FeeConfig`,
   settlement accounting and a chip-conservation invariant including fees; Phase 11 owns
   parsing the amount out of the text.

Do not "tidy" these into a single rake number. The hand history distinguishes them, and
collapsing the distinction destroys the only evidence we have.

## Coverage we need from a fixture

- 6-max tables, with varying numbers of occupied seats
- antes, small blind, big blind
- Hero hole cards
- fold / check / call / bet / raise
- all-in and uncalled-bet returns
- flop, turn, river
- showdown
- rake and splash fee lines
- run-it-once and run-it-twice hands

On run-it-twice: the MVP parser **preserves RIT text losslessly and does not replay it**
through the single-board engine (ADR-0030). RIT hands are still wanted in the fixture — they
are what the lossless-preservation path is tested against.

Also valuable, because they are what settles the open questions above: preflop-only hands
(rake trigger), hands with a splash fee, hands at **several different dealt-in counts** (the
8 BB cap may be lineup-dependent), and a wide spread of pot sizes (the rounding rule, and any
half-cent tie that would settle tie-breaking).
