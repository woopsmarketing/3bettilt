# `@gto-self/poker-core` — Phase 1 API specification

**Status:** canonical. Synthesized from three independent design proposals, judged against
`CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` (ADR-0001..0010), `docs/UX.md` and
`packages/shared/src/*`.

**Scope:** the pure poker state engine (Phase 1). The implementer types these contracts out
verbatim. Where a real-world poker rule was chosen rather than known, it is a `TableConfig`
field and is listed in _Explicit assumptions_.

---

## 1. Rationale — what was taken, what was rejected

Three proposals (call them **A**, **B**, **C**) were reviewed. They converged on more than they
disagreed on: commands in / events out, a `Hand = { events, state }` pair, undo as
drop-last-command-group-and-refold, layered side-pot-ready pots derived from per-seat total
contribution, raise-TO semantics, rake as exact-rational configuration, and the same
short-handed position table. Those points are adopted without further argument.

The genuine disagreements, and the ruling on each:

### Taken from **A**

- **Uncalled-bet return is computed over _all_ dealt-in seats, folded included** — not over
  contenders only. B and C compute it over contenders, which is wrong: `BTN raises to 3, all
fold` must return `3 − 1 = 2` (the big blind's posted 1 is the highest _other_ street
  contribution), leaving a pot of 2.5. Contenders-only would return the whole 3 and rake a
  1.5 pot. The money nets out, but the log misreports and the **rake basis is wrong**.
- **Board deal events are USER-authored and individually undoable.** The street _transition_ is
  engine-derived; the _cards_ are irreplaceable palette input and a mis-picked turn is exactly
  what `Z` must fix (`docs/UX.md`). The engine parks in `AWAITING_BOARD` and never invents a card.
- **No `STREET_ADVANCED` event.** The deal event _is_ the transition.
- **A `SETUP` phase with an explicit, exported `finalizeRoster` transition**, rather than
  embedding the roster in `HAND_STARTED`. Keeps `PLAYER_DEALT_IN` per-seat (matching
  `docs/ARCHITECTURE.md` and the Phase 3 `hand_players` grain) while making the
  roster-complete moment a named, tested function instead of an implicit ordering dependency.
- **Odd-chip / split-pot handling is implemented** (`Money.splitEvenly` exists in `shared`
  precisely for this). C's `SPLIT_POT_NOT_SUPPORTED` refusal is rejected: a chopped single main
  pot is an everyday event, and refusing it would leave the user unable to record a real hand.

### Taken from **B**

- **`SeatIndex = 0 | 1 | 2 | 3 | 4 | 5`**, a finite literal union, with per-seat containers as
  `BySeat<T> = Readonly<Record<SeatIndex, T>>`. Under `noUncheckedIndexedAccess` (ADR-0005) a
  mapped type over a finite literal key union yields `T`, not `T | undefined`, so the engine
  needs essentially no seat-access null checks and no `!`. A's branded `number` seat would spray
  `| undefined` (or `invariant` unwrapping) through every seat read. The cost — 6-max is baked
  into one type alias — is accepted and documented.
- **A rich, derived read model `toView(hand): HandView`, with the actor nested _inside_ the
  phase union.** `phase.kind === 'AWAITING_ACTION'` then narrows to a non-null `ActorView` with
  non-optional bounds, so the `docs/UX.md` raise preview is field reads and "read the call
  amount when nobody is to act" is a compile error. `HandState.phase` stays a flat string
  (cheap to assert, cheap to serialize); the union lives in the view only.
- **`seat` is optional on action commands** — omitted means "whoever is on the clock" (the UI
  path), supplied means "assert it is this seat" (the Phase 11 parser path, which names a seat
  on every line and gets a free consistency check).
- **Storing both `toAmount` and `amount` on wager events**, cross-checked by the reducer. The
  identity `amount === toAmount − streetContributionBefore` is _arithmetic_, not a rule, so it
  cannot be invalidated by a rules correction — it is a safe integrity check and gives the
  parser something to disagree with loudly.

### Taken from **C**

- **`actedAtFullRaiseCount: number | null` per seat, against a monotone
  `round.fullRaiseCount`.** This is the single best idea in the three proposals. A and B use a
  boolean that must be cleared across every seat on each full raise; C's counter needs no sweep
  and reduces the whole reopening question to one expression:
  `mayAggress(seat) = actedAtFullRaiseCount === null || actedAtFullRaiseCount < round.fullRaiseCount`.
  It produces the big blind's option (blind posts leave the field `null`) and the
  short-all-in-does-not-reopen rule (a short all-in does not increment the counter) with no
  special case anywhere.
- **An explicit `AWAITING_UNCALLED_RETURN` phase**, with the reducer refusing a board deal while
  a return is pending. "Return the uncalled bet before you deal" becomes an asserted
  state-machine edge instead of an ordering convention in the command layer that a later
  contributor can quietly break. The phase is transient — one `applyCommand` drains it — so the
  UI never sees it.
- **A single `EngineError` vocabulary** rather than four parallel error types. Every public
  function returns `EngineResult<T> = Result<T, EngineError>`; the code union is wide and the
  optional `context` carries `seat` / `min` / `max` / `seq` / `potIndex` so the UI can render
  "Min: 5 BB" straight from the error.
- **`seatsBeforeButton` exported on `SeatPosition`.** `docs/ARCHITECTURE.md` matching criteria
  #3/#4 need a _structural_ lineup key that does not depend on whichever naming convention wins
  the 5-handed argument.

### Rejected outright

- **B's canonical ALL_IN rewrite** — silently converting a `CALL`/`BET`/`RAISE` that consumes
  the stack into an `ALL_IN` event. This destroys the verb the user pressed and violates
  `CLAUDE.md` rule 3. The stored verb is the verb the user chose; all-in-ness is derived from
  the stack reaching zero. (`ALL_IN` is emitted only when the user actually pressed `A`.)
- **A's derived `origin` / derived commit grouping.** A's own design then needs a special case
  in `lastCommitStartIndex` for the engine-emitted `POT_AWARDED`. `origin` and `commandSeq` are
  _engine bookkeeping_, not poker facts; storing them makes undo grouping exact rather than
  heuristic, and no poker fact is duplicated. (`CLAUDE.md` rule 3 is about not destroying user
  input and not storing unreproducible derived values — this is neither.)
