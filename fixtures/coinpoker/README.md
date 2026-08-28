# CoinPoker hand-history fixtures

## What goes here

Real CoinPoker text hand-history exports, used **only** as test input for
`@gto-self/coinpoker-parser` (Phase 11) and for replay validation against
`@gto-self/poker-core`.

Drop your export here as e.g. `session-2026-08-28.txt`. If it contains real opponent
nicknames you would rather not commit, put it in `fixtures/coinpoker/private/`, which
is git-ignored.

## What this data is NOT for

Hand-history opponent identifiers are not stable across hands on CoinPoker, so they
are **not** the player identity system. Player identity comes from the manually
entered nickname in the player database. Never key a long-lived player record off a
hand-history id.

## Nothing here may be fabricated

If no real fixture is present, the parser phase does not start. Writing a plausible
looking hand history by hand and testing against it proves nothing — it only encodes
our guesses about the format as if they were facts. Leave the directory empty instead.

## Observed behaviour awaiting confirmation

Three things have been observed in a real CoinPoker export. They are recorded here as
**observations from one export, not as site rules and not as universal poker rules**
(ADR-0018). Phase 11 must confirm or correct each against the fixture:

1. **Preflop-only hands can show `Rake = 0`.** This resembles the common "no flop, no drop"
   convention, but resemblance is not evidence. Modelled as `RakeConfig.triggerPolicy`, so
   a correction changes a preset value rather than any code.
2. **Postflop hands show a normal percentage rake.** Consistent with the 5% / 8 BB cap
   preset; the rounding direction (ADR-0009 says floor) is still unconfirmed.
3. **Splash Fee is recorded separately from Rake.** So it is modelled separately, as
   `FeeConfig`. When it applies, and how it interacts with the rake cap, is **unknown** —
   the configuration models the amount without inventing the trigger.

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
