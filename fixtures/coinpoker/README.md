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