- **B/C's `BySeat<SeatOccupancy>` snapshot inside `HAND_STARTED`.** Whether a non-dealt-in seat
  was `EMPTY` or `SITTING_OUT` is a _table/session_ fact (Phase 3's `session_seats`), not a hand
  fact, and it changes nothing inside the hand. Keeping it out keeps the payload flat.
- **C's `POST_DEAD_BLIND` and manual SB/BB override.** Missed blinds and the dead button are
  explicitly not modelled in Phase 1; `docs/ROADMAP.md` puts "manual button/blind override" in
  Phase 8. Button override is supported now (it is just "which seat is the button"); dead
  blinds and SB/BB override are deferred, not half-built. **Superseded in Phase 2 (ADR-0031):**
  both shipped, as neutral primitives that are always explicit user input — a `POST_DEAD_BLIND`
  event whose accounting is identical to an ante, and a `BlindSeatOverride` persisted on
  `HAND_STARTED`. What is still not modelled is any *automatic* missed-blind or dead-button
  rule (7.9, 7.11, assumptions 15, 26–28).
- **C's caller-supplied `startedAt` / `finishedAt` on events.** The engine must not know about
  time at all; `hand_events` rows carry timestamps in Phase 3.
- **A's separate `HandError` / `ReplayError` types and B's four error types** — collapsed into
  one vocabulary (see above).
- **B's `Board` tuple union.** It makes a 2-card board unrepresentable but forces a cast in the
  reducer's append. A runtime invariant on `board.length ∈ {0,3,4,5}` is cheaper and honest.
- **C's `AWAITING_SHOWDOWN` / `AWAITING_AWARD` split.** One `AWAITING_AWARD` phase suffices: the
  engine auto-awards only when there is exactly one contender left (in which case the state
  never rests in that phase at all).
- **A's per-pot incremental rake-cap consumption.** Replaced by: all remaining pots are awarded
  by a single command, rake is computed **once** on the total with **one** per-hand cap, then
  allocated across pots. This makes the cap deterministic without an ordering convention.

### One design decision none of the three made, added here

**Two replay modes.** A and C validate persisted derived values on replay and reject on
mismatch; A itself flags the consequence as a risk (a rules correction retroactively makes
stored hands unloadable). The resolution:

- `replayHand(events)` — **strict**: every action event is re-validated as if it were a command.
  This is the round-trip guarantee the Phase 11 parser needs.
- `loadHand(events)` — **structural**: applies events, asserting only arithmetic identities and
  chip/pot conservation, never rule-dependent legality. This is what the DB uses to reload a
  stored hand, so a corrected rule never bricks history.

Correspondingly, `POT_AWARDED` stores the rake **actually applied** (ADR-0009 requires exactly
this) — and, since Phase 2, the fee actually applied alongside it (ADR-0032) — while the reducer
checks only `net === gross − rake − fee` and `sum(shares) === net`, never the rake or fee
_policy_.

---

## 2. Module list

All files under `packages/poker-core/src/`. Every relative import ends in `.js`; every type-only
import uses `import type` (`verbatimModuleSyntax`).

| File               | Responsibility                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `errors.ts`        | `EngineError` vocabulary, `EngineResult`, constructors. No dependencies.                                           |
| `config.ts`        | `TableConfig` and its parts: blinds, ante, rake, fee, ambiguous-rule flags, display. `validateTableConfig`.        |
| `presets.ts`       | Shipped presets (`CP_NL50_6MAX_ANTE`, `CP_NL50_6MAX_NO_ANTE`) and preset derivation helpers.                       |
| `seat.ts`          | `SeatIndex`, `BySeat<T>`, occupancy, and the clockwise ring primitives.                                            |
| `table.ts`         | Session-level `TableState`: occupancy, stacks, hero, button. Not event-sourced.                                    |
| `positions.ts`     | Blind assignment (incl. heads-up), the position scheme for 2..6 dealt in, action orders.                           |
| `street.ts`        | `Street` ordering and board-card arity. Standalone to avoid import cycles.                                         |
| `events.ts`        | The persisted `HandEvent` union, `EventMeta`, `makeEvent`, event predicates.                                       |
| `state.ts`         | `HandState`, `SeatHandState`, `BettingRound`, `ActionRecord`, accessors.                                           |
| `pots.ts`          | `Pot`, layered pot derivation, uncalled-bet computation, pot denominators.                                         |
| `betting.ts`       | Turn order, round closure, call amount, min/max raise-to, legality, `LegalActions`.                                |
| `sizing.ts`        | Pot-fraction shortcuts (33/50/75) and the live raise preview from `docs/UX.md`.                                    |
| `rake.ts`          | Rake computation from `RakeConfig`, and the per-pot allocator `fee.ts` shares. Isolated per ADR-0009.              |
| `fee.ts`           | Splash-fee validation and allocation from `FeeConfig`. Separate from rake end to end (ADR-0018/0032).              |
| `settlement.ts`    | Award planning, odd-chip split, auto-award of an uncontested pot, per-seat results.                                |
| `reduce.ts`        | The pure fold: `initialHandState`, `applyEvent`, `finalize`, `foldEvents`, `openBettingRound`, `seedPreflopRound`. |
| `commands.ts`      | `HandCommand` union, `validateCommand`, `expandCommand` (user event + engine cascade).                             |
| `hand.ts`          | `Hand`, `startHand`, `applyCommand(s)`, `undo`, `canUndo`, `replayHand`, `loadHand`, `handAtCommand`.              |
| `metrics.ts`       | Effective stack, SPR, pot odds, committed fraction, dead cards.                                                    |
| `view.ts`          | `toView(hand): HandView` — the UI's single read model. Pure projection, no new rules.                              |
| `serialization.ts` | zod schemas at the JSON/SQLite boundary; `encode`/`decode`; JSON round-trip property.                              |
| `index.ts`         | Public barrel. Deletes the Phase 0 `POKER_CORE_PLACEHOLDER`.                                                       |

Obligation from `docs/STATE.md`: delete `packages/poker-core/src/placeholder.test.ts` and the
`POKER_CORE_PLACEHOLDER` export.

Suggested test files (the adversarial test author is not bound by this list):
`tests/positions.test.ts`, `tests/blinds-antes.test.ts`, `tests/min-raise.test.ts`,
`tests/round-closure.test.ts`, `tests/pots-uncalled.test.ts`, `tests/streets.test.ts`,
`tests/settlement-rake.test.ts`, `tests/replay-undo.test.ts`, `tests/serialization.test.ts`.

---

## 3. Type contracts

### 3.1 `errors.ts`

```ts
import type { MilliBB } from '@gto-self/shared';
import { err, type Result } from '@gto-self/shared';
import type { SeatIndex } from './seat.js';

export type EngineErrorCode =
  // configuration / hand start
  | 'INVALID_CONFIG'
  | 'NOT_ENOUGH_PLAYERS'
  | 'TOO_MANY_PLAYERS'
  | 'NO_BUTTON_SEAT'
  | 'BUTTON_SEAT_NOT_DEALT_IN'
  | 'STACK_NOT_POSITIVE'
  | 'DUPLICATE_PLAYER'
  // manual blind assignment / dead blinds (ADR-0031)
  | 'BLIND_OVERRIDE_INVALID'
  | 'BLIND_OVERRIDE_ON_BUTTON'
  | 'POSITION_LINEUP_UNSUPPORTED'
  | 'DUPLICATE_DEAD_BLIND'
  // table mutation
  | 'SEAT_OCCUPIED'
  | 'SEAT_EMPTY'
  | 'STACK_NEGATIVE'
  | 'HAND_NOT_COMPLETE'
  | 'HAND_TABLE_MISMATCH'
  // phase
  | 'HAND_ALREADY_FINISHED'
  | 'NOT_BETTING_PHASE'
  | 'NOT_AWAITING_BOARD'
  | 'NOT_AWAITING_AWARD'
  // actor / seat
  | 'NOT_ACTORS_TURN'
  | 'SEAT_NOT_DEALT_IN'
  | 'SEAT_ALREADY_FOLDED'
  | 'SEAT_ALL_IN'
  // verb legality
  | 'CHECK_NOT_ALLOWED'
  | 'CALL_NOT_ALLOWED'
  | 'BET_NOT_ALLOWED'
  | 'RAISE_NOT_ALLOWED'
  | 'RAISE_NOT_REOPENED'
  | 'NO_OPPONENT_CAN_RESPOND'
  // amounts
  | 'AMOUNT_OUT_OF_RANGE'
  | 'AMOUNT_NOT_INCREASING'
  | 'AMOUNT_BELOW_MINIMUM'
  | 'INSUFFICIENT_STACK'
  // cards
  | 'WRONG_CARD_COUNT'
  | 'DUPLICATE_CARD'
  // settlement
  | 'UNKNOWN_POT'
  | 'AWARDS_INCOMPLETE'
  | 'POT_ALREADY_AWARDED'
  | 'NO_WINNERS'
  | 'DUPLICATE_WINNER'
  | 'WINNER_NOT_ELIGIBLE'
  | 'FEE_NOT_ALLOWED'
  | 'FEE_NEGATIVE'
  | 'FEE_ABOVE_CAP'
  | 'FEE_EXCEEDS_POT'
  // log
  | 'NOTHING_TO_UNDO'
  | 'CORRUPT_LOG';

/** Every field is JSON-serializable so the UI can render an error without re-deriving it. */
export interface EngineErrorContext {
  readonly seat?: SeatIndex;
  readonly min?: MilliBB;
  readonly max?: MilliBB;
  readonly actual?: MilliBB;
  readonly potIndex?: number;
  readonly seq?: number;
  readonly eventKind?: string;
  readonly expected?: string;
}

export interface EngineError {
  readonly code: EngineErrorCode;
  readonly message: string;
  readonly context: EngineErrorContext;
}

export type EngineResult<T> = Result<T, EngineError>;

export function engineError(
  code: EngineErrorCode,
  message: string,
  context?: EngineErrorContext,
): EngineError;

/** Shorthand for `err(engineError(...))` so validation sites stay one line. */
export function engineErr<T>(
  code: EngineErrorCode,
  message: string,
  context?: EngineErrorContext,
): EngineResult<T>;
```

### 3.2 `seat.ts`

```ts
import type { PlayerId } from '@gto-self/shared';

/** Physical seats at the table. Widening past 6-max means widening `SeatIndex` too. */
export const SEAT_COUNT = 6;

/**
 * A finite literal union, NOT `number`. Under `noUncheckedIndexedAccess` (ADR-0005),
 * a mapped type keyed by this union yields `T`, never `T | undefined`, so seat access
 * across the engine needs no null checks and no `!`.
 */
export type SeatIndex = 0 | 1 | 2 | 3 | 4 | 5;

export const SEAT_INDEXES: readonly SeatIndex[];

/** Total per-seat container. All six entries always exist. */
export type BySeat<T> = Readonly<Record<SeatIndex, T>>;

export type SeatOccupancy = 'ACTIVE' | 'SITTING_OUT' | 'EMPTY';
```

### 3.3 `config.ts`

```ts
import type { MilliBB, RoundingMode } from '@gto-self/shared';

export interface BlindConfig {
  readonly smallBlind: MilliBB; // NL50 preset: 500
  readonly bigBlind: MilliBB; // NL50 preset: 1000
}

export type AnteMode = 'PER_DEALT_IN_PLAYER';

export interface AnteConfig {
  readonly enabled: boolean;
  /** Single member today. `BIG_BLIND_ANTE` is additive later; `validateTableConfig`
   *  rejects any mode it cannot implement rather than half-implementing it. */
  readonly mode: AnteMode;
  /** Per dealt-in player. NL50 preset: 160 milliBB (0.16 BB). */
  readonly amount: MilliBB;
}

export type RakeAllocation = 'PROPORTIONAL' | 'MAIN_POT_FIRST';

/**
 * When a pot is raked at all.
 * 'ALWAYS'          — every awarded pot is raked.
 * 'NO_FLOP_NO_DROP' — the rake is waived when the board never reached three cards.
 *
 * A union rather than a boolean (ADR-0018/0033) so a further real trigger is additive and
 * never touches rake arithmetic. `validateTableConfig` REJECTS a member this version
 * cannot implement rather than defaulting to one.
 */
export type RakeTriggerPolicy = 'ALWAYS' | 'NO_FLOP_NO_DROP';

export interface RakeConfig {
  /** Exact rational so no float percentage ever touches money. 5% => 5 / 100. */
  readonly numerator: number;
  readonly denominator: number;
  /** Absolute per-hand cap in milliBB. NL50 preset: 8000 (8 BB). Must be a multiple of
   *  `quantum`, otherwise a capped rake would not itself be quantized. */
  readonly cap: MilliBB;
  /** Settlement granularity in milliBB, and the granularity `rounding` is applied AT.
   *  `1` means pure milliBB. NL50 preset: 20 — one currency cent at BB = 0.50 (ADR-0027).
   *  NEVER derived from `DisplayConfig`: presentation must not determine money. */
  readonly quantum: MilliBB;
  /** Applied ONCE, at `quantum` granularity. NL50 preset: 'round' (ADR-0027 superseded
   *  ADR-0009's milliBB floor for CoinPoker). Its half-way behaviour is an ASSUMPTION no
   *  observation has distinguished (ADR-0033). */
  readonly rounding: RoundingMode;
  /** When a pot is raked at all. ASSUMPTION for CoinPoker (ADR-0018). */
  readonly triggerPolicy: RakeTriggerPolicy;
  /** How one capped total rake is split across side pots. ASSUMPTION. */
  readonly allocation: RakeAllocation;
}

/**
 * When a fee (CoinPoker's "Splash Fee") is deducted.
 * 'NEVER'  — no fee is ever deducted. The shipped default.
 * 'MANUAL' — the amount is supplied at award time by the user or, later, the parser.
 *
 * There is deliberately NO automatic trigger: CoinPoker's is unknown (ADR-0032/0033) and
 * `CLAUDE.md` rule 7 forbids inventing one.
 */
export type FeeTriggerPolicy = 'NEVER' | 'MANUAL';

/**
 * Separate from `RakeConfig` and never collapsed into it (ADR-0018, confirmed by
 * ADR-0032): the splash fee is its own deduction from the pot payout, recorded as its own
 * amount all the way through settlement.
 */
export interface FeeConfig {
  readonly triggerPolicy: FeeTriggerPolicy;
  /** Ceiling on a MANUALLY supplied fee. This rejects a typo; it is not a site rule, and a
   *  fee within it is never re-quantized or otherwise rewritten (CLAUDE.md rule 3). */
  readonly cap: MilliBB;
  /** How one hand's total fee is split across side pots. Same policy type as rake. */
  readonly allocation: RakeAllocation;
}

export type ShortAllInMinRaiseBasis = 'CURRENT_BET' | 'LAST_FULL_RAISE';
export type HeadsUpButtonLabel = 'BTN' | 'SB';
export type OddChipRule = 'FIRST_LEFT_OF_BUTTON' | 'LOWEST_SEAT_INDEX';

/** Every genuinely ambiguous poker rule lives here as data (CLAUDE.md rule 7). */
export interface RuleOptions {
  /**
   * Minimum legal raise-TO after a SHORT (non-full) all-in raise.
   * 'CURRENT_BET'     => round.currentBet + round.lastFullRaiseSize            (default)
   * 'LAST_FULL_RAISE' => round.lastFullRaiseTo + round.lastFullRaiseSize,
   *                      falling back to the 'CURRENT_BET' formula when that
   *                      value would not exceed round.currentBet.
   */
  readonly shortAllInMinRaiseBasis: ShortAllInMinRaiseBasis;
  /** true => a big blind all-in for less than 1 BB still sets currentBet to the nominal BB. */
  readonly shortBlindSetsFullLevel: boolean;
  /** true => the big blind may check or raise when nobody raised. */
  readonly bigBlindHasOption: boolean;
  /** true => heads-up, the button posts the small blind and acts first preflop. */
  readonly headsUpButtonPostsSmallBlind: boolean;
  /** Position label given to the heads-up button seat. `blinds.smallBlindSeat` is
   *  always exposed separately, so this is a labelling choice only. */
  readonly headsUpButtonLabel: HeadsUpButtonLabel;
  /** true => a bet/raise is legal even when no opponent has chips behind to respond. */
  readonly allowRaiseWithNoCaller: boolean;
  /** Recipient of the remainder milliBB when a pot splits unevenly. */
  readonly oddChipRule: OddChipRule;
}

/** Presentation only. Feeds `Money.formatCurrency`; the engine never reads it. */
export interface DisplayConfig {
  /** Currency value of one big blind. NL50 => 0.5. */
  readonly bigBlindValue: number;
  readonly symbol: string;
}

export interface TableConfig {
  readonly presetId: string;
  readonly label: string;
  /** Literal 6, kept in sync with `SeatIndex`. */
  readonly seatCount: 6;
  readonly blinds: BlindConfig;
  /** Minimum postflop opening bet. Stated, not assumed equal to the big blind. */
  readonly minBet: MilliBB;
  readonly ante: AnteConfig;
  readonly rake: RakeConfig;
  /** Splash-fee policy. Separate from `rake` and never folded into it (ADR-0018/0032). */
  readonly fee: FeeConfig;
  readonly rules: RuleOptions;
  /** Reference buy-in; consumed by session setup and gto-core stack bucketing. */
  readonly referenceStack: MilliBB;
  readonly display: DisplayConfig;
}

export const DEFAULT_RULE_OPTIONS: RuleOptions;
```

`DEFAULT_RULE_OPTIONS` values:

```ts
{
  shortAllInMinRaiseBasis: 'CURRENT_BET',
  shortBlindSetsFullLevel: true,
  bigBlindHasOption: true,
  headsUpButtonPostsSmallBlind: true,
  headsUpButtonLabel: 'BTN',
  allowRaiseWithNoCaller: false,
  oddChipRule: 'FIRST_LEFT_OF_BUTTON',
}
```

### 3.4 `presets.ts`

```ts
/** presetId 'CP_NL50_6MAX_ANTE'. SB 500 / BB 1000, minBet 1000, ante enabled 160,
 *  rake { 5/100, cap 8000, quantum 20, rounding 'round', triggerPolicy 'NO_FLOP_NO_DROP',
 *  allocation 'PROPORTIONAL' }, fee { triggerPolicy 'NEVER', cap 8000, allocation
 *  'PROPORTIONAL' }, referenceStack 100000, display { bigBlindValue: 0.5, symbol: '$' },
 *  DEFAULT_RULE_OPTIONS.
 *
 *  Every rake and fee value here is an honest DEFAULT, not a claim about CoinPoker
 *  (ADR-0033). Observed: a nominal 5% rate; preflop-only hands raked zero; postflop hands
 *  raked a percentage; two recorded amounts consistent with rounding to the nearest cent.
 *  NOT observed and therefore not asserted: the half-way tie-break, the fee trigger, and
 *  whether the 8 BB cap varies with the dealt-in count. */
export const CP_NL50_6MAX_ANTE: TableConfig;

/** Identical with `ante.enabled === false`. presetId 'CP_NL50_6MAX'. */
export const CP_NL50_6MAX_NO_ANTE: TableConfig;

export function withAnteEnabled(config: TableConfig, enabled: boolean): TableConfig;

/** `docs/GTO_BASELINE.md`: NL100 must be reachable by changing configuration only.
 *  `rakeQuantum` is part of the patch because a different stake has a different settlement
 *  granularity — at BB = 0.50 one cent is 20 milliBB, at BB = 1.00 it is 10. It is STATED,
 *  never derived from `bigBlindValue`: `DisplayConfig` is presentation (ADR-0027). */
export function withStakeDisplay(
  config: TableConfig,
  patch: {
    readonly presetId: string;
    readonly label: string;
    readonly rakeCap: MilliBB;
    readonly rakeQuantum: MilliBB;
    readonly bigBlindValue: number;
  },
): TableConfig;
```

### 3.5 `street.ts`

```ts
export type Street = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER';
export type PostflopStreet = Exclude<Street, 'PREFLOP'>;

export const STREETS: readonly ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];
```

### 3.6 `positions.ts`

```ts
import type { SeatIndex } from './seat.js';

export type Position = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

export const POSITIONS: readonly ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

/** Walked BACKWARDS from the button over the non-blind dealt-in seats. */
export const NON_BLIND_LADDER: readonly ['BTN', 'CO', 'HJ', 'UTG'];

/**
 * A manual SB/BB assignment supplied at hand start (ADR-0031). ALWAYS user input: the
 * engine never derives one, because who owes a blind after sitting out differs per room and
 * no fixture has confirmed CoinPoker's rule. `null`/absent means the ordinary rotation,
 * which is byte-identical to the behaviour before overrides existed.
 */
export interface BlindSeatOverride {
  readonly smallBlindSeat: SeatIndex;
  readonly bigBlindSeat: SeatIndex;
}

export interface BlindAssignment {
  readonly buttonSeat: SeatIndex;
  readonly smallBlindSeat: SeatIndex;
  readonly bigBlindSeat: SeatIndex;
  readonly headsUp: boolean;
}

export interface SeatPosition {
  readonly seat: SeatIndex;
  readonly position: Position;
  /** 0 = button, 1 = SB, 2 = BB, ... clockwise over dealt-in seats. */
  readonly seatsAfterButton: number;
  /** 0 = button, 1 = CO, 2 = HJ, 3 = UTG, ... counter-clockwise over dealt-in seats.
   *  The STRUCTURAL lineup key gto-core matches on (ARCHITECTURE.md #3/#4). */
  readonly seatsBeforeButton: number;
  /** 0 = first to act preflop. */
  readonly preflopOrder: number;
  /** 0 = first to act on every postflop street. */
  readonly postflopOrder: number;
  readonly isButton: boolean;
  readonly blindRole: 'SB' | 'BB' | null;
}

export type PositionMap = BySeat<SeatPosition | null>;
```

### 3.7 `table.ts`

```ts
import type { MilliBB, PlayerId } from '@gto-self/shared';
import type { BySeat, SeatIndex, SeatOccupancy } from './seat.js';
import type { TableConfig } from './config.js';

export interface TableSeat {
  readonly seat: SeatIndex;
  readonly occupancy: SeatOccupancy;
  /** null iff occupancy === 'EMPTY'. */
  readonly playerId: PlayerId | null;
  /** Chips at the table right now. ZERO when EMPTY. Preserved while SITTING_OUT. */
  readonly stack: MilliBB;
}

export interface TableState {
  readonly config: TableConfig;
  readonly seats: BySeat<TableSeat>;
  readonly buttonSeat: SeatIndex | null;
  /** Identity, not a poker rule. UX pins hero bottom-centre and Phase 8 needs it. */
  readonly heroSeat: SeatIndex | null;
  readonly handNumber: number;
}
```

### 3.8 `events.ts`

```ts
import type { Card, EventId, HandId, IdFactory, MilliBB, PlayerId } from '@gto-self/shared';
import type { SeatIndex } from './seat.js';
import type { TableConfig } from './config.js';
import type { BlindSeatOverride } from './positions.js';

export type EventOrigin = 'USER' | 'ENGINE';

/**
 * Engine bookkeeping, not poker facts. `id` comes from the injected IdFactory (ADR-0007);
 * `seq` is dense and ascending from 0 and is the SQLite ordering key; `commandSeq` groups
 * every event produced by one logical user command (undo drops one whole group);
 * `origin` distinguishes what the user did from what the engine derived.
 */
export interface EventMeta {
  readonly id: EventId;
  readonly seq: number;
  readonly commandSeq: number;
  readonly origin: EventOrigin;
}

export type HandEventKind =
  | 'HAND_STARTED'
  | 'PLAYER_DEALT_IN'
  | 'POST_ANTE'
  | 'POST_DEAD_BLIND'
  | 'POST_SB'
  | 'POST_BB'
  | 'HOLE_CARDS_SET'
  | 'FOLD'
  | 'CHECK'
  | 'CALL'
  | 'BET'
  | 'RAISE'
  | 'ALL_IN'
  | 'RETURN_UNCALLED'
  | 'FLOP_DEALT'
  | 'TURN_DEALT'
  | 'RIVER_DEALT'
  | 'POT_AWARDED'
  | 'HAND_FINISHED';

export type HandEndReason = 'ALL_FOLDED' | 'SHOWDOWN';

export interface PotShare {
  readonly seat: SeatIndex;
  readonly amount: MilliBB;
}

export type HandEventPayload =
  /** USER. Always seq 0. Embeds the whole config so the log replays with no external context. */
  | {
      readonly kind: 'HAND_STARTED';
      readonly handId: HandId;
      readonly handNumber: number;
      readonly config: TableConfig;
      readonly buttonSeat: SeatIndex;
      readonly heroSeat: SeatIndex | null;
      /** The manual SB/BB assignment this hand was started with, or `null` for the
       *  ordinary rotation (ADR-0031). REQUIRED and persisted: positions and both action
       *  orders are derived from it on every replay, and a hand that replayed to different
       *  blinds would be a corrupt log. */
      readonly blindOverride: BlindSeatOverride | null;
    }
  /** ENGINE. One per dealt-in seat, ascending physical seat order. */
  | {
      readonly kind: 'PLAYER_DEALT_IN';
      readonly seat: SeatIndex;
      readonly playerId: PlayerId | null;
      /** ACTUAL entered stack, never a normalized bucket. */
      readonly startingStack: MilliBB;
    }
  /** ENGINE. amount = min(config.ante.amount, stack) — the ACTUAL amount posted. */
  | { readonly kind: 'POST_ANTE'; readonly seat: SeatIndex; readonly amount: MilliBB }
  /** ENGINE, from an EXPLICIT `StartHandOptions.deadBlinds` entry — never inferred
   *  (ADR-0031). A neutral accounting event whose arithmetic is IDENTICAL to an ante: dead
   *  money that reaches the pot and the side-pot layering basis but never lowers what the
   *  seat owes to call. Only the DEAD portion of a returning player's post is modelled
   *  here; a live portion is an ordinary blind post and there is no combined event.
   *  amount = min(requested, stackAfterAnte) — the ACTUAL amount posted, and always > 0
   *  (a seat the ante left with nothing posts no event at all). */
  | { readonly kind: 'POST_DEAD_BLIND'; readonly seat: SeatIndex; readonly amount: MilliBB }
  /** ENGINE. amount = min(smallBlind, stackAfterAnte). */
  | { readonly kind: 'POST_SB'; readonly seat: SeatIndex; readonly amount: MilliBB }
  /** ENGINE. amount = min(bigBlind, stackAfterAnte). */
  | { readonly kind: 'POST_BB'; readonly seat: SeatIndex; readonly amount: MilliBB }
  /** USER. 1..2 cards. revealed:false = hero's own entry, true = a showdown reveal.
   *  Re-emitting for the same seat replaces the previous holding. */
  | {
      readonly kind: 'HOLE_CARDS_SET';
      readonly seat: SeatIndex;
      readonly cards: readonly Card[];
      readonly revealed: boolean;
    }
  | { readonly kind: 'FOLD'; readonly seat: SeatIndex }
  | { readonly kind: 'CHECK'; readonly seat: SeatIndex }
  /** USER. `toAmount` is the seat's street contribution AFTER the action (raise-TO
   *  semantics everywhere); `amount` is the chips moved. Both stored: the identity
   *  amount === toAmount - streetContributionBefore is arithmetic, so it is a safe
   *  integrity check for the Phase 11 parser. A short call is a CALL with a clamped
   *  amount, NOT an ALL_IN — the stored verb is the verb the user pressed. */
  | {
      readonly kind: 'CALL';
      readonly seat: SeatIndex;
      readonly toAmount: MilliBB;
      readonly amount: MilliBB;
    }
  | {
      readonly kind: 'BET';
      readonly seat: SeatIndex;
      readonly toAmount: MilliBB;
      readonly amount: MilliBB;
    }
  | {
      readonly kind: 'RAISE';
      readonly seat: SeatIndex;
      readonly toAmount: MilliBB;
      readonly amount: MilliBB;
    }
  /** USER. Emitted only when the user pressed `A`. Whether it functions as a bet, a
   *  call, a full raise or a short all-in is DERIVED, never stored. */
  | {
      readonly kind: 'ALL_IN';
      readonly seat: SeatIndex;
      readonly toAmount: MilliBB;
      readonly amount: MilliBB;
    }
  /** ENGINE. Emitted at round close, before any street or settlement transition. */
  | { readonly kind: 'RETURN_UNCALLED'; readonly seat: SeatIndex; readonly amount: MilliBB }
  | { readonly kind: 'FLOP_DEALT'; readonly cards: readonly [Card, Card, Card] }
  | { readonly kind: 'TURN_DEALT'; readonly card: Card }
  | { readonly kind: 'RIVER_DEALT'; readonly card: Card }
  /** Winners are USER input in Phase 1 (hand evaluation is out of scope) or ENGINE when
   *  exactly one contender remains. Amounts are always engine-computed. `rake` records the
   *  rake ACTUALLY APPLIED (ADR-0009) and `fee` the fee ACTUALLY APPLIED (ADR-0032), so a
   *  later configuration correction never rewrites or invalidates stored history.
   *  `fee` is REQUIRED and is ZERO when there is none — the two deductions are recorded
   *  separately, and `netAmount === grossAmount - rake - fee`. */
  | {
      readonly kind: 'POT_AWARDED';
      readonly potIndex: number;
      readonly winners: readonly SeatIndex[];
      readonly grossAmount: MilliBB;
      readonly rake: MilliBB;
      readonly fee: MilliBB;
      readonly netAmount: MilliBB;
      readonly shares: readonly PotShare[];
    }
  /** ENGINE. Same command group as the award that consumed the last unawarded pot. */
  | {
      readonly kind: 'HAND_FINISHED';
      readonly reason: HandEndReason;
      readonly totalRake: MilliBB;
      /** Required, ZERO when no fee was charged. Never merged into `totalRake`. */
      readonly totalFees: MilliBB;
    };

/** Narrows correctly on `.kind`: an intersection distributes over the union. */
export type HandEvent = EventMeta & HandEventPayload;

export type EventOf<K extends HandEventKind> = Extract<HandEvent, { readonly kind: K }>;

export const ACTION_EVENT_KINDS: readonly ['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN'];

export const WAGER_EVENT_KINDS: readonly ['CALL', 'BET', 'RAISE', 'ALL_IN'];
```

Every leaf field is `number | string | boolean`, an array of those, `TableConfig` or
`BlindSeatOverride` (both themselves all primitives). No `Date`, `Map`, `Set`, `bigint`,
`undefined` or class instance appears in any payload, so `JSON.parse(JSON.stringify(e))` is
lossless.

### 3.9 `state.ts`

```ts
import type { Card, HandId, MilliBB, PlayerId } from '@gto-self/shared';
import type { BySeat, SeatIndex } from './seat.js';
import type { TableConfig } from './config.js';
import type { BlindAssignment, BlindSeatOverride, Position, PositionMap } from './positions.js';
import type { Street } from './street.js';
import type { HandEndReason, HandEventKind, PotShare } from './events.js';
import type { Pot } from './pots.js';

export type SeatStatus = 'NOT_DEALT_IN' | 'IN_HAND' | 'FOLDED' | 'ALL_IN';

/**
 * SETUP                    inside command group 0 while the roster accumulates
 * BETTING                  a seat is on the clock (`actorSeat` non-null)
 * AWAITING_UNCALLED_RETURN a round closed with an unmatched excess; transient
 * AWAITING_BOARD           the palette must supply `pendingStreet`'s cards
 * AWAITING_AWARD           two or more contenders; the winner is an INPUT in Phase 1
 * COMPLETE                 every pot awarded, HAND_FINISHED applied
 */
export type HandPhase =
  | 'SETUP'
  | 'BETTING'
  | 'AWAITING_UNCALLED_RETURN'
  | 'AWAITING_BOARD'
  | 'AWAITING_AWARD'
  | 'COMPLETE';

export interface SeatHandState {
  readonly seat: SeatIndex;
  readonly playerId: PlayerId | null;
  readonly status: SeatStatus;
  /** ACTUAL stack when the hand was dealt. */
  readonly startingStack: MilliBB;
  /** Chips still behind. status === 'ALL_IN' iff the seat has committed its whole
   *  startingStack (totalContribution === startingStack) and has not folded. That is the
   *  same as "this is ZERO" for the whole hand and stops being the same only at
   *  settlement: POT_AWARDED credits a winner's stack without un-committing anything, so
   *  an all-in seat that wins ends the hand ALL_IN with chips behind. RETURN_UNCALLED is
   *  the converse — it lowers totalContribution and returns the seat to IN_HAND. */
  readonly stack: MilliBB;
  /** Live wager on the CURRENT street. Equals contributionByStreet[state.street]. */
  readonly streetContribution: MilliBB;
  /** Antes and dead blinds this hand. Dead money: never counts toward a call. */
  readonly deadContribution: MilliBB;
  /** deadContribution + every street's live contribution, net of RETURN_UNCALLED.
   *  The side-pot layering basis. */
  readonly totalContribution: MilliBB;
  readonly contributionByStreet: Readonly<Record<Street, MilliBB>>;
  readonly holeCards: readonly Card[];
  readonly holeCardsRevealed: boolean;
  /**
   * null  = has not voluntarily acted in the current betting round.
   * else  = round.fullRaiseCount at the moment this seat last acted.
   * mayAggress(seat) === (value === null || value < round.fullRaiseCount).
   * Blind and ante posts leave it null — that is the big blind's option. A short
   * all-in does not increment fullRaiseCount — that is the no-reopen rule.
   */
  readonly actedAtFullRaiseCount: number | null;
  readonly lastAction: HandEventKind | null;
  readonly returnedUncalled: MilliBB;
  /** Every pot share this seat won, BEFORE its rake and fee attribution. */
  readonly wonGross: MilliBB;
  readonly rakePaid: MilliBB;
  /** Splash fee attributed to this seat. Recorded separately from `rakePaid` (ADR-0032). */
  readonly feePaid: MilliBB;
}

export interface BettingRound {
  readonly street: Street;
  /** The live street contribution a seat must match to continue. */
  readonly currentBet: MilliBB;
  /** Delta required to make a FULL raise. Seeded to bigBlind preflop / minBet postflop;
   *  updated ONLY by a full bet or raise. */
  readonly lastFullRaiseSize: MilliBB;
  /** Bet level established by the last FULL bet/raise. Preflop seeded to the nominal
   *  big blind. Used only by shortAllInMinRaiseBasis === 'LAST_FULL_RAISE'. */
  readonly lastFullRaiseTo: MilliBB;
  /** Increments ONLY on a full bet/raise. Preflop starts at 1 (the BB is the bring-in),
   *  postflop at 0. The reopening clock. */
  readonly fullRaiseCount: number;
  readonly lastAggressorSeat: SeatIndex | null;
  readonly lastActedSeat: SeatIndex | null;
  /** This street's action order over dealt-in seats. Turn-taking is index arithmetic
   *  over this array — never Set/Map iteration. */
  readonly actionOrder: readonly SeatIndex[];
  readonly closed: boolean;
}

export interface UncalledReturn {
  readonly seat: SeatIndex;
  readonly amount: MilliBB;
}

export interface PotAwardRecord {
  readonly potIndex: number;
  readonly winners: readonly SeatIndex[];
  readonly grossAmount: MilliBB;
  readonly rake: MilliBB;
  /** ZERO when no fee applies. netAmount === grossAmount - rake - fee. */
  readonly fee: MilliBB;
  readonly netAmount: MilliBB;
  readonly shares: readonly PotShare[];
}

/**
 * The fold-maintained action projection. Exists because ARCHITECTURE.md's matching
 * priority needs exact action-tree structure (#4) and postflop sizing as a fraction of
 * the pot BEFORE the action (#7). Computed once here so gto-core never re-derives it.
 * poker-core supplies the raw numbers and deliberately picks no sizing convention.
 */
export interface ActionRecord {
  readonly seq: number;
  readonly commandSeq: number;
  readonly street: Street;
  readonly seat: SeatIndex;
  readonly position: Position | null;
  readonly kind: HandEventKind;
  readonly toAmount: MilliBB | null;
  readonly amount: MilliBB;
  readonly isAllIn: boolean;
  readonly isFullRaise: boolean;
  readonly currentBetBefore: MilliBB;
  readonly fullRaiseCountAfter: number;
  readonly potBefore: MilliBB;
  readonly potAfter: MilliBB;
  readonly effectiveStackBefore: MilliBB;
}

export interface HandState {
  readonly handId: HandId;
  readonly handNumber: number;
  readonly config: TableConfig;
  readonly buttonSeat: SeatIndex;
  readonly heroSeat: SeatIndex | null;
  readonly blinds: BlindAssignment;
  /** The manual SB/BB assignment carried on HAND_STARTED, or null for the ordinary
   *  rotation. Held on the state because finalizeRoster runs assignBlinds lazily, once the
   *  roster is complete, and must reach the same `blinds` on every replay. */
  readonly blindOverride: BlindSeatOverride | null;
  /** Ascending physical seat order. Fixed once the roster is finalized. */
  readonly dealtInSeats: readonly SeatIndex[];
  readonly positions: PositionMap;
  readonly seats: BySeat<SeatHandState>;

  readonly street: Street;
  /** length is always 0, 3, 4 or 5 (invariant). */
  readonly board: readonly Card[];
  readonly phase: HandPhase;
  readonly round: BettingRound;
  /** Non-null exactly when phase === 'BETTING'. */
  readonly actorSeat: SeatIndex | null;
  /** Non-null exactly when phase === 'AWAITING_UNCALLED_RETURN'. */
  readonly pendingUncalled: UncalledReturn | null;
  /** Non-null exactly when phase === 'AWAITING_BOARD'. */
  readonly pendingStreet: Street | null;

  /** Always a LIST with eligible-player sets. Rebuilt from totalContribution on every
   *  event, so it can never drift. Length 1 in the ordinary hand. */
  readonly pots: readonly Pot[];
  /** Money.sum of pot amounts === Money.sum of totalContributions (asserted). */
  readonly potTotal: MilliBB;
  readonly awards: readonly PotAwardRecord[];
  readonly totalRake: MilliBB;
  /** Summed splash fee across every award. Never merged into `totalRake` (ADR-0032). */
  readonly totalFees: MilliBB;
  readonly endReason: HandEndReason | null;

  readonly actions: readonly ActionRecord[];
  readonly eventCount: number;
  readonly commandCount: number;
}
```

Standing per-seat invariant, asserted after every event:

```
stack === startingStack − totalContribution + wonGross − rakePaid − feePaid
```

### 3.10 `pots.ts`

```ts
import type { MilliBB } from '@gto-self/shared';
import type { SeatIndex } from './seat.js';

export interface Pot {
  readonly index: number;
  readonly kind: 'MAIN' | 'SIDE';
  readonly amount: MilliBB;
  /** The per-seat total-contribution level this layer is capped at. */
  readonly capLevel: MilliBB;
  /** Ascending seat order. Non-folded seats whose totalContribution >= capLevel. */
  readonly eligibleSeats: readonly SeatIndex[];
  readonly awarded: boolean;
}
```

### 3.11 `betting.ts`

```ts
import type { MilliBB } from '@gto-self/shared';
import type { SeatIndex } from './seat.js';
import type { EngineErrorCode } from './errors.js';

export interface CallOption {
  readonly toAmount: MilliBB;
  readonly amount: MilliBB;
  readonly isAllIn: boolean;
}

export interface WagerOption {
  readonly kind: 'BET' | 'RAISE';
  readonly minToAmount: MilliBB;
  readonly maxToAmount: MilliBB;
  readonly minAdditional: MilliBB;
  readonly maxAdditional: MilliBB;
  /** true when minToAmount === maxToAmount === the seat's all-in level, i.e. the only
   *  legal aggression is a short all-in. The UX renders "Raise" as "All-in". */
  readonly onlyAllIn: boolean;
}

export interface AllInOption {
  readonly toAmount: MilliBB;
  readonly amount: MilliBB;
  /** What the shove functions as. Derived, never stored on the event. */
  readonly effect: 'CALL' | 'BET' | 'RAISE';
  readonly isFullRaise: boolean;
}

export interface LegalActions {
  readonly seat: SeatIndex | null;
  readonly canFold: boolean;
  readonly canCheck: boolean;
  readonly call: CallOption | null;
  readonly wager: WagerOption | null;
  readonly allIn: AllInOption | null;
  /** Populated when `wager` is null, so the UI can label the disabled control honestly:
   *  'RAISE_NOT_REOPENED' | 'NO_OPPONENT_CAN_RESPOND' | 'INSUFFICIENT_STACK'. */
  readonly wagerBlockedBy: EngineErrorCode | null;
}

export interface WagerClassification {
  readonly effect: 'CALL' | 'BET' | 'RAISE';
  readonly amount: MilliBB;
  readonly isAllIn: boolean;
  readonly isFullRaise: boolean;
}
```

### 3.12 `sizing.ts`

```ts
import type { MilliBB } from '@gto-self/shared';
import type { EngineError } from './errors.js';

export interface SizingSuggestion {
  readonly toAmount: MilliBB;
  readonly additional: MilliBB;
  readonly requestedFraction: number;
  readonly clampedTo: 'MIN' | 'MAX' | null;
}

/** Backs the `docs/UX.md` raise-input preview block verbatim. `legal: false` with a
 *  populated `error` rather than an Err, because the input stays live while the user types. */
export interface RaisePreview {
  readonly toAmount: MilliBB;
  readonly additional: MilliBB;
  readonly minToAmount: MilliBB;
  readonly maxToAmount: MilliBB;
  readonly potBefore: MilliBB;
  readonly potAfter: MilliBB;
  readonly fractionOfPotBefore: number | null;
  readonly isAllIn: boolean;
  readonly legal: boolean;
  readonly error: EngineError | null;
}
```

### 3.13 `rake.ts`, `fee.ts` and `settlement.ts`

```ts
import type { MilliBB, PlayerId } from '@gto-self/shared';
import type { SeatIndex } from './seat.js';
import type { PotShare } from './events.js';

export interface RakeContext {
  /** state.board.length >= 3 */
  readonly sawFlop: boolean;
  readonly contenderCount: number;
}

export interface RakeResult {
  readonly gross: MilliBB;
  readonly rake: MilliBB;
  /** gross - rake. PRE-FEE: a fee is a separate deduction with its own record. */
  readonly net: MilliBB;
  /** `raw > cap`, so a raw rake landing exactly on the cap is not "capped". */
  readonly capped: boolean;
  /** true when `triggerPolicy: 'NO_FLOP_NO_DROP'` suppressed the rake entirely. */
  readonly waived: boolean;
}

/** There is deliberately NO fee field on `RakeResult`: rake and fee stay separate all the
 *  way down (ADR-0018/0032), and `net` above is the pre-fee net. */

/** `fee.ts`. What a supplied fee has to fit inside. Both amounts are for the whole hand. */
export interface FeeContext {
  /** Summed gross of every pot being awarded. */
  readonly gross: MilliBB;
  /** The rake already being taken from that same gross. */
  readonly rake: MilliBB;
}

export interface PotAwardInput {
  readonly potIndex: number;
  /** One or more winners. An empty array is NO_WINNERS; duplicates are DUPLICATE_WINNER. */
  readonly winners: readonly SeatIndex[];
}

export interface SettlementPlan {
  readonly records: readonly PotAwardRecord[];
  readonly totalRake: MilliBB;
  /** ZERO unless a fee was supplied for this hand. Never merged into `totalRake`. */
  readonly totalFees: MilliBB;
  readonly reason: HandEndReason;
}

export interface SeatResult {
  readonly seat: SeatIndex;
  readonly playerId: PlayerId | null;
  readonly startingStack: MilliBB;
  readonly endingStack: MilliBB;
  readonly contributed: MilliBB;
  readonly wonGross: MilliBB;
  readonly rakePaid: MilliBB;
  readonly feePaid: MilliBB;
  /** endingStack − startingStack. */
  readonly net: MilliBB;
}

export interface HandResult {
  readonly pots: readonly PotAwardRecord[];
  readonly totalRake: MilliBB;
  readonly totalFees: MilliBB;
  readonly reason: HandEndReason;
  readonly seats: readonly SeatResult[];
}
```

Invariant asserted at `COMPLETE`
(`assertSettlementBalances`): `Money.sum(seats.map(s => s.net)) + totalRake + totalFees === ZERO`.

### 3.14 `commands.ts`

```ts
import type { Card, MilliBB } from '@gto-self/shared';
import type { SeatIndex } from './seat.js';
import type { PotAwardInput } from './settlement.js';

/**
 * `seat` is optional on action commands: the UI omits it (it is whoever is on the clock),
 * the Phase 11 parser supplies it and gets a free NOT_ACTORS_TURN consistency check.
 * `cards` is `readonly Card[]` rather than a tuple, so a wrong count is a Result error
 * (WRONG_CARD_COUNT) instead of a compile error at the palette.
 */
export type ActionCommand =
  | { readonly kind: 'FOLD'; readonly seat?: SeatIndex }
  | { readonly kind: 'CHECK'; readonly seat?: SeatIndex }
  | { readonly kind: 'CALL'; readonly seat?: SeatIndex }
  | { readonly kind: 'BET'; readonly toAmount: MilliBB; readonly seat?: SeatIndex }
  | { readonly kind: 'RAISE'; readonly toAmount: MilliBB; readonly seat?: SeatIndex }
  | { readonly kind: 'ALL_IN'; readonly seat?: SeatIndex };

export type HandCommand =
  | ActionCommand
  | { readonly kind: 'DEAL_BOARD'; readonly cards: readonly Card[] }
  | {
      readonly kind: 'SET_HOLE_CARDS';
      readonly seat: SeatIndex;
      readonly cards: readonly Card[];
      readonly revealed: boolean;
    }
  /** Must cover EVERY unawarded pot, so the per-hand rake cap is computed once.
   *  `fee` is the whole hand's OBSERVED splash fee. Omitted (or `null`) means none — the
   *  normal case, and the only one `fee.triggerPolicy: 'NEVER'` accepts. There is no
   *  automatic fee: CoinPoker's trigger is unknown (ADR-0032/0033). */
  | {
      readonly kind: 'AWARD_POTS';
      readonly awards: readonly PotAwardInput[];
      readonly fee?: MilliBB | null;
    };

export type HandCommandKind = HandCommand['kind'];

/**
 * One EXPLICIT dead-blind post (ADR-0031). The engine never infers who owes one: missed
 * blinds and the dead button differ per room and no CoinPoker fixture has confirmed theirs,
 * so this is always user input. A seat that did not miss a blind simply has no entry here.
 * Only the DEAD portion belongs here; a returning player's LIVE portion is an ordinary
 * blind post, and no combined event exists.
 */
export interface DeadBlindPost {
  readonly seat: SeatIndex;
  /** Requested amount; the post is CLAMPED to the seat's stack, exactly like an ante. */
  readonly amount: MilliBB;
}
```

Command constructors (`fold()`, `check()`, `call()`, `allIn()`, `betTo(x)`, `raiseTo(x)`,
`dealBoard(cards)`, `setHoleCards(seat, cards, revealed)`, `awardPots(awards, fee = null)`) are
exported so the keyboard map reads `applyCommand(hand, fold(), ids)`.

### 3.15 `hand.ts`

```ts
import type { HandEvent } from './events.js';
import type { HandState } from './state.js';

/** `state` is always exactly the fold of `events`. Kept as a separate field so
 *  "state is a pure fold over events" stays literally true and testable:
 *  loadHand(hand.events).value.state must deep-equal hand.state. */
export interface Hand {
  readonly events: readonly HandEvent[];
  readonly state: HandState;
}

/** Declared in `commands.ts` (and re-exported from the barrel), shown here because
 *  `startHand` is its main entry point. */
export interface StartHandOptions {
  readonly handId: HandId;
  /** Defaults to table.buttonSeat. Must be an ACTIVE, dealt-in seat. */
  readonly buttonSeat?: SeatIndex;
  /** Defaults to table.handNumber. */
  readonly handNumber?: number;
  /** Manual SB/BB assignment (ADR-0031). Omitted or `null` means the ordinary rotation,
   *  which produces byte-identical events to a build with no override at all. Persisted on
   *  HAND_STARTED. Heads-up it OVERRIDES `rules.headsUpButtonPostsSmallBlind`. */
  readonly blindOverride?: BlindSeatOverride | null;
  /** Explicit dead-blind posts, at most one per seat. Omitted means none — the engine has
   *  no opinion about who "should" post one. */
  readonly deadBlinds?: readonly DeadBlindPost[];
}
```

### 3.16 `metrics.ts`

```ts
export type StackBasis = 'STARTING' | 'REMAINING';
```

### 3.17 `view.ts`

```ts
import type { Card, HandId, MilliBB, PlayerId } from '@gto-self/shared';
import type { BySeat, SeatIndex } from './seat.js';
import type { TableConfig } from './config.js';
import type { Position } from './positions.js';
import type { PostflopStreet, Street } from './street.js';
import type { ActionRecord, SeatStatus } from './state.js';
import type { LegalActions } from './betting.js';
import type { Pot } from './pots.js';
import type { HandResult } from './settlement.js';

/** Everything in the docs/UX.md raise-input preview and the strategy panel's ACTUAL
 *  column, in one object. */
export interface ActorView {
  readonly seat: SeatIndex;
  readonly position: Position | null;
  readonly playerId: PlayerId | null;
  readonly stack: MilliBB;
  readonly streetContribution: MilliBB;
  readonly callAmount: MilliBB;
  readonly pot: MilliBB;
  readonly potIfCalls: MilliBB;
  readonly effectiveStack: MilliBB;
  readonly spr: number | null;
  readonly potOdds: number | null;
  readonly legal: LegalActions;
}

export interface AwardablePot {
  readonly index: number;
  readonly kind: 'MAIN' | 'SIDE';
  readonly amount: MilliBB;
  readonly eligibleSeats: readonly SeatIndex[];
  /** What the rake would be if all remaining pots were awarded now. Display only. */
  readonly projectedRake: MilliBB;
  /** What the fee would be if all remaining pots were awarded now, with NOTHING supplied.
   *  Display only, and ZERO under every shipped `fee.triggerPolicy`: there is no automatic
   *  fee, so none exists until an `AWARD_POTS` command carries an observed one (ADR-0032).
   *  Computed through the real allocator rather than written as a constant, so a future
   *  automatic trigger needs no new field here. */
  readonly projectedFee: MilliBB;
  readonly awarded: boolean;
}

/** The actor lives INSIDE the phase, so reading a call amount when nobody is on the
 *  clock is a compile error and a raise slider always has its bounds. */
export type ViewPhase =
  | { readonly kind: 'SETUP' }
  | { readonly kind: 'AWAITING_ACTION'; readonly actor: ActorView }
  | {
      readonly kind: 'AWAITING_BOARD';
      readonly street: PostflopStreet;
      readonly cardsNeeded: 1 | 3;
    }
  | { readonly kind: 'AWAITING_AWARD'; readonly pots: readonly AwardablePot[] }
  | { readonly kind: 'COMPLETE'; readonly result: HandResult };

export interface SeatView {
  readonly seat: SeatIndex;
  readonly playerId: PlayerId | null;
  readonly position: Position | null;
  readonly status: SeatStatus;
  readonly stack: MilliBB;
  readonly startingStack: MilliBB;
  readonly streetContribution: MilliBB;
  readonly totalContribution: MilliBB;
  readonly holeCards: readonly Card[];
  readonly isButton: boolean;
  /** Heads-up, the button seat has isButton and isSmallBlind both true while
   *  `position` is whatever rules.headsUpButtonLabel says. */
  readonly isSmallBlind: boolean;
  readonly isBigBlind: boolean;
  readonly isHero: boolean;
  readonly isActor: boolean;
  readonly lastAction: ActionRecord | null;
}

export interface HandView {
  readonly handId: HandId;
  readonly handNumber: number;
  readonly config: TableConfig;
  readonly phase: ViewPhase;
  readonly street: Street;
  readonly board: readonly Card[];
  readonly seats: BySeat<SeatView>;
  readonly buttonSeat: SeatIndex;
  readonly smallBlindSeat: SeatIndex;
  readonly bigBlindSeat: SeatIndex;
  readonly dealtInSeats: readonly SeatIndex[];
  readonly contenderSeats: readonly SeatIndex[];
  readonly pot: MilliBB;
  readonly pots: readonly Pot[];
  readonly currentBet: MilliBB;
  readonly fullRaiseCount: number;
  readonly lastAggressorSeat: SeatIndex | null;
  readonly deadCards: readonly Card[];
  readonly actions: readonly ActionRecord[];
  readonly canUndo: boolean;
  readonly result: HandResult | null;
}
```

---

## 4. Exported function signatures

Contract legend. **Result** = returns `EngineResult<T>`, never throws for any input that
type-checks. **Throws** = asserts with `invariant()` from `@gto-self/shared`; reachable only
through an engine bug or a corrupt log. **Total** = neither; returns a value for every input.

### 4.1 `errors.ts`

```ts
// Total. Builds an EngineError with an always-present (possibly empty) context.
export function engineError(code, message, context?): EngineError;

// Total. `err(engineError(...))`, typed for any T.
export function engineErr<T>(code, message, context?): EngineResult<T>;
```

### 4.2 `seat.ts`

```ts
// Total. True iff value is an integer in 0..5.
export function isSeatIndex(value: number): value is SeatIndex;

// Throws. Programmer/corrupt-data guard; never call it on user input.
export function asSeatIndex(value: number): SeatIndex;

// Total. Builds a full six-entry container.
export function makeBySeat<T>(build: (seat: SeatIndex) => T): BySeat<T>;

// Total. Immutable single-slot replace; returns the same reference when unchanged.
export function setBySeat<T>(source: BySeat<T>, seat: SeatIndex, value: T): BySeat<T>;

// Total.
export function updateBySeat<T>(source: BySeat<T>, seat: SeatIndex, f: (v: T) => T): BySeat<T>;

// Total. Clockwise successor; wraps 5 -> 0.
export function nextSeat(seat: SeatIndex): SeatIndex;

// Total. All six seats in ring order beginning at `start`.
export function seatsClockwiseFrom(start: SeatIndex, includeStart: boolean): readonly SeatIndex[];

// Total. Filters a subset into ring order starting at `from`. THE ordering primitive:
// every action order, ante order and odd-chip order is built from it.
export function orderClockwise(
  seats: readonly SeatIndex[],
  from: SeatIndex,
  includeFrom: boolean,
): readonly SeatIndex[];

// Throws if `target` is absent. Rotates a ring-ordered subset so `target` is first.
// The one place an array is indexed under noUncheckedIndexedAccess, so nothing else needs `!`.
export function rotateToSeat(seats: readonly SeatIndex[], target: SeatIndex): readonly SeatIndex[];
```

### 4.3 `config.ts` / `presets.ts`

```ts
// Result. Rejects: non-money amounts, non-positive blinds, smallBlind > bigBlind,
// minBet <= 0, negative ante, ante.enabled with a zero amount, rake denominator 0,
// numerator outside 0..denominator, negative rake cap, a rake `quantum` that is not a
// positive integer milliBB, a rake `cap` that is not an EXACT MULTIPLE of that quantum (a
// capped rake would otherwise not be quantized and the settlement would be internally
// inconsistent), a negative fee cap, referenceStack <= 0, a non-positive
// display.bigBlindValue, seatCount !== 6, and any AnteMode, RakeTriggerPolicy,
// FeeTriggerPolicy or RakeAllocation this version cannot implement.
// Called by createTable, startHand and decode.
// A bad preset is user data, not a programmer error -> INVALID_CONFIG.
export function validateTableConfig(config: TableConfig): EngineResult<TableConfig>;

// Total.
export function withAnteEnabled(config: TableConfig, enabled: boolean): TableConfig;
export function withStakeDisplay(config: TableConfig, patch): TableConfig;
```

### 4.4 `table.ts`

```ts
// Result. All six seats EMPTY, buttonSeat null, heroSeat null, handNumber 0.
// Errors INVALID_CONFIG via validateTableConfig.
export function createTable(config: TableConfig): EngineResult<TableState>;

// Total. `noUncheckedIndexedAccess` is a non-issue: BySeat lookups are total.
export function tableSeatAt(table: TableState, seat: SeatIndex): TableSeat;

// Result. Errors SEAT_OCCUPIED, STACK_NOT_POSITIVE, AMOUNT_OUT_OF_RANGE.
// Sets occupancy ACTIVE. AMOUNT_OUT_OF_RANGE covers BOTH the value itself and the TABLE
// TOTAL it would produce: six individually legal stacks can sum past MAX_MILLI_BB, and the
// reducer's Money.sum over starting stacks would then throw out of startHand.
export function seatPlayer(
  table: TableState,
  seat: SeatIndex,
  playerId: PlayerId,
  stack: MilliBB,
): EngineResult<TableState>;

// Total. Clears the seat to EMPTY with playerId null and stack ZERO; clears hero/button
// if they pointed here (button becomes null).
export function vacateSeat(table: TableState, seat: SeatIndex): TableState;

// Result. ACTIVE <-> SITTING_OUT is the UX `S` toggle. Errors SEAT_EMPTY when activating
// an unoccupied seat. Moving to EMPTY is `vacateSeat`, not this.
export function setSeatOccupancy(
  table: TableState,
  seat: SeatIndex,
  occupancy: 'ACTIVE' | 'SITTING_OUT',
): EngineResult<TableState>;

// Result. The docs/UX.md inline stack editor. Zero is allowed (a busted seat); negative is
// STACK_NEGATIVE; out-of-range is AMOUNT_OUT_OF_RANGE (checked BEFORE any Money call), for
// the value itself and for the table total it would produce.
export function setSeatStack(
  table: TableState,
  seat: SeatIndex,
  stack: MilliBB,
): EngineResult<TableState>;

// Result. Errors SEAT_EMPTY. Clears hero on every other seat.
export function setHeroSeat(table: TableState, seat: SeatIndex): EngineResult<TableState>;

// Result. The manual BTN override. Must be an ACTIVE occupied seat.
export function setButtonSeat(table: TableState, seat: SeatIndex): EngineResult<TableState>;

// Result. Next dealt-in-eligible seat clockwise; the lowest one when buttonSeat is null.
// Errors NOT_ENOUGH_PLAYERS. Dead-button / missed-blind rules are NOT modelled.
export function advanceButton(table: TableState): EngineResult<TableState>;

// Total. ACTIVE, occupied, stack > 0 — ascending seat order. SITTING_OUT and EMPTY are
// excluded structurally: they post nothing and receive no cards.
export function dealtInSeats(table: TableState): readonly SeatIndex[];

// Result. Writes each dealt-in seat's ending stack back from a COMPLETE hand and
// increments handNumber. Errors HAND_NOT_COMPLETE, HAND_TABLE_MISMATCH (a seat's playerId
// changed underneath). Does NOT advance the button — that is a separate explicit call.
export function applyHandResult(table: TableState, hand: Hand): EngineResult<TableState>;
```

### 4.5 `positions.ts`

```ts
// Result. dealtIn must be ascending, distinct, length 2..6, and contain buttonSeat.
// Errors NOT_ENOUGH_PLAYERS, TOO_MANY_PLAYERS, BUTTON_SEAT_NOT_DEALT_IN, CORRUPT_LOG.
//
// `override` (ADR-0031) names the two blind seats explicitly. It is validated, never
// trusted: both seats must be dealt in (SEAT_NOT_DEALT_IN); they must be distinct
// (BLIND_OVERRIDE_INVALID); with THREE OR MORE dealt in neither may be the button seat
// (BLIND_OVERRIDE_ON_BUTTON — that is the dead-button case, which stays unimplemented);
// and the resulting lineup must be labelable by the six-member Position union
// (POSITION_LINEUP_UNSUPPORTED, checked here via derivePositionLabels so an unlabelable
// assignment can never reach a started hand).
//
// PRECEDENCE: heads-up, the override WINS over rules.headsUpButtonPostsSmallBlind — an
// explicit user statement outranks a configured default, and heads-up is the one shape
// where naming the button as a blind seat is legal.
export function assignBlinds(
  dealtIn: readonly SeatIndex[],
  buttonSeat: SeatIndex,
  rules: RuleOptions,
  override?: BlindSeatOverride | null, // default null = the ordinary rotation
): EngineResult<BlindAssignment>;

// Result. THE single place a Position label is decided, and the reason it returns a Result:
// a lineup the six-member Position union cannot describe is REFUSED
// (POSITION_LINEUP_UNSUPPORTED), never approximated. No label is ever invented, reused for
// two seats, or defaulted. See Rules 7.11.
export function derivePositionLabels(
  dealtIn: readonly SeatIndex[],
  blinds: BlindAssignment,
  rules: RuleOptions,
): EngineResult<ReadonlyMap<SeatIndex, Position>>;

// Total given a BlindAssignment that came from assignBlinds. null for seats not dealt in.
// Delegates labelling to derivePositionLabels; reaching an unlabelable lineup here means a
// corrupt log, and the invariant is what loadHand turns into CORRUPT_LOG.
export function assignPositions(
  dealtIn: readonly SeatIndex[],
  blinds: BlindAssignment,
  rules: RuleOptions,
): PositionMap;

// Total. Dealt-in seats in preflop action order; index 0 acts first. ONE rule, no special
// cases: ring order starting immediately after the EFFECTIVE big blind, so the big blind
// always acts last preflop — which follows a BlindSeatOverride when one is present.
export function preflopActionOrder(
  dealtIn: readonly SeatIndex[],
  blinds: BlindAssignment,
): readonly SeatIndex[];

// Total. Dealt-in seats in postflop action order; index 0 acts first on every street.
// Postflop order is a BUTTON rule, not a blind rule, so a BlindSeatOverride leaves the
// postflop SEAT order untouched; only the position labels along it move.
export function postflopActionOrder(
  dealtIn: readonly SeatIndex[],
  blinds: BlindAssignment,
): readonly SeatIndex[];

// Total. Orders by preflop action order (UTG earliest). For view ordering and gto-core keys.
export function comparePositions(a: Position, b: Position): number;
```

### 4.6 `street.ts`

```ts
export function streetIndex(street: Street): number; // Total. PREFLOP 0 .. RIVER 3
export function nextStreet(street: Street): PostflopStreet | null; // Total. null after RIVER
export function boardCardsForStreet(street: Street): number; // Total. 0 / 3 / 1 / 1
export function totalBoardCardsThrough(street: Street): number; // Total. 0 / 3 / 4 / 5
export function streetForBoardSize(size: number): Street; // Throws on 1, 2 or > 5
```

### 4.7 `events.ts`

```ts
// Total. The ONLY place an EventId is minted, and it comes from the injected IdFactory
// (ADR-0007). crypto.randomUUID is never called in this package.
export function makeEvent(
  payload: HandEventPayload,
  meta: { readonly seq: number; readonly commandSeq: number; readonly origin: EventOrigin },
  ids: IdFactory,
): HandEvent;

export function isActionEvent(e: HandEvent): boolean; // FOLD CHECK CALL BET RAISE ALL_IN
export function isWagerEvent(e: HandEvent): boolean; // CALL BET RAISE ALL_IN (carry toAmount)
export function eventSeat(e: HandEvent): SeatIndex | null; // Total
export function eventsOfCommand(events, commandSeq): readonly HandEvent[]; // Total
export function lastCommandSeq(events: readonly HandEvent[]): number | null; // Total
```

### 4.8 `state.ts`

```ts
export function seatState(state: HandState, seat: SeatIndex): SeatHandState; // Total
export function isContender(seat: SeatHandState): boolean; // IN_HAND or ALL_IN
// Ring order starting at the first contender LEFT of the button, button last — the same
// order postflopActionOrder uses. For a button on seat 0 at a full table that is
// [1,2,3,4,5,0], not [0,1,2,3,4,5].
export function contenders(state: HandState): readonly SeatIndex[];
// Contenders with chips behind (status IN_HAND). Fewer than 2 => no new betting can open;
// this is the structural handler for "all-in players are skipped on later streets".
export function seatsAbleToAct(state: HandState): readonly SeatIndex[];
export function emptySeatHandState(seat: SeatIndex): SeatHandState; // Total
export const ZERO_BY_STREET: Readonly<Record<Street, MilliBB>>;
```

### 4.9 `pots.ts`

```ts
// Total. Layered decomposition over the distinct ascending totalContribution levels.
// A layer whose eligible set would be empty (only folded seats reached that level) is
// merged down into the previous pot; indices are renumbered densely.
export function computePots(
  seats: BySeat<SeatHandState>,
  dealtInSeats: readonly SeatIndex[],
): readonly Pot[];

export function potTotal(pots: readonly Pot[]): MilliBB; // Total. Money.sum
export function potsEligibleFor(pots, seat: SeatIndex): readonly Pot[]; // Total
export function unawardedPots(state: HandState): readonly Pot[]; // Total

// Total. null unless exactly one dealt-in seat holds the maximum CURRENT-STREET
// contribution and that maximum exceeds the second highest. Folded seats are INCLUDED
// in both maxima (see Rules 7.7).
export function computeUncalledReturn(state: HandState): UncalledReturn | null;

// Total. Everything committed before the seat on the clock acts — the denominator
// ARCHITECTURE.md specifies for postflop sizing normalization.
export function potBeforeAction(state: HandState): MilliBB;

// Total. potBeforeAction + callAmount(seat). Denominator for the 33/50/75 shortcuts.
export function potAfterCall(state: HandState, seat: SeatIndex): MilliBB;

// Throws. Money.sum(pot amounts) must equal Money.sum(totalContributions).
export function assertPotsConserveContributions(state: HandState): void;
```

### 4.10 `betting.ts`

```ts
// Total. The highest CURRENT-STREET contribution among the non-folded seats other than
// `seat`. Folded seats are excluded: their chips are dead money and demand nothing.
export function highestOpposingContribution(state: HandState, seat: SeatIndex): MilliBB;

// Total. status IN_HAND && (streetContribution < highestOpposingContribution(state, seat)
//                           || (actedAtFullRaiseCount === null && seatsAbleToAct >= 2))
// Clause 1 is a REAL obligation, not round.currentBet — see Rules 7.6.
export function mustAct(state: HandState, seat: SeatIndex): boolean;

// Total. actedAtFullRaiseCount === null || actedAtFullRaiseCount < round.fullRaiseCount.
// THE reopening rule, stated once.
export function mayReopen(state: HandState, seat: SeatIndex): boolean;

// Total. mayReopen && (some other contender has chips behind || rules.allowRaiseWithNoCaller)
// && stack > 0.
export function mayAggress(state: HandState, seat: SeatIndex): boolean;

export function seatsThatMustAct(state: HandState): readonly SeatIndex[]; // Total
export function isBettingRoundClosed(state: HandState): boolean; // Total, === length 0

// Total. Walks round.actionOrder from one past round.lastActedSeat (index 0 when null)
// and returns the first seat where mustAct holds; null when the round is closed.
export function nextActor(state: HandState): SeatIndex | null;

// Total. Money.min(Money.sub(currentBet, streetContribution), stack) — clamped, so a
// short call needs no special case anywhere else. ZERO when facing no bet.
export function callAmount(state: HandState, seat: SeatIndex): MilliBB;

// Total. Unclamped requirement, so the UI can show "call 12 BB (all-in for 4.3 BB)".
export function fullCallAmount(state: HandState, seat: SeatIndex): MilliBB;

// Total. streetContribution + callAmount — the CALL event's toAmount.
export function callToAmount(state: HandState, seat: SeatIndex): MilliBB;

// Total. Facing no bet: config.minBet. Facing a bet: see Rules 7.3. NOT clamped to the
// stack — the true legal minimum is reported even when unreachable.
export function minWagerToAmount(state: HandState, seat: SeatIndex): MilliBB;

// Total. Money.add(streetContribution, stack) — the seat's all-in level.
export function maxWagerToAmount(state: HandState, seat: SeatIndex): MilliBB;

// Total. increment = toAmount - currentBet; isFullRaise = increment >= lastFullRaiseSize
// (facing no bet: toAmount >= config.minBet).
export function classifyWager(
  state: HandState,
  seat: SeatIndex,
  toAmount: MilliBB,
): WagerClassification;

// Total. Returns an all-false/null struct with seat null when phase !== 'BETTING' or the
// seat is not on the clock, so callers never branch on phase first.
export function legalActions(state: HandState, seat?: SeatIndex): LegalActions;

// Result. Validation order and error codes are fixed by Rules 7.2. Checks that toAmount is
// a safe integer within +/-MAX_MILLI_BB BEFORE any Money call, so Money never throws on
// user input. Returns the classification a valid wager would produce.
export function validateWagerTo(
  state: HandState,
  seat: SeatIndex,
  toAmount: MilliBB,
): EngineResult<WagerClassification>;
```

### 4.11 `sizing.ts`

```ts
// Result. ONE documented formula for both bets and raises:
//   toAmount = round.currentBet + Money.mulFraction(potAfterCall(state, seat), fraction, mode)
// Facing no bet this degenerates to fraction x pot. The result is clamped into
// [minWagerToAmount, maxWagerToAmount] and `clampedTo` says whether it was, so the UI can
// grey a shortcut rather than silently sending an illegal size. Rounding is explicit
// (ADR-0009: sizing rounds -> pass 'round'). Errors NOT_BETTING_PHASE, NOT_ACTORS_TURN and
// AMOUNT_OUT_OF_RANGE. `fraction` and `mode` are user input, so every value that would make
// Money throw is rejected BEFORE any arithmetic (section 5): a negative or non-finite
// fraction; a product, or a resulting raise-to, outside MAX_MILLI_BB; and — under 'exact'
// — a product that is not a whole number of milliBB.
export function wagerToForPotFraction(
  state: HandState,
  seat: SeatIndex,
  fraction: number,
  mode: RoundingMode,
): EngineResult<SizingSuggestion>;

// Total. Never refuses: reports illegality inside `legality`/`error` so the raise input
// stays live while the user types. `fractionOfPotBefore` is Money.ratio(amount, potBefore).
export function previewWager(state: HandState, seat: SeatIndex, toAmount: MilliBB): RaisePreview;
```

### 4.12 `rake.ts` and `fee.ts`

```ts
// Total. Rake for one hand's summed gross, in three stated steps:
//
//   waived = config.triggerPolicy === 'NO_FLOP_NO_DROP' && !ctx.sawFlop   -> rake ZERO
//   raw    = Money.mulRatioQuantized(gross, numerator, denominator, quantum, rounding)
//   rake   = Money.min(raw, config.cap)
//
// The rate is applied and quantized in ONE rounding step (ADR-0027). Computing the milliBB
// rake first and quantizing it afterwards rounds TWICE, and the first rounding can push the
// value across the half-way point of the second, landing a WHOLE QUANTUM from the exact
// value: gross 4190 at 5/100 with quantum 20 is exactly 209.5, whose nearest multiple of 20
// is 200 — the two-step form returns 220. `net` is gross - rake and does NOT account for a
// fee, which is a separate deduction with its own record (ADR-0032). `capped` is
// `raw > cap`, so a raw rake landing exactly on the cap is not "capped";
// validateTableConfig guarantees cap is a multiple of quantum, so the capped result is
// quantized too. No float ever touches rake (ADR-0001, ADR-0009, ADR-0027).
export function computeRake(gross: MilliBB, config: RakeConfig, ctx: RakeContext): RakeResult;

// Total. The ONE allocation algorithm, shared by rake and fee. `ceilings[i]` is the most pot
// i can be charged — pot.amount for rake, pot.amount - rakeAlreadyTaken[i] for a fee charged
// on top of a rake. Proportional weights are always the GROSS pot amounts, so the split does
// not shift because an earlier deduction already took some of a pot. `label` only shapes the
// invariant messages, so a broken rake and a broken fee do not report the same failure.
export function allocateAcrossPots(
  pots: readonly Pot[],
  ceilings: readonly MilliBB[],
  total: MilliBB,
  allocation: RakeAllocation,
  label: string,
): readonly MilliBB[];

// Total. One rake amount per pot, same length and order as `pots`, summing EXACTLY to
// totalRake, and NEVER charging a pot more than it holds (asserted, so netAmount is never
// negative). PROPORTIONAL: Money.mulRatio(totalRake, pot.amount, potTotal, 'floor') with the
// floor remainder added to pot 0, spilling into later pots only if pot 0 cannot hold it.
// MAIN_POT_FIRST: drain from index 0 upward — which CAN take a small main pot in full and
// award its winner a net of ZERO. See Rules 7.13.
export function allocateRake(
  pots: readonly Pot[],
  totalRake: MilliBB,
  allocation: RakeAllocation,
): readonly MilliBB[];

// --- fee.ts ---------------------------------------------------------------------------
// `poker-core` deliberately knows no fee TRIGGER. Under 'MANUAL' the amount is an OBSERVED
// input supplied at award time; this module validates its range and allocates it, and never
// re-quantizes or otherwise rewrites it (CLAUDE.md rule 3).

// Result. The total fee for one hand, given what the user supplied (`null` = nothing
// supplied). Never throws; a bad fee is user data. Rejects, each with its own code:
//   FEE_NEGATIVE     a negative fee;
//   FEE_NOT_ALLOWED  a NON-ZERO fee supplied while triggerPolicy is 'NEVER';
//   FEE_ABOVE_CAP    a fee above config.cap;
//   FEE_EXCEEDS_POT  a fee that, with the rake, would exceed the pot total.
// A fee that passes is returned UNCHANGED — not quantized, not capped, not clamped. Nothing
// supplied gives ZERO under every policy; an explicit ZERO is accepted everywhere, because a
// zero fee is the absence of a fee. Only charging one under 'NEVER' is the error.
export function resolveFee(
  supplied: MilliBB | null,
  config: FeeConfig,
  ctx: FeeContext,
): EngineResult<MilliBB>;

// Total. One fee amount per pot, same length and order as `pots`, summing EXACTLY to
// totalFee. Uses the SAME allocator as the rake, with each pot's ceiling reduced by the rake
// already taken from it, so no pot is over-charged and netAmount is never negative
// (asserted). `rakePerPot` must already be the allocated rake for the same pots, in order.
export function allocateFee(
  pots: readonly Pot[],
  rakePerPot: readonly MilliBB[],
  totalFee: MilliBB,
  allocation: FeeConfig['allocation'],
): readonly MilliBB[];
```

Money primitives this rests on, both in `@gto-self/shared`:

- `Money.quantize(amount, quantum, mode)` — round `amount` to the nearest multiple of
  `quantum` under `mode`. `quantize(x, 1, mode)` is the identity for every mode. `'round'` is
  nearest with ties **away from zero**, symmetric about zero.
- `Money.mulRatioQuantized(amount, numerator, denominator, quantum, mode)` —
  `amount * numerator / denominator` rounded **once** to a multiple of `quantum`. It is
  deliberately **not** `quantize(mulRatio(...))`: that rounds twice, and the counterexample
  above (`4190 * 5/100` at `quantum 20`: exact `209.5`, one-step `200`, two-step `220`) is a
  whole quantum of real money. It throws when the exact product is not representable, so a
  silent loss of precision can never reach a settlement amount.

### 4.13 `settlement.ts`

```ts
// Total. state.board.length >= 3. The 'NO_FLOP_NO_DROP' trigger test.
export function sawFlop(state: HandState): boolean;

// Total. rules.oddChipRule === 'FIRST_LEFT_OF_BUTTON'
//   ? orderClockwise(winners, buttonSeat, false)
//   : winners ascending. Remainder milliBB from Money.splitEvenly go one each along this order.
export function oddChipOrder(state: HandState, winners: readonly SeatIndex[]): readonly SeatIndex[];

// Total. Money.splitEvenly + oddChipOrder. Sum of shares === netAmount (asserted).
export function splitPot(
  state: HandState,
  netAmount: MilliBB,
  winners: readonly SeatIndex[],
): readonly PotShare[];

// Total. Per-winner deduction attribution for one pot, in the same order as `shares`. The
// event stores only the pot's total rake and total fee; this is how the reducer reproduces
// each seat's rakePaid and feePaid so the standing per-seat chip identity holds. BOTH use
// it, so a pot's rake and its fee are attributed by the same rule.
export function splitRakeAcrossShares(rake: MilliBB, shareCount: number): readonly MilliBB[];

// Result. `awards` must cover EVERY unawarded pot exactly once (AWARDS_INCOMPLETE,
// POT_ALREADY_AWARDED, UNKNOWN_POT), each with >= 1 distinct winner drawn from that pot's
// eligibleSeats (NO_WINNERS, DUPLICATE_WINNER, WINNER_NOT_ELIGIBLE). Rake is computed ONCE
// on the summed gross with ONE per-hand cap, then allocated. reason is SHOWDOWN.
//
// `fee` is the whole hand's splash fee as OBSERVED by the user (or, later, the parser).
// `null` — the normal case — means none was supplied and the hand's fee is ZERO; there is no
// automatic trigger (ADR-0032). A supplied fee is range-checked by `resolveFee`
// (FEE_NEGATIVE, FEE_NOT_ALLOWED, FEE_ABOVE_CAP, FEE_EXCEEDS_POT) and then used exactly as
// entered.
export function planAwards(
  state: HandState,
  awards: readonly PotAwardInput[],
  fee?: MilliBB | null, // default null
): EngineResult<SettlementPlan>;

// Result. Used when contenders(state).length === 1: the winner is derived, not asked for.
// reason is ALL_FOLDED. Errors NOT_AWAITING_AWARD when more than one contender remains.
// `fee` behaves exactly as in planAwards. The engine cascade that calls this supplies null,
// because an uncontested pot is awarded with no user command to carry an observed fee. The
// parameter exists so a caller that HAS observed one (Phase 11) needs no new signature.
export function autoAwardUncontested(
  state: HandState,
  fee?: MilliBB | null, // default null
): EngineResult<SettlementPlan>;

// Total at any phase; `net` is honest before COMPLETE too.
export function handResult(state: HandState): HandResult | null;
export function seatResult(state: HandState, seat: SeatIndex): SeatResult;

// Throws. At COMPLETE, sum(seat net) + totalRake + totalFees === ZERO.
export function assertSettlementBalances(state: HandState): void;
```

### 4.14 `reduce.ts`

```ts
// Throws only on an invalid embedded config. phase 'SETUP', empty roster, PREFLOP,
// empty board, empty pots.
export function initialHandState(started: EventOf<'HAND_STARTED'>): HandState;

// Throws. Runs assignBlinds + assignPositions over the accumulated roster, stamps each
// seat's position, and seeds the preflop round. Invoked by applyEvent the first time it
// sees an event outside { HAND_STARTED, PLAYER_DEALT_IN } — in practice POST_ANTE,
// POST_DEAD_BLIND or POST_SB. Exported so the transition is directly testable, not an
// implicit side effect. state.blindOverride (from HAND_STARTED) is fed straight to
// assignBlinds, so a replay reaches exactly the blinds the hand was played with; an
// override the engine would refuse today throws here and surfaces as CORRUPT_LOG from
// loadHand.
export function finalizeRoster(state: HandState): HandState;

// Total. Preflop seeding. See Rules 7.5.
export function seedPreflopRound(state: HandState): BettingRound;

// Total. Postflop round open: currentBet ZERO, lastFullRaiseSize config.minBet,
// lastFullRaiseTo ZERO, fullRaiseCount 0, lastAggressorSeat null, lastActedSeat null,
// actionOrder postflopActionOrder. Also rolls each seat's streetContribution into
// contributionByStreet, zeroes streetContribution and clears actedAtFullRaiseCount.
export function openBettingRound(state: HandState, street: Street): BettingRound;

// Throws (invariant) on any event that cannot apply. Applies the payload, appends to
// `actions` for voluntary actions, then calls finalize(). Only ever fed events the engine
// just produced or that a replay entry point has gated, so a throw here means a bug.
export function applyEvent(state: HandState, event: HandEvent): HandState;

// Throws. The ONLY writer of derived state, and the last statement of applyEvent.
// Recomputes, in this order: round.closed, actorSeat, pendingUncalled, pendingStreet,
// pots, potTotal, phase; then asserts chip and pot conservation.
export function finalize(state: HandState): HandState;

// Throws. For trusted logs the engine produced itself.
export function foldEvents(events: readonly HandEvent[]): HandState;

// Throws. Money.sum(stacks) + potTotal(unawarded pots) + totalRake + totalFees
//   === Money.sum(startingStacks).
// Holds after EVERY event, including mid-award with a mix of awarded and unawarded pots,
// and with a fee charged on some pots but not others.
export function assertChipConservation(state: HandState): void;

// Throws. The standing per-seat identity, checked after every event:
//   stack === startingStack - totalContribution + wonGross - rakePaid - feePaid
//   stack >= 0
//   status === 'ALL_IN'  =>  totalContribution === startingStack   (NOT stack === ZERO:
//     settlement credits an all-in winner's stack without un-committing it)
//   streetContribution === contributionByStreet[state.street]
export function assertSeatLedgers(state: HandState): void;
```

### 4.15 `commands.ts`

```ts
// Result. Pure precondition check with no event construction, so the UI can enable and
// disable keys without dry-running. Never throws.
export function validateCommand(state: HandState, command: HandCommand): EngineResult<null>;

// Result. Emits the USER event, folds it, then drains the engine cascade into the SAME
// commandSeq to a fixed point (Rules 7.10). Bounded by a hard iteration limit with an
// invariant throw, so a termination bug fails loud instead of hanging.
export function expandCommand(
  state: HandState,
  command: HandCommand,
  meta: { readonly commandSeq: number; readonly startSeq: number },
  ids: IdFactory,
): EngineResult<readonly HandEvent[]>;

// Result. Command group 0, always in this order: HAND_STARTED, PLAYER_DEALT_IN per
// dealt-in seat ascending, POST_ANTE per dealt-in seat in ring order from the small blind
// (when ante.enabled), POST_DEAD_BLIND per supplied seat in the same ring order,
// POST_SB, POST_BB — then the same engine cascade, so a table where
// the antes put everyone all-in lands in AWAITING_BOARD rather than an impossible
// AWAITING_ACTION. Errors INVALID_CONFIG, NOT_ENOUGH_PLAYERS, TOO_MANY_PLAYERS,
// NO_BUTTON_SEAT, BUTTON_SEAT_NOT_DEALT_IN, STACK_NOT_POSITIVE, DUPLICATE_PLAYER, and
// AMOUNT_OUT_OF_RANGE — per stack AND for the roster's TOTAL, checked on plain numbers
// before the first emit so Money.sum can never throw out of a Result-returning function.
// For options.blindOverride and options.deadBlinds it additionally errors
// SEAT_NOT_DEALT_IN, BLIND_OVERRIDE_INVALID, BLIND_OVERRIDE_ON_BUTTON,
// POSITION_LINEUP_UNSUPPORTED, DUPLICATE_DEAD_BLIND and AMOUNT_OUT_OF_RANGE. A bad
// dead-blind post rejects the WHOLE hand start; it is never silently dropped.
export function buildStartEvents(
  table: TableState,
  options: StartHandOptions,
  ids: IdFactory,
): EngineResult<readonly HandEvent[]>;

// Total. 0 unless phase === 'AWAITING_BOARD'; otherwise boardCardsForStreet(pendingStreet).
// Drives the palette's automatic open and close (docs/UX.md).
export function expectedBoardCardCount(state: HandState): number;
```

### 4.16 `hand.ts`

```ts
// Result. Wraps buildStartEvents + foldEvents.
export function startHand(
  table: TableState,
  options: StartHandOptions,
  ids: IdFactory,
): EngineResult<Hand>;

// Result. CONTRACT: never throws for any HandCommand value that type-checks. Deliberately
// does NOT catch invariant throws from the reducer — a rules bug must fail loud, and the
// web app wraps the table in an error boundary.
export function applyCommand(hand: Hand, command: HandCommand, ids: IdFactory): EngineResult<Hand>;

// Result. Short-circuits on the first Err. Test and fixture ergonomics.
export function applyCommands(
  hand: Hand,
  commands: readonly HandCommand[],
  ids: IdFactory,
): EngineResult<Hand>;

// Total. False while only command group 0 remains: undoing the hand start is
// "discard the hand", a session-level operation, not an in-hand undo.
export function canUndo(hand: Hand): boolean;

// Total. commandCount - 1: how many times `Z` can still be pressed.
export function undoDepth(hand: Hand): number;

// Result. Drops every event whose commandSeq equals the maximum, then re-folds from
// scratch. No inverse operations, no drift. Never renumbers or regenerates ids on the
// surviving events, so the log stays byte-identical (ADR-0007). Errors NOTHING_TO_UNDO.
export function undo(hand: Hand): EngineResult<Hand>;

// Result. STRICT rehydration: every action event is re-validated as if it were the
// corresponding command, and every engine event must be one the state actually owed.
// This is the round-trip guarantee Phase 11 needs. Errors CORRUPT_LOG with context.seq
// and context.eventKind.
export function replayHand(events: readonly HandEvent[]): EngineResult<Hand>;

// Result. STRUCTURAL rehydration for the DB: applies events, asserting only arithmetic
// identities and chip/pot conservation, never rule-dependent legality. A corrected rule
// therefore never makes stored history unloadable. Errors CORRUPT_LOG.
export function loadHand(events: readonly HandEvent[]): EngineResult<Hand>;

// Result. State at any command boundary — time travel for the replay UI, and the natural
// place a UI-level redo stack keeps the dropped tail.
export function handAtCommand(hand: Hand, commandSeq: number): EngineResult<Hand>;

// Result. A whole hand as a command list with the failing index reported. The Phase 11
// parser's and the test suite's main entry point.
export function replayCommands(
  table: TableState,
  options: StartHandOptions,
  commands: readonly HandCommand[],
  ids: IdFactory,
): EngineResult<Hand>; // error context carries the failing command index
```

### 4.17 `metrics.ts`

```ts
export function remainingStack(state: HandState, seat: SeatIndex): MilliBB; // Total

// Total. Money.min of the two seats' stacks on the chosen basis. The unambiguous
// pairwise definition; 'STARTING' is what gto-core buckets, 'REMAINING' is what the
// table displays.
export function effectiveStackBetween(
  state: HandState,
  a: SeatIndex,
  b: SeatIndex,
  basis: StackBasis,
): MilliBB;

// Total. Documented multiway convention: Money.min(own, max over OTHER contenders) —
// "versus the deepest live opponent". ZERO when no other contender remains.
export function effectiveStackFor(state: HandState, seat: SeatIndex, basis: StackBasis): MilliBB;

// Total. Money.ratio(effectiveStackFor(seat,'REMAINING'), potTotal). A plain number, not
// money (CLAUDE.md rule 1); null when the pot is zero.
export function spr(state: HandState, seat: SeatIndex): number | null;

// Total. Money.ratio(callAmount, potBeforeAction + callAmount). Null on a zero denominator.
export function potOdds(state: HandState, seat: SeatIndex): number | null;

// Total. Money.ratio(totalContribution, startingStack). Null when startingStack is zero.
export function committedFraction(state: HandState, seat: SeatIndex): number | null;

// Total. Board plus every known holding. The palette disables exactly this set, so
// duplicates are impossible by construction (docs/UX.md).
export function deadCards(state: HandState): readonly Card[];
```

### 4.18 `view.ts`

```ts
// Total. Pure and memoizable on `hand`. The UI's only read function. Introduces no rule
// that is not already in state/betting/metrics.
export function toView(hand: Hand): HandView;

// Result. Picks BET or RAISE from the actor's LegalActions, so the `R` key handler is one
// line and the UI never has to know the difference. The parser keeps using the explicit
// verbs so a mismatch with the hand history is caught.
export function wagerCommand(view: HandView, toAmount: MilliBB): EngineResult<HandCommand>;
```

### 4.19 `serialization.ts`

```ts
export type JsonValue =
  null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export const tableConfigSchema: z.ZodType<TableConfig>;
// z.discriminatedUnion('kind', [...]) over the 19 members, with a compile-time `satisfies`
// assertion that the inferred type is assignable to HandEvent and back. Money fields
// validate as safe integers within +/-MAX_MILLI_BB before branding; cards as 0..51;
// seats as 0..5.
export const handEventSchema: z.ZodType<HandEvent>;

// Total. Structurally a clone — every branded type is already a JSON primitive. It exists
// so the DB layer has one named boundary.
export function encodeHandEvent(event: HandEvent): JsonValue;
export function encodeHandEvents(events: readonly HandEvent[]): readonly JsonValue[];

// Result. NEVER throws. Foreign data (SQLite rows, parser output, fixtures) is expected
// to be wrong sometimes.
export function decodeHandEvent(raw: unknown): EngineResult<HandEvent>;

// Result. Also checks that `seq` is dense and ascending from 0 and that `commandSeq` is
// non-decreasing. Errors CORRUPT_LOG with context.seq.
export function decodeHandEvents(raw: unknown): EngineResult<readonly HandEvent[]>;

// Result. JSON.parse(JSON.stringify(encode(...))) then decode, asserting deep equality.
// Exported (not test-only) so Phase 3's DB integration tests can assert the property
// against real rows.
export function jsonRoundTrip(events: readonly HandEvent[]): EngineResult<readonly HandEvent[]>;
```

---

## 5. The validation contract, in one rule

> **Input the engine did not produce gets a `Result`. State the engine did produce gets an
> assertion.**

- **`Result`** — everything a user can type or a parser can emit: `validateCommand`,
  `applyCommand`, `startHand`, every `table.ts` mutator, `validateTableConfig`,
  `wagerToForPotFraction`, `planAwards`, `undo`, `replayHand`, `loadHand`, `decode*`.
- **Throws via `invariant()`** — everything only a bug can cause: `applyEvent` on an event
  impossible in the current phase, a wager `amount` that does not equal
  `toAmount − streetContributionBefore`, an `ALL_IN` whose `amount` is not the whole stack,
  a board deal while `pendingUncalled` is non-null, a negative stack, broken chip
  conservation, broken pot conservation, `asSeatIndex` out of range, `assertNever`.
- **`replayHand` / `loadHand` are the only places an invariant throw is caught** and converted
  to `CORRUPT_LOG`, precisely because their input is foreign.
- **`applyCommand` deliberately does not catch.** Converting a loud engine bug into a plausible
  error string would make the user mistake it for their own mistake.
- **`Money` throws** on non-integer or out-of-range values, so every path from user input to a
  `Money` call pre-validates: `validateWagerTo`, `previewWager`, `wagerToForPotFraction`,
  `seatPlayer`, `setSeatStack`, `composeStartEvents` and `planAwards` bound-check against
  `MAX_MILLI_BB` and return `AMOUNT_OUT_OF_RANGE` **before** any arithmetic. Two of those
  checks are on an **aggregate**, not a single typed value, because a per-value check is not
  enough: six individually legal stacks can sum past `MAX_MILLI_BB` (`seatPlayer` /
  `setSeatStack` guard the table total, `composeStartEvents` guards the roster's), and a
  fraction applied to a legal pot can leave the range (`wagerToForPotFraction` guards the
  product, the sum with `round.currentBet`, and — under `'exact'` — the product's
  integrality).

---

## 6. Event model summary

- A hand is an ordered `HandEvent[]`. `HandState` is the fold. Undo is
  drop-last-command-group-and-refold. **There are no inverse operations anywhere.**
- `EventMeta` is `{ id, seq, commandSeq, origin }`. `id` from the injected `IdFactory`
  (ADR-0007); `seq` dense and ascending from 0; `commandSeq` groups one logical user command;
  `origin` marks USER vs ENGINE.
- Origin by kind — **USER:** `HAND_STARTED`, `FOLD`, `CHECK`, `CALL`, `BET`, `RAISE`, `ALL_IN`,
  `FLOP_DEALT`, `TURN_DEALT`, `RIVER_DEALT`, `HOLE_CARDS_SET`, and `POT_AWARDED` when the user
  supplied the winners. **ENGINE:** `PLAYER_DEALT_IN`, `POST_ANTE`, `POST_DEAD_BLIND`,
  `POST_SB`, `POST_BB`, `RETURN_UNCALLED`, `HAND_FINISHED`, and `POT_AWARDED` when
  auto-awarded. `POST_DEAD_BLIND` is engine-emitted but never engine-*decided*: it exists
  only for a seat the caller explicitly listed in `StartHandOptions.deadBlinds` (ADR-0031).
- **Deliberately not stored:** no `allIn` or `fullRaise` flag on any event (all-in-ness is
  `stackAfter === 0`); no `BETTING_ROUND_CLOSED`; no `STREET_ADVANCED` (the deal event _is_ the
  transition); no `position` on `PLAYER_DEALT_IN` (positions are recomputed on every replay and
  never persisted); no timestamps (the `hand_events` row carries those in Phase 3).
- **Deliberate redundancy, cross-checked:** wager events carry both `toAmount` and `amount`;
  `POT_AWARDED` carries `grossAmount`, `rake`, `fee`, `netAmount` and `shares`. The reducer
  asserts only the _arithmetic_ identities (`amount === toAmount − streetContributionBefore`,
  `net === gross − rake − fee`, `Money.sum(shares) === net`, `gross === pot.amount`) — never
  rule-dependent policy, so a corrected rule cannot retroactively invalidate stored hands.
  `HAND_FINISHED` likewise carries `totalRake` and `totalFees` as two separate amounts, and
  the reducer asserts each against what it accumulated.
- One `F` keystroke that ends a hand produces a four-event command group —
  `FOLD, RETURN_UNCALLED, POT_AWARDED, HAND_FINISHED` — and one `Z` removes all four.

---

## 7. Rules and invariants

Everything in this section is normative. Where a rule could reasonably differ between rooms it
names the `TableConfig` flag that controls it, and the same flag appears in section 8.

### 7.1 Clockwise order

**Clockwise = ascending physical seat index modulo 6.** Stated once, in `seat.ts`, and every
ordering in the engine — action order, ante posting order, position assignment, odd-chip order —
is built from `orderClockwise` / `rotateToSeat`. Nothing else in the package re-derives it.

Dealt-in seats are `occupancy === 'ACTIVE'` **and** `playerId !== null` **and** `stack > 0`.
`SITTING_OUT` and `EMPTY` seats are excluded structurally: they post nothing, receive no cards,
and never appear in an action order.

### 7.2 Action legality

`FOLD` is legal whenever it is the seat's turn, even facing no bet.

`CHECK` is legal iff `callAmount(seat) === ZERO`. Otherwise `CHECK_NOT_ALLOWED`.

`CALL` is legal iff `callAmount(seat) > ZERO`. Otherwise `CALL_NOT_ALLOWED` (the UX `C` key
checks instead — that decision belongs to the UI, driven by `callAmount === 0`). A call for more
than the seat's stack is **accepted and clamped**, recorded as `CALL` with the smaller `amount`,
never rewritten to `ALL_IN`: the stored verb is the verb the user pressed (`CLAUDE.md` rule 3).

`BET` requires `round.currentBet === ZERO`; otherwise `BET_NOT_ALLOWED`.
`RAISE` requires `round.currentBet > ZERO`; otherwise `RAISE_NOT_ALLOWED`.

Any aggression (`BET`, `RAISE`, or an `ALL_IN` that classifies as one) additionally requires
`mayAggress(seat)`:

1. `mayReopen(seat)` — see 7.4. Otherwise `RAISE_NOT_REOPENED`.
2. At least one **other** contender has chips behind (`status === 'IN_HAND'`), unless
   `rules.allowRaiseWithNoCaller` is true. Otherwise `NO_OPPONENT_CAN_RESPOND`. _(Heads-up
   against an opponent already all-in, the only legal actions are call and fold.)_
3. `stack > ZERO`. Otherwise `SEAT_ALL_IN`.

`ALL_IN` is a wager to `maxWagerToAmount(seat)`. When that value is `<= round.currentBet` it
functions as a call and requires none of the aggression conditions. When it exceeds
`round.currentBet` it is aggression and must satisfy them.

**Validation order** (fixed, so error codes are predictable):
phase is `BETTING` (`NOT_BETTING_PHASE` / `HAND_ALREADY_FINISHED`)
→ seat is dealt in (`SEAT_NOT_DEALT_IN`)
→ seat is `actorSeat` (`NOT_ACTORS_TURN`)
→ seat status (`SEAT_ALREADY_FOLDED` / `SEAT_ALL_IN`)
→ verb legality (the codes above)
→ `toAmount` is a safe integer within `±MAX_MILLI_BB` (`AMOUNT_OUT_OF_RANGE`, **before** any
`Money` call)
→ `toAmount > round.currentBet` for aggression (`AMOUNT_NOT_INCREASING`)
→ `toAmount <= maxWagerToAmount` (`INSUFFICIENT_STACK`, `context.max` populated)
→ `toAmount >= minWagerToAmount` **or** `toAmount === maxWagerToAmount`
(`AMOUNT_BELOW_MINIMUM`, `context.min` populated).

That last line is the whole short-raise rule: **a wager below the minimum is legal only when it
is the seat's entire stack.**

### 7.3 Minimum legal raise under raise-TO semantics

`docs/UX.md` fixes the semantics: every wager event's `toAmount` is the seat's street
contribution **after** the action, and `amount = toAmount − streetContributionBefore`.

```
maxWagerToAmount(seat) = streetContribution + stack

minWagerToAmount(seat):
  facing no bet (round.currentBet === ZERO):
      config.minBet
  facing a bet:
      'CURRENT_BET'      ->  round.currentBet + round.lastFullRaiseSize
      'LAST_FULL_RAISE'  ->  let m = round.lastFullRaiseTo + round.lastFullRaiseSize
                             m > round.currentBet ? m
                                                  : round.currentBet + round.lastFullRaiseSize
```

`minWagerToAmount` is **never clamped to the stack**: the true legal minimum is reported even
when unreachable. When `minWagerToAmount > maxWagerToAmount`, `legalActions().wager` is still
non-null with `onlyAllIn: true` and `minToAmount === maxToAmount === maxWagerToAmount`.

`round.lastFullRaiseSize` is seeded to `config.blinds.bigBlind` preflop and `config.minBet`
postflop, and is updated **only** by a full bet or raise, to `toAmount − currentBetBefore`.

Worked examples (NL50, milliBB):

| Situation                    | `currentBet` | `lastFullRaiseSize` | min raise-TO                   |
| ---------------------------- | ------------ | ------------------- | ------------------------------ |
| Preflop, blinds posted       | 1000         | 1000                | 2000                           |
| After an open to 3000        | 3000         | 2000                | 5000                           |
| After a 3bet to 9000         | 9000         | 6000                | 15000                          |
| Postflop, no bet             | 0            | 1000                | 1000 (this is the min **bet**) |
| Postflop after a bet of 5000 | 5000         | 5000                | 10000                          |

### 7.4 The short all-in does not reopen the betting

`round.fullRaiseCount` starts at **1 preflop** (the big blind is the bring-in) and **0
postflop**, and increments **only** on a full bet or raise. Each seat carries
`actedAtFullRaiseCount: number | null`, set to `round.fullRaiseCount` **after** any increment
whenever the seat voluntarily acts, and left `null` by blind and ante posts.

```
mayReopen(seat) = seat.actedAtFullRaiseCount === null
               || seat.actedAtFullRaiseCount < round.fullRaiseCount
```

A **full** bet/raise (`toAmount − currentBet >= lastFullRaiseSize`, or `toAmount >= config.minBet`
when facing no bet) sets `currentBet = toAmount`, `lastFullRaiseSize = toAmount − currentBetBefore`,
`lastFullRaiseTo = toAmount`, and `fullRaiseCount += 1`.

A **short** all-in raise sets `currentBet = toAmount` — the amount to call **does** go up — but
leaves `lastFullRaiseSize`, `lastFullRaiseTo` and `fullRaiseCount` **unchanged**.

Consequences, with no additional rule anywhere:

- A seat that already acted at the current `fullRaiseCount` and now faces a short all-in has
  `streetContribution < currentBet` (so `mustAct` is true) and `mayReopen` false — **call or
  fold only**.
- A seat that has not yet acted this round has `actedAtFullRaiseCount === null` — it **may still
  raise**.
- Blind posters keep `null`, so the big blind gets its option after limps with no
  `bigBlindOptionUsed` flag anywhere.
- The raiser's own flag is stamped with the _new_ count, so a player can never re-raise itself.

Worked example (NL50, milliBB). BB posted 1000. UTG raises to 3000 (full: increment 2000 ≥ 1000)
→ `fullRaiseCount 1→2`, `lastFullRaiseSize 2000`, `lastFullRaiseTo 3000`, `UTG.actedAt = 2`. CO
calls 3000 → `CO.actedAt = 2`. BTN all-in to 4000 (increment 1000 < 2000, short) →
`currentBet 4000`, `fullRaiseCount` stays 2, `BTN.actedAt = 2`. Now SB and BB (`actedAt === null`)
may raise; UTG and CO may only call 1000 more or fold. Under the default
`shortAllInMinRaiseBasis: 'CURRENT_BET'`, SB's minimum raise-TO is `4000 + 2000 = 6000`; under
`'LAST_FULL_RAISE'` it is `3000 + 2000 = 5000`.

### 7.5 Preflop round seeding

```
round.currentBet        = rules.shortBlindSetsFullLevel
                            ? Money.max(config.blinds.bigBlind, highest live blind posted)
                            : highest live blind posted
round.lastFullRaiseSize = config.blinds.bigBlind
round.lastFullRaiseTo   = round.currentBet
round.fullRaiseCount    = 1
round.lastAggressorSeat = blinds.bigBlindSeat
round.lastActedSeat     = null
round.actionOrder       = preflopActionOrder(dealtIn, blinds)
```

Posting less than a full blind does **not** lower the price of entry when
`shortBlindSetsFullLevel` is true (the default): the blind establishes the bet regardless of
whether its poster can cover it, and the excess forms a side pot.

`round.currentBet` is therefore a **price**, not an obligation. It is the only value in the
engine that can exceed every seat's actual street contribution — every other writer
(`advanceRoundForWager`) sets it to a wager that really happened. `callAmount` /
`fullCallAmount` / `minWagerToAmount` all key off it, which is what makes an entering seat
pay the nominal 1 BB. **Round closure does not**, because nobody owes chips to a price no
opponent could post; see 7.6.

### 7.6 Betting-round completion

```
highestOpposingContribution(seat) =
    max over dealt-in seats other than `seat` with status !== 'FOLDED'
        of streetContribution                                      (ZERO when none)

mustAct(seat) = seat.status === 'IN_HAND'
             && ( seat.streetContribution < highestOpposingContribution(seat)
                  || ( seat.actedAtFullRaiseCount === null
                       && seatsAbleToAct(state).length >= 2 ) )

isBettingRoundClosed(state) = no dealt-in seat satisfies mustAct
```

Clause 1 tests a **real obligation** — money a live opponent actually wagered — and
deliberately **not** `round.currentBet`. The two are identical everywhere except under
`rules.shortBlindSetsFullLevel` (7.5), where the price of entry is nominal. Keying closure
off `currentBet` there puts a seat on the clock that has already matched every opponent and
that nobody can raise (`legalActions` reports `wagerBlockedBy: 'NO_OPPONENT_CAN_RESPOND'` in
the same breath): folding would forfeit chips no poker rule can take, and calling would write
a `CALL` into `state.actions` for an action that never happened — the action-tree corruption
`docs/ARCHITECTURE.md` matching criterion 4 and `CLAUDE.md` rule 3 both forbid. Three shapes
this covers, all with `shortBlindSetsFullLevel: true`:

- heads-up, button/SB 100 BB against a big blind all-in for 0.4 BB — the button's 0.5 already
  covers the 0.4, so 0.1 is returned and the board runs; the button is never asked to act;
- heads-up, SB all-in for 0.3 BB against a big blind for 0.4 BB — after the 0.1 uncalled
  return both seats are square at 0.3 and the round is over before anyone acts;
- six-handed folded around to the small blind behind an all-in short big blind — the SB's 0.5
  covers the 0.4 and the hand goes to the board.

Folded seats are excluded because their chips are dead money in the pot: they fund the layers
they reached but can never demand a response. (They ARE included in the uncalled-return
maximum, 7.7, which is a different question — whose money is unmatched, not who owes it.)

The predicate still covers every degenerate case uniformly:

- everyone but one has folded — nobody owes chips and nobody is unacted with an opponent;
- everyone is all-in — no seat has `status === 'IN_HAND'`;
- a lone chipped player facing all-in opponents — the `>= 2` guard keeps them off the clock
  unless they still owe chips (in which case they must call or fold, and `mayAggress` denies a
  raise);
- a big blind who limped around to — `actedAtFullRaiseCount === null`, so the round stays open
  for its option;
- a seat that genuinely faces action behind a short blind — some live opponent's contribution
  is ahead of its own, so it acts, and `callAmount` still charges it the nominal 1 BB.

`nextActor` walks `round.actionOrder` from one index past `round.lastActedSeat` (from index 0
when it is null) and returns the first seat where `mustAct` holds. It is pure index arithmetic
over an array — never `Set`/`Map` iteration — so it is deterministic by construction.

### 7.7 Uncalled-bet return

At round close, over **all dealt-in seats including folded ones**, using the **current street's**
contributions:

```
top    = max(streetContribution)
second = max(streetContribution among the seats that do not hold `top`)
return  iff exactly one seat holds `top` and top > second
amount  = top − second
```

The event decrements that seat's `streetContribution` **and** `totalContribution` and increments
its `stack`, so the pot never contains uncalled money and no phantom side pot ever appears.

Including folded seats is deliberate and is the only correct reading. `BTN raises to 3, everyone
folds`: `top = 3` (BTN), `second = 1` (the folded big blind's post) → return `2`, leaving a pot
of `0.5 + 1 + 1 = 2.5`. That is what a real hand history reports, and it is the correct rake
basis. Computing over contenders only would return `3` and rake a `1.5` pot.

Other shapes covered by the same formula: an open nobody called; a shove only partly called by a
shorter stack (100 BB shove called for 40 returns 60); a tie at the top (no return).

The reducer refuses (throws) any board deal while `state.pendingUncalled !== null`, so "return
before you deal" is an asserted state-machine edge, not a convention.

### 7.8 Street transitions

Street is advanced by the reducer, never by an event of its own. The **deal event is the
transition**.

On round close, in this order:

1. `computeUncalledReturn` non-null → phase `AWAITING_UNCALLED_RETURN`; the command layer emits
   `RETURN_UNCALLED` within the same command group.
2. `contenders(state).length === 1` → auto-award every pot (`autoAwardUncontested`) and finish
   with `reason: 'ALL_FOLDED'`.
3. `state.street === 'RIVER'` → phase `AWAITING_AWARD`; the winners are an **input** in Phase 1.
4. otherwise → phase `AWAITING_BOARD` with `pendingStreet = nextStreet(street)`.

On the board deal event: append the cards, set `street = pendingStreet`, roll each seat's
`streetContribution` into `contributionByStreet`, zero `streetContribution`, clear every
`actedAtFullRaiseCount`, and `openBettingRound`. Then re-evaluate: if `seatsAbleToAct < 2` the
new round is immediately closed and the machine falls through to (3) or (4) again — that is the
all-in run-out, dealt street by street with `actorSeat === null` and nobody ever put on the
clock. There is no "Go to Flop" button; reaching a street simply requests the cards it needs
(`docs/UX.md`).

Board-card counts are `FLOP 3`, `TURN 1`, `RIVER 1`. `DEAL_BOARD` with the wrong count is
`WRONG_CARD_COUNT`; a card already in `deadCards(state)` is `DUPLICATE_CARD`.
`state.board.length` is invariantly one of `0, 3, 4, 5`.

### 7.9 Ante and blind posting order

Command group 0 is always, in this exact order:

1. `HAND_STARTED`
2. `PLAYER_DEALT_IN` — one per dealt-in seat, **ascending physical seat index** (this is the
   order a hand history lists `Seat n:` lines and the grain of Phase 3's `hand_players`)
3. `POST_ANTE` — when `config.ante.enabled`, one per dealt-in seat in **ring order starting at
   the small-blind seat** (equivalently: from the seat left of the button; heads-up that is the
   button itself)
4. `POST_DEAD_BLIND` — one per seat named in `StartHandOptions.deadBlinds`, in the **same ring
   order from the small-blind seat**. Never inferred: a seat with no entry posts nothing
   (ADR-0031)
5. `POST_SB`
6. `POST_BB`

Every posted amount is `Money.min(nominal, seat.stack at that moment)`, so a seat that cannot
cover its ante or blind simply posts less and becomes `ALL_IN` — no special case downstream.
The **actual** amount posted is what the event records. A dead blind is clamped the same way,
with one addition: a seat the ante already left with nothing emits **no event at all** rather
than a zero-amount post, because nothing moved and a zero post would not survive a strict
replay.

**Antes and dead blinds increase `deadContribution` and `totalContribution` but NOT
`streetContribution`.** You do not call an ante, so it must not affect the preflop call amount —
yet it must count toward a player's contribution level for side-pot layering, so a player all-in
for part of an ante ends up eligible for exactly the smallest pot layer. Blinds increase
`streetContribution` and `totalContribution`. That one split makes both behaviours fall out with
no special-casing anywhere else.

A dead blind takes **exactly** the ante's path through the reducer — the same `applyPost(dead:
true)`, including the case where it takes the whole stack and leaves the seat `ALL_IN`. There is
deliberately no config gate: a dead blind is explicit user input, not a table setting. Only the
**dead** portion of a returning player's post is modelled; a live portion is an ordinary blind
post, and there is no combined event.

### 7.10 The command cascade

`expandCommand` emits the USER event, folds it, then drains engine-derived consequences into the
**same** `commandSeq`, to a fixed point:

```
loop (hard-bounded; exceeding the bound is an invariant throw):
  pendingUncalled non-null            -> RETURN_UNCALLED
  contenders === 1 && unawarded pots  -> POT_AWARDED per pot (autoAwardUncontested)
  no unawarded pot && not finished    -> HAND_FINISHED
  otherwise                           -> stop
```

Board cards are **never** auto-emitted — the engine parks in `AWAITING_BOARD` and waits for the
palette. Contested pots are **never** auto-awarded — hand evaluation is out of scope, so the
winner is an input.

Auto-award fires only when `contenders(state).length === 1`, i.e. **every** remaining pot has a
single eligible seat. That guarantees rake is computed exactly once per hand, over the whole
pot, with one cap. When more than one contender remains, the user supplies
`AWARD_POTS { awards }` covering **every** unawarded pot in one command (the view pre-fills any
pot with a single eligible seat).

Undo drops the whole group: one `Z` after a hand-ending fold removes `FOLD`,
`RETURN_UNCALLED`, `POT_AWARDED` and `HAND_FINISHED` together.

### 7.11 Position derivation for 6 / 5 / 4 / 3 / 2 dealt-in players

Let `order = rotateToSeat(dealtInSeats in ring order, buttonSeat)`, so `order[0]` is the button,
and let `n = order.length`.

**Blinds.**

- `n >= 3`: `smallBlindSeat = order[1]`, `bigBlindSeat = order[2]`.
- `n === 2` (with `rules.headsUpButtonPostsSmallBlind`, the default and universal rule):
  `smallBlindSeat = order[0]` (the button), `bigBlindSeat = order[1]`.

Both are the **ordinary rotation**, used whenever no `BlindSeatOverride` is supplied.

**Labels.** `order[0]` is the button. For `n >= 3`, `order[1] = 'SB'` and `order[2] = 'BB'`; the
remaining non-blind seats take the ladder `['BTN', 'CO', 'HJ', 'UTG']` walked **backwards from
the button**: `order[0] = 'BTN'`, `order[n-1] = 'CO'`, `order[n-2] = 'HJ'`, `order[n-3] = 'UTG'`.
For `n === 2` the labels come from `blinds`, never from ring position, so `position` can never
contradict `blindRole`: the seat that posts the small blind takes `rules.headsUpButtonLabel`
(default `'BTN'`) when it is the button and `'SB'` when it is not, and the other seat takes
`'BB'`. Under the default `headsUpButtonPostsSmallBlind` that is `order[0] = 'BTN'`,
`order[1] = 'BB'`; with the flag off the button posts the BIG blind and is labelled `'BB'`
while `order[1]` is labelled `'SB'`.

Anchoring the late positions to the button is what keeps 5-handed `CO` meaning the same seat as
6-handed `CO`, which is what solver lookups need.

| Dealt in | Ring order from the button | Preflop action order             |
| -------- | -------------------------- | -------------------------------- |
| 6        | BTN SB BB UTG HJ CO        | UTG HJ CO BTN SB BB              |
| 5        | BTN SB BB HJ CO            | HJ CO BTN SB BB                  |
| 4        | BTN SB BB CO               | CO BTN SB BB                     |
| 3        | BTN SB BB                  | BTN SB BB                        |
| 2        | BTN(+SB) BB                | BTN SB _(the button acts first)_ |

**Action orders.**

- Preflop, `n >= 3`: `[...order.slice(3), order[0], order[1], order[2]]` — first to act is the
  seat after the big blind.
- Preflop, `n === 2`: `order` itself — the button/small blind acts first.
- Postflop, all `n`: `[...order.slice(1), order[0]]` — first live seat left of the button, button
  last. Heads-up this correctly yields `[BB, button]`.

**Manual blind override (ADR-0031).** `StartHandOptions.blindOverride` names the SB and BB
seats explicitly, is persisted on `HAND_STARTED`, and is fed to `assignBlinds` on every replay.
It is always **user input**: the engine never derives one, because who owes a blind after
sitting out differs per room and no fixture has confirmed CoinPoker's rule. It is validated,
never trusted — both seats dealt in (`SEAT_NOT_DEALT_IN`), distinct
(`BLIND_OVERRIDE_INVALID`), and with three or more dealt in neither may be the button
(`BLIND_OVERRIDE_ON_BUTTON`; that is the dead-button case, still unmodelled).

- **Heads-up the override wins** over `rules.headsUpButtonPostsSmallBlind`. An explicit user
  statement outranks a configured default, and heads-up is the one shape where naming the
  button as a blind seat is legal (there is no third seat).
- **Labels move; the postflop seat order does not.** Postflop order is a *button* rule in every
  rulebook; anchoring it to the small blind instead would let a seat between the button and an
  overridden small blind act after the button. Preflop order does follow the override, because
  its single rule is "ring order starting immediately after the **effective** big blind".
- **The engine refuses a lineup it cannot name.** `derivePositionLabels` is the only place a
  `Position` is decided, and it returns a `Result`: if an override yields an arrangement the
  six-member `Position` union cannot label — a seat that would take two positions, a position
  that would go to two seats, or a non-blind seat further from the button than `UTG` — it errors
  `POSITION_LINEUP_UNSUPPORTED` and **the hand does not start**. No label is invented, reused or
  defaulted. This is the load-bearing safety property of the feature: coping silently would mean
  inventing a site rule, and an approximated label would flow straight into a solver lookup.
- **When it _can_ name one, the names are structural, not solver-meaningful.** A non-standard
  arrangement yields a labelling derived from the button and the stated blind seats that may
  correspond to no real lineup. `gto-core` must treat such a hand as `UNSUPPORTED` rather than
  approximating it to the nearest standard lineup. `seatsBeforeButton` / `seatsAfterButton` stay
  meaningful; the `Position` **name** does not.

Positions are recomputed from `HAND_STARTED` on every replay and are **never persisted**.
`SeatPosition.seatsBeforeButton` is exported as the structural, naming-independent lineup key for
`gto-core`.

### 7.12 Pots

`state.pots` is **always a list** with per-pot eligible-player sets, rebuilt by `computePots` on
**every** event from per-seat `totalContribution` rather than accumulated. Take the distinct
positive contribution levels ascending as `L1..Lk` (with `L0 = ZERO`); layer `i` has

```
amount        = Money.sum over all dealt-in seats of
                  Money.sub( Money.min(totalContribution, Li),
                             Money.min(totalContribution, L(i-1)) )
capLevel      = Li
eligibleSeats = seats with totalContribution >= Li and status !== 'FOLDED', ascending
```

Three merge rules are applied while walking the levels upward, and then indices are renumbered
densely with index 0 as `'MAIN'` and the rest `'SIDE'`:

1. a zero-amount layer is dropped;
2. a layer whose eligible set would be **empty** (only folded seats reached that level) is
   merged down into the previous pot — folded players' chips fund the layers they reached but
   confer no eligibility;
3. a layer whose eligible set is **identical to the previous pot's** is merged down too. Two
   layers with the same eligible set are always won by the same candidates, so splitting them
   would be a distinction without a difference. A genuine side pot always changes the eligible
   set, because it exists exactly when a contender is capped below the level above it.

Rule 3 is what makes the ordinary hand collapse to a single main pot: one folded blind plus two
seats matched at a higher level would otherwise report a main pot and a phantom side pot. It
also means a three-way all-in reports **two** pots, not three — the `500` layer above a folded
small blind merges into the main pot. Totals and awards are identical either way.

Because `RETURN_UNCALLED` has already reduced `totalContribution`, an uncalled bet never appears
as a phantom side pot. Because antes are inside `totalContribution`, a player all-in from the
ante is eligible for exactly the smallest layer.

Phase 2 added multi-way award coverage, not a representation change.

**Asserted on every event:** `Money.sum(pot amounts) === Money.sum(totalContributions)`, and
`Money.sum(stacks) + potTotal(unawarded pots) + totalRake + totalFees === Money.sum(startingStacks)`.

### 7.13 Rake

Rake is **configuration, not code** (`docs/GTO_BASELINE.md`, ADR-0009, ADR-0027, ADR-0033).
NL50 preset: `5 / 100`, cap `8000` milliBB (8 BB), `quantum: 20` milliBB (one currency cent at
BB = 0.50), `rounding: 'round'`, `triggerPolicy: 'NO_FLOP_NO_DROP'`.

```
sawFlop  = state.board.length >= 3
rakeable = config.rake.triggerPolicy === 'ALWAYS' || sawFlop

gross     = Money.sum(amount over ALL pots being awarded)          // after uncalled returns
totalRake = rakeable
              ? Money.min( Money.mulRatioQuantized(gross, numerator, denominator,
                                                   quantum, rounding),
                           config.rake.cap )
              : ZERO
```

- The percentage is an **exact rational**, never a float — `Money.mulRatioQuantized` on that
  rational is the only rake expression in the package.
- **The rate is applied and quantized in ONE rounding step** (ADR-0027). Applying the rate to
  milliBB and quantizing the result afterwards rounds **twice**, and the first rounding can push
  the value across the half-way point of the second — landing a whole quantum from the exact
  value. Gross `4190` at `5/100` with `quantum 20` is exactly `209.5`, whose nearest multiple of
  20 is `200`; the two-step form returns `220`. That is one whole cent of real money, so the
  one-step form is not a nicety.
- `quantum` is a **settlement** granularity and is never derived from `DisplayConfig`:
  presentation must not determine money. `quantum: 1` is pure milliBB and makes
  `mulRatioQuantized` an exact identity with `mulRatio`.
- The cap is **per hand**, applied once to the summed gross, because `AWARD_POTS` covers every
  remaining pot in one command.
- The basis is the pot **after** the uncalled bet has been returned, which is standard and needs
  no configuration.
- The **quantum applies to the hand's total rake**, not to each pot's share of it.
  `allocateRake` then splits that already-quantized total across pots so the parts sum
  **exactly**; an individual pot's share is therefore not itself a multiple of `quantum`. Only
  the amount actually taken off the table is quantized, which is the amount a hand history
  reports.
- `allocateRake` splits `totalRake` across pots so the parts sum **exactly**, and asserts that
  no pot is charged more rake than it holds (so `netAmount` can never be negative):
  - `PROPORTIONAL` (default) uses `Money.mulRatio(totalRake, pot.amount, gross, 'floor')` per
    pot with the floor remainder added to pot 0. At the shipped `5/100` rate with at most six
    contributors the main pot provably has room for that remainder; when it would not, the
    excess spills into the next pot rather than producing a negative award. That spill is
    unreachable in every shipped configuration and exists so the precondition is enforced
    rather than merely assumed.
  - `MAIN_POT_FIRST` drains from index 0 upward. **Stated consequence:** when the main pot is
    smaller than the capped rake — e.g. a seat all-in from a partial ante leaves a `600` main
    pot beside a `300000` side pot, and the capped `8000` rake takes the main pot entire — its
    winner is awarded a `netAmount` of ZERO and ends the hand down its own contribution. That
    is what "main pot first" means arithmetically. It is a policy, not an accident, and it is
    why `'PROPORTIONAL'` is the default; correct it through `rake.allocation`, not through
    code (`CLAUDE.md` rule 7). Under `'PROPORTIONAL'` the same hand pays that seat `584`.
- Each pot's `netAmount = grossAmount − rake − fee` is split by `Money.splitEvenly` across the
  winners, with the remainder milliBB handed out one each along `oddChipOrder` (default: first
  winner clockwise from the button).
- The rake **actually applied** is recorded on `POT_AWARDED` and summed into `HAND_FINISHED`, so
  a corrected rule changes configuration and future hands, and never rewrites history.

Worked examples, at the NL50 preset (`quantum 20`, `rounding 'round'`): gross `20000` →
`mulRatioQuantized(20000, 5, 100, 20, 'round') = 1000`, under the cap → rake `1000`, net
`19000`. Gross `200000` → `10000` → capped to `8000`, net `192000`. Gross `19000` → exact `950`,
which is `47.5` quanta → nearest is `48` → rake **`960`**, net `18040`. A hand that ends preflop
under `triggerPolicy: 'NO_FLOP_NO_DROP'` → rake `ZERO`, `waived: true`.

**The splash fee** (ADR-0018, confirmed by ADR-0032) is a **second, separate** deduction, never
folded into the rake:

- `poker-core` knows **no fee trigger**. Under the shipped `fee.triggerPolicy: 'NEVER'` the
  hand's fee is always ZERO; under `'MANUAL'` the whole hand's fee is an **observed** amount
  carried on the `AWARD_POTS` command. CoinPoker's real trigger is unknown and must not be
  invented (`CLAUDE.md` rule 7).
- `resolveFee` range-checks that input — `FEE_NEGATIVE`, `FEE_NOT_ALLOWED` (a non-zero fee under
  `'NEVER'`), `FEE_ABOVE_CAP`, `FEE_EXCEEDS_POT` (with the rake it would exceed the pot) — and
  otherwise returns it **exactly as entered**: never quantized, never capped, never clamped.
  `fee.cap` exists to catch a typo, not to state a site rule.
- `allocateFee` uses the **same** allocator as the rake (`allocateAcrossPots`), with each pot's
  ceiling reduced by the rake already taken from it, so no pot is over-charged and `netAmount` is
  never negative. Proportional weights stay the **gross** pot amounts, so the split does not
  shift because an earlier deduction already took some of a pot.
- Within one pot, each winner's `rakePaid` and `feePaid` are attributed by the same rule
  (`splitRakeAcrossShares`), which is how the reducer reproduces the per-seat identity from an
  event that stores only the pot totals.
- The fee **actually applied** is recorded on `POT_AWARDED.fee` and summed into
  `HAND_FINISHED.totalFees`, `SettlementPlan.totalFees`, `HandResult.totalFees` and
  `HandState.totalFees` — always as its own amount, never merged into `totalRake`.

The three settlement identities, all asserted by the engine:

```
per seat, after every event:
  stack === startingStack − totalContribution + wonGross − rakePaid − feePaid

chip conservation, after every event:
  sum(stacks) + potTotal(unawarded pots) + totalRake + totalFees === sum(startingStacks)

settlement balance, at COMPLETE:
  sum(seat net) + totalRake + totalFees === ZERO
```

### 7.14 Effective stack and SPR

- `effectiveStackBetween(a, b, basis)` — `Money.min` of the two seats' stacks on the chosen
  basis. The unambiguous pairwise definition. `'STARTING'` is what `gto-core` buckets into a
  stack depth; `'REMAINING'` (chips **behind**, not behind-plus-committed) is what the table
  shows.
- `effectiveStackFor(seat, basis)` — documented multiway convention:
  `Money.min(own, max over the OTHER contenders)`, i.e. _versus the deepest live opponent_.
  `ZERO` when no other contender remains.
- `spr(seat) = Money.ratio(effectiveStackFor(seat, 'REMAINING'), state.potTotal)` — a plain
  `number`, never money (`CLAUDE.md` rule 1 permits floats for non-money ratios), `null` on a
  zero pot.

`ActionRecord.effectiveStackBefore` is measured at the moment of the action on the `'REMAINING'`
basis. `poker-core` supplies these raw numbers and deliberately defines **no** raise-sizing
convention — that modelling choice belongs to `gto-core`. The one place a fraction is applied is
`wagerToForPotFraction`, a UI input helper with a single explicitly documented formula.

---

## 8. Explicit assumptions

### 8.1 — Poker-rule assumptions

Every entry below is a real-world poker rule that was **chosen, not known**. Each names the
configuration field that corrects it, and a real fixture can falsify any of them. Per
`CLAUDE.md` rule 7, the orchestrator should mirror these into `docs/DECISIONS.md` as ADR
entries.

**These numbers are stable and are cited by index from accepted ADRs.** An assumption is never
renumbered and never reused: a corrected one is rewritten in place (2, 5 and 15 below), and a
new one is appended. Phase 2's new rows therefore start at **19**, because 17 and 18 were
already taken by 8.2.

| #   | Assumption                                                                                                                                         | Default                          | Correcting field                                                       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Minimum re-raise after a **short all-in** is measured from the new current bet, not from the last full bet level.                                  | `'CURRENT_BET'`                  | `rules.shortAllInMinRaiseBasis`                                        | Real cross-site variation. Every hand containing an incomplete all-in followed by a legal re-raise settles differently under the other basis. Needs a Phase 11 fixture. Both branches must be tested.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2   | CoinPoker applies **no-flop-no-drop** (a pot whose board never reached three cards is not raked).                                                  | `'NO_FLOP_NO_DROP'`              | `rake.triggerPolicy`                                                   | Near-universal online but unverified. If wrong, every preflop-decided hand's settlement is off by up to 5% of a small pot — small per hand, systematic across a session. Phase 2 replaced the old boolean with a named `RakeTriggerPolicy` union (ADR-0033), so a further real trigger is additive and `validateTableConfig` rejects a member it cannot implement rather than defaulting to one. The other shipped member is `'ALWAYS'`.                                                                                                                                                                                  |
| 3   | The per-hand rake **cap** applies to the summed pot, and rake is taken **after** the uncalled bet is returned.                                     | cap-per-hand, post-return        | `rake.cap` + the single-`AWARD_POTS` design                            | Post-return is standard. Per-hand vs per-pot is unobservable in Phase 1's single-pot hands.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 4   | Rake is split across side pots **proportionally**, with the floor remainder to the main pot (spilling upward only if the main pot cannot hold it). | `'PROPORTIONAL'`                 | `rake.allocation`                                                      | The alternative `'MAIN_POT_FIRST'` drains index 0 upward and can therefore take a small main pot **in full**, awarding its winner a net of ZERO (see 7.13). That is stated policy, not a defect, and it is why `'PROPORTIONAL'` is the default. Needs a Phase 11 fixture.                                                                                                                                                                                                                                                                                                                                                            |
| 5   | Rake **floors** at milliBB granularity (ADR-0009). **KNOWN WRONG for CoinPoker — superseded by ADR-0027 and by rows 19–21 below. This is NOT the shipped default; it is retained only so the numbering stays stable.** | ~~`'floor'`~~ — shipped default is now `'round'` at `quantum: 20` | `rake.rounding` + `rake.quantum` (rows 19–21)                          | Real NL50 lines record ₮0.27 on a ₮5.37 pot where a milliBB floor yields ₮0.2685: CoinPoker settles in whole currency cents (20 mBB), not milliBB. `'floor'` remains a valid `RoundingMode` for a config that asks for it; it is no longer a claim about CoinPoker, and no shipped preset uses it. What replaces it is rows 19–21: an explicit settlement quantum, nearest-rounding at that quantum, and an explicitly **undetermined** half-way tie-break. ADR-0027's findings stand; only its "blocked, waiting for the fixture" status is retired (ADR-0033).                                                                                         |
| 6   | A big blind all-in for **less than a full big blind** still sets the price to call at the nominal big blind.                                       | `true`                           | `rules.shortBlindSetsFullLevel`                                        | Standard, but rare enough that it may go untested against a real hand until Phase 11. It sets a **price**, not an obligation: a seat that has already matched every live opponent is not put on the clock by it (7.6). So a small blind folded around to behind a 0.4 BB all-in blind never calls at all — its 0.5 BB is already ahead, 0.1 BB is returned, and the board runs. A small blind that _does_ face live action still pays the nominal 1 BB and gets the overcall back. (An earlier draft of this table asserted the phantom 1 BB call and a 0.6 BB return; the money was always identical, the recorded action was not.) |
| 7   | Position labels below six-handed drop the **earliest** seats (5-handed's first actor is `HJ`, not `UTG`).                                          | ladder backwards from the button | _(scheme is fixed; `seatsBeforeButton` is the naming-independent key)_ | All three proposals agreed on this table. If Phase 9's baseline disagrees, stored hands are unaffected (positions are derived, never persisted) but lineup-sensitive tests and UI copy change. `gto-core` should key on `seatsBeforeButton`.                                                                                                                                                                                                                                                                                                                                                                                         |
| 8   | The heads-up button seat is labelled **`BTN`**.                                                                                                    | `'BTN'`                          | `rules.headsUpButtonLabel`                                             | Genuinely contested (some solver sets label it `SB`). `blinds.smallBlindSeat` and `SeatView.isSmallBlind` are always exposed separately, so this is presentation only. The label applies to a heads-up button that posts the **small** blind; under `headsUpButtonPostsSmallBlind: false` the button posts the big blind and is labelled `'BB'`, so `position` and `blindRole` always agree (7.11).                                                                                                                                                                                                                                  |
| 9   | Heads-up, the **button posts the small blind** and acts first preflop, last postflop.                                                              | `true`                           | `rules.headsUpButtonPostsSmallBlind`                                   | Universal; the flag exists only so the special case has exactly one home.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 10  | The **big blind has an option** to check or raise when nobody raised.                                                                              | `true`                           | `rules.bigBlindHasOption`                                              | Universal in cash NLHE.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 11  | A bet or raise is **illegal when no opponent has chips behind** to respond.                                                                        | `false` (not allowed)            | `rules.allowRaiseWithNoCaller`                                         | Near-universal; a few rooms allow it and return the excess.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 12  | The **odd chip** on a split pot goes to the first winner clockwise from the button.                                                                | `'FIRST_LEFT_OF_BUTTON'`         | `rules.oddChipRule`                                                    | At milliBB granularity this may not correspond to how the site rounds real currency at all.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 13  | The ante is **per dealt-in player** (0.16 BB), not a big-blind ante.                                                                               | `'PER_DEALT_IN_PLAYER'`          | `ante.mode`                                                            | `AnteMode` is a union so `BIG_BLIND_ANTE` is additive; `validateTableConfig` **rejects** any mode it does not implement rather than half-implementing it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 14  | Antes are posted in ring order starting at the small blind, before the blinds.                                                                     | fixed                            | _(none — change `buildStartEvents`)_                                   | Ordering is cosmetic for state but matters for hand-history round-tripping in Phase 11.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 15  | The **button moves simply** to the next dealt-in-eligible seat. **Automatic** dead-button and missed-blind rules are **not modelled**.             | fixed                            | `setButtonSeat`, `blindOverride`, `deadBlinds`                         | Real-site behaviour differs per room and must not be guessed (ADR-0031). Phase 2 added the **manual correction path** and nothing more: an explicit `BlindSeatOverride` at hand start (rows 27–28) and explicit `POST_DEAD_BLIND` posts (row 26), both always user input. `advanceButton` still just walks to the next eligible seat, and no rule infers who owes a blind. **Phase 8** owns the user-facing override UX.                                                                                                                                                                                                             |
| 16  | A hand needs **at least two** dealt-in seats and every dealt-in stack must be **> 0**.                                                             | fixed                            | `NOT_ENOUGH_PLAYERS`, `STACK_NOT_POSITIVE`                             | If Phase 8's dirty-stack flow can leave a stack at zero or unknown, this constraint needs revisiting.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 19  | CoinPoker settles rake in whole currency **cents** — 20 milliBB at BB = ₮0.50.                                                                     | `quantum: 20`                    | `rake.quantum`                                                         | ADR-0027; two real hands are consistent with it. **Never derived from `display.bigBlindValue`** — `DisplayConfig` is presentation, and money must not move when a formatting choice does. `withStakeDisplay` therefore takes `rakeQuantum` in its patch (at BB = 1.00 one cent is 10 milliBB).                                                                                                                                                                                                                                                                                                                                       |
| 20  | The rake rate is **quantized to nearest**, not floored or ceiled.                                                                                  | `rounding: 'round'`              | `rake.rounding`                                                        | ADR-0027 falsified ADR-0009's milliBB floor: ₮5.37 → ₮0.27 rules out floor-at-cent, ₮6.87 → ₮0.34 rules out ceil-at-cent. Applied **once**, at `quantum` granularity, via `Money.mulRatioQuantized` — quantizing a milliBB rake afterwards rounds twice and can land a whole quantum out (7.13).                                                                                                                                                                                                                                                                                                                                     |
| 21  | Half-way ties round **away from zero**.                                                                                                            | `'round'`                        | `rake.rounding`                                                        | **No observation distinguishes this** (ADR-0027, ADR-0033): no real hand in evidence is an exact half-cent tie. It is a property of the `RoundingMode`, not a claim about CoinPoker, and must not be presented as one. A fixture containing a tie settles it; until then it stays undetermined.                                                                                                                                                                                                                                                                                                                                      |
| 22  | The per-hand cap is a flat **8 BB** regardless of the dealt-in count.                                                                              | `cap: 8000`                      | `rake.cap`                                                             | ADR-0027 open question: rooms commonly run a short-handed cap schedule. Not invented here — the flat cap is the honest default, not an observation. `validateTableConfig` requires the cap to be an exact multiple of `rake.quantum`, so a capped rake is quantized too.                                                                                                                                                                                                                                                                                                                                                             |
| 23  | The splash fee has **no automatic trigger**.                                                                                                       | `fee.triggerPolicy: 'NEVER'`     | `fee.triggerPolicy`                                                    | ADR-0032: the **accounting shape** is confirmed, the **trigger** is not. `'MANUAL'` takes the amount as observed input on `AWARD_POTS`; the engine never derives one, and `'NEVER'` rejects a non-zero supplied fee outright (`FEE_NOT_ALLOWED`).                                                                                                                                                                                                                                                                                                                                                                                    |
| 24  | A manually supplied fee is bounded only to catch a typo.                                                                                           | `fee.cap: 8000`                  | `fee.cap`                                                              | Not a site rule. Within the cap the amount is stored **exactly as entered** — never re-quantized, capped or clamped (`CLAUDE.md` rule 3). `FEE_ABOVE_CAP` and `FEE_EXCEEDS_POT` reject rather than silently correct.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 25  | One hand's fee is split across side pots **proportionally**, weighted on gross pot amounts.                                                        | `fee.allocation: 'PROPORTIONAL'` | `fee.allocation`                                                       | Same allocator as the rake (`allocateAcrossPots`), with each pot's ceiling reduced by the rake already taken from it. Weights stay the **gross** amounts, so the split does not shift because an earlier deduction took part of a pot. `'MAIN_POT_FIRST'` carries the same stated consequence as it does for rake (7.13).                                                                                                                                                                                                                                                                                                            |
| 26  | Dead blinds are posted **after the antes and before the live blinds**, in ring order from the small blind.                                         | fixed                            | _(none — change `composeStartEvents`)_                                 | Same status as assumption 14: cosmetic for state, load-bearing for hand-history round-tripping later. Group 0 is `HAND_STARTED`, `PLAYER_DEALT_IN`, `POST_ANTE`, `POST_DEAD_BLIND`, `POST_SB`, `POST_BB` (7.9). A dead blind is never inferred — only a seat listed in `StartHandOptions.deadBlinds` posts one (ADR-0031).                                                                                                                                                                                                                                                                                                           |
| 27  | Heads-up, an explicit `BlindSeatOverride` **outranks** `rules.headsUpButtonPostsSmallBlind`.                                                       | the override wins                | `StartHandOptions.blindOverride`                                       | An explicit user statement outranks a configured default, and heads-up is the one shape where naming the button as a blind seat is legal (there is no third seat). With **three or more** dealt in, naming the button is `BLIND_OVERRIDE_ON_BUTTON`: that is the dead button, which stays unmodelled (ADR-0031, assumption 15).                                                                                                                                                                                                                                                                                                      |
| 28  | A non-standard blind arrangement yields a purely **structural** position labelling, not a solver lineup.                                           | refuse, or label structurally    | `POSITION_LINEUP_UNSUPPORTED` + `seatsBeforeButton`                    | `derivePositionLabels` **refuses** any lineup the six-member `Position` union cannot name — the hand does not start, rather than a label being invented (7.11). When it can name one, the names come from the button and the stated blind seats and may match no real lineup: **`gto-core` must treat such a hand as `UNSUPPORTED`**, never approximate it to the nearest standard lineup. `seatsBeforeButton` / `seatsAfterButton` stay meaningful; the `Position` NAME does not (ADR-0031). **The refusal is unreachable for every input `assignBlinds` accepts today** (BTN/SB/BB are always three distinct seats for `n >= 3`, and the heads-up labels are always distinct): it is defence in depth for a future lineup rule, not a gate on present-day input.                                                                                                                                        |

### 8.2 — Architecture and model decisions

These are deliberate design decisions about our own model, **not** unknown real-world poker
rules. No fixture can falsify them; only a design change can revise them.

| #   | Assumption                                                                                | Default | Correcting field | Notes                                                                                                                                                                                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------- | ------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 17  | `HOLE_CARDS_SET { seat, cards, revealed }` replaces `docs/ARCHITECTURE.md`'s `SHOW_CARD`. | —       | _(doc change)_   | One event covers hero's own entry (`revealed: false`) and a showdown reveal (`revealed: true`). Two events for one state field would be worse. **The orchestrator should update the event list in `docs/ARCHITECTURE.md`**, which also implies a street-transition event that this design deliberately drops as derivable. |
| 18  | The engine knows **nothing about time**.                                                  | fixed   | _(none)_         | `hand_events` rows carry timestamps in Phase 3.                                                                                                                                                                                                                                                                            |

---

## 9. What Phase 2 shipped, and what stays deferred

The architecture must not preclude any of these. None of them is stubbed, and none of them
requires a representation change.

**Phase 2 — poker core edge cases: shipped**

- **Multi-way side-pot award coverage — shipped.** `planAwards` validates awards across every
  unawarded pot in one command, and both `rake.allocation` branches are exercised end to end
  through real multi-pot hands (`settlement.ts`, `rake.ts`; `tests/side-pots.test.ts`,
  `tests/multiway-awards.test.ts`, `tests/rake-allocation-branches.test.ts`).
- **Odd-chip behaviour under multiple simultaneous splits — shipped.** `splitPot` +
  `oddChipOrder` in `settlement.ts`, with per-winner deduction attribution through
  `splitRakeAcrossShares`.
- **Dead-blind posts and the manual SB/BB override — shipped as neutral primitives
  (ADR-0031).** `POST_DEAD_BLIND` (`events.ts`, accounting identical to an ante),
  `BlindSeatOverride` persisted on `HAND_STARTED` (`positions.ts`), and
  `StartHandOptions.blindOverride` / `.deadBlinds` (`commands.ts`). Both are **always explicit
  user input**; `POSITION_LINEUP_UNSUPPORTED` refuses any lineup the `Position` union cannot
  name rather than inventing a label (7.9, 7.11, `tests/dead-blinds.test.ts`).
- **Auto top-up boundaries between hands — shipped.** `AutoTopUpPolicy`, `topUpPlan` and
  `applyAutoTopUp` in `table.ts` (`tests/auto-top-up.test.ts`). The intended between-hands
  sequence is `applyHandResult` → `applyAutoTopUp` → `advanceButton`, run once per completed
  hand; top-up before the button search matters, because a seat the policy revives must be
  eligible again when the button looks for the next dealt-in seat.
- **The settlement policy surface — shipped (ADR-0027, ADR-0032, ADR-0033).**
  `rake.triggerPolicy`, `rake.quantum`, `rake.rounding`, a `FeeConfig` separate from
  `RakeConfig`, rake and fees recorded separately end to end, and chip conservation including
  fees. Every unknown is now a named, validated, defaulted policy field, so the fixture — when
  it arrives — is a configuration change and a fixture test, never a code change. See 7.13 and
  assumptions 19–25.

**Still deferred, deliberately**

- **Automatic missed-blind and dead-button rules.** Explicitly **not** implemented (ADR-0031,
  assumption 15). Real behaviour differs per room and no CoinPoker fixture confirms theirs, so
  implementing them would mean inventing site behaviour. The manual primitives above are the
  correction path; **Phase 8** owns the user-facing override UX. With three or more dealt in,
  naming the button as a blind seat is refused (`BLIND_OVERRIDE_ON_BUTTON`) rather than coped
  with.
- **Straddles**, **run-it-twice** and **hand evaluation** all remain deferred — see the Phase 9+
  and Phase 11 entries below.

**Phase 3 — persistence**

- `hand_events` row mapping, per-event timestamps, and quarantining a log that fails
  `loadHand`. `serialization.ts` and `jsonRoundTrip` are the seam.

**Phase 8 — observe / dirty stacks**

- `dirty` per seat, observe mode, Skip Rest, and an audit trail for between-hand stack edits.
  Note the interaction: the engine auto-finishes when contenders drop to one, so Phase 8 needs an
  explicit abandon/dirty path rather than an incomplete event log. Hero folding does not by
  itself reduce contenders to one, so continued recording works today.

**Phase 9+ — strategy**

- Hand evaluation and showdown winner determination. In Phase 1 the winner is an **input**;
  `AWARD_POTS` is where a hand evaluator plugs in later without changing the event shape.
- The raise-sizing-as-fraction-of-pot **convention**. `ActionRecord` supplies `potBefore`,
  `currentBetBefore`, `amount`, `toAmount` and `effectiveStackBefore`; `gto-core` picks the
  convention.

**Phase 11 — parser (deferred past the first usable MVP, ADR-0033)**

Phase 11 is **not a dependency of Phases 2–10**. The real CoinPoker hand-history export is not
being provided, and waiting for it would stall the whole product behind a detail that affects
only the last decimal of a raked pot. The MVP loop — engine, session setup, table, action UX,
card entry, observe mode, GTO scaffolding, strategy UI — needs no parsed hand history. Player
identity stays manual nicknames plus our own observations, and persistent opponent identity is
**never** derived from CoinPoker hand-history IDs. Nothing below is cancelled; it is
rescheduled, and no further forensic reconstruction happens without the fixture.

- **Straddles.** Still not modelled in Phase 1 or the MVP parser. No representation exists
  yet, and none is guessed ahead of a real design pass.
- **Run-it-twice.** The MVP parser MUST parse and preserve run-it-twice text losslessly, in
  a neutral representation — nothing in the source text is discarded. The MVP parser MUST
  NOT require the current single-board `poker-core` to replay a run-it-twice hand: single-run
  hands are replayed through `poker-core`; run-it-twice hands are preserved but not replayed.
  A true multi-board engine — making `board` a list of boards and giving `POT_AWARDED` a run
  index — requires a separate, explicit design decision before any implementation. It is not
  a retrofit, and it is not in the MVP parser's scope.
- **The CoinPoker splash fee.** Real hand-history arithmetic confirms only that the splash fee
  is a separate deduction from the pot payout, and that it is separate from rake. Its trigger
  and its economic purpose remain **unknown** — nothing in the evidence says what it funds. Per
  ADR-0018 it is modelled as its own `FeeConfig`, kept separate from `RakeConfig` and never
  collapsed into it. Ownership is split, and the **Phase 2 half has shipped**: `FeeConfig`,
  `resolveFee` / `allocateFee`, `POT_AWARDED.fee`, `HAND_FINISHED.totalFees`,
  `SeatResult.feePaid` and a chip-conservation invariant that includes fees are all in
  `poker-core` (7.13, assumptions 23–25). **Phase 11** still owns parsing the observed fee
  amount out of CoinPoker hand-history text. The fee's **trigger** semantics — when it applies,
  and how it interacts with the rake cap — remain unknown and are not to be invented, which is
  why the shipped default is `fee.triggerPolicy: 'NEVER'` and `'MANUAL'` takes the amount as
  observed input.
- A lenient ingest path for logs that are legal poker but not canonical under this encoding. The
  `replayCommands` route avoids the problem entirely as long as the parser produces commands
  rather than reconstructing events.

**Not in scope at any phase**

- Anything touching a poker client: screen reading, OCR, capture, automation, scraping. Hard
  product boundary (`CLAUDE.md`).
