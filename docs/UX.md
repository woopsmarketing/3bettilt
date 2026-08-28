# UX

Desktop-first. Speed over decoration. The user's hands should rarely leave the
keyboard, and the app should never ask for a number it can derive.

## Layout

```
+--------------------------------------------------+-------------------+
|                                                  |                   |
|                  SIX-SEAT TABLE                  |  STRATEGY PANEL   |
|                                                  |  (or PLAYER       |
|          seat  seat  seat                        |   PROFILE while   |
|                                                  |   a seat is       |
|            POT / BOARD                           |   selected)       |
|                                                  |                   |
|          seat  seat  HERO                        |                   |
+--------------------------------------------------+-------------------+
|  ACTION BAR:  F  C  R  A  Z  N      raise-to input, previews         |
+----------------------------------------------------------------------+
```

- **Hero is fixed at bottom-centre.** Physical seats never rotate visually; the
  button/SB/BB markers rotate instead.
- Each seat card shows: nickname, stack, position marker, dirty indicator, and an
  optional compact `VPIP / PFR / 3BET` line. Not every stat, not permanently.
- Clicking a seat swaps the right panel to that player's profile; Escape returns to
  the strategy panel. No page navigation.
- Most editing happens directly on the table, not in modals.

## Keyboard map

| Key     | Action                                                                       |
| ------- | ---------------------------------------------------------------------------- |
| `F`     | Fold                                                                         |
| `C`     | Check when the call amount is 0, otherwise Call                              |
| `R`     | Bet / Raise — focuses the numeric **raise-to** input                         |
| `A`     | All-in                                                                       |
| `Z`     | Undo the last logical event                                                  |
| `N`     | Next hand                                                                    |
| `S`     | Toggle the selected seat's sit-out (only when it cannot collide with typing) |
| `Enter` | Confirm the focused inline editor                                            |
| `Esc`   | Cancel the focused inline editor / close the card palette                    |

There is no Limp button. A preflop call before any raise is classified internally as
a limp; the user never thinks about it.

## Raise input

Semantics are **raise TO**, always.

```
street contribution = 2.5 BB
user types  R 9 Enter
-> player's total contribution on this street becomes 9 BB
```

Preview while typing — engine-computed, never user-computed:

```
Raise to:    9 BB
Additional:  6.5 BB
Min:         5 BB
Max:         93.7 BB
Pot after:   21.5 BB   (33% / 50% / 75% shortcuts available)
```

## Card input

A 52-card palette is the primary input, laid out ranks across (A..2) and suits down
(spades, hearts, diamonds, clubs). It appears near the Hero/action area and closes
itself:

- Hero hole cards: exactly 2, auto-close on the second.
- Flop: exactly 3, auto-close on the third. Turn: 1. River: 1.
- Already-used physical cards are disabled. Duplicates are impossible by construction.
- Text entry (`As Kd`, `Ah 7c 2s`) is a secondary convenience, not the MVP path.

## Hand lifecycle

```
NEW HAND -> auto button/blinds/ante -> Hero hole cards -> PREFLOP
  -> (auto) FLOP -> (auto) TURN -> (auto) RIVER -> settlement -> NEXT HAND
```

Street transitions happen automatically whenever the engine can infer that the
betting round is complete. There is no "Go to Flop" button — reaching a street simply
requests the board cards it needs.

## Observe mode and dirty stacks

When Hero folds, the app enters **Observe** mode automatically.

- **Continue recording** opponent actions -> every stack stays exactly tracked.
- **Skip Rest** -> detailed tracking stops for the remainder of the hand. Every player
  still capable of changing their stack becomes **DIRTY**. Players who had already
  folded with fully known contributions stay **CLEAN**.

On the next hand, only dirty stacks need resyncing, and they are fixed **in place on
the table**, not in a six-field modal. Click a stack -> inline editor -> `Enter` saves
and jumps to the next dirty stack -> `Esc` cancels.

Starting a hand with dirty stacks is allowed, but the app must visibly warn that state
and strategy accuracy are reduced.

## Strategy panel

Only prioritised when it is Hero's turn. Always shows actual and normalized context
side by side, then every available action's frequency:

```
ACTUAL                    MODEL
eff stack 93.7 BB         100 BB
HJ open   2.37 BB         2.5 BB

BET 33    61%   <- PRIMARY (highest frequency)
CHECK     24%
BET 75    15%
```

Mixed strategies are never hidden and the top action is never called "correct" — it
is labelled `PRIMARY` / `HIGHEST FREQUENCY`. Any value coming from a mock provider is
rendered in the mock colour with an explicit `MOCK DATA` badge.

## Interruption policy

Avoid modals. Prefer inline correction tools and non-blocking warnings. The user is
mid-session at a poker table; blocking them is worse than showing a caveat.
