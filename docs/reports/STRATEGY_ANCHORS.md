# Strategy Anchors — Public Preflop Reference Verification

Purpose: verify, against publicly and freely accessible poker education pages, the
preflop reference numbers proposed for a deterministic 100bb 6-max NLHE cash reference
strategy. Access date for every source below: **2026-09-01**. Every claim in this
document is backed by a URL that was actually fetched during this research pass, plus a
short quote/paraphrase of what that page states. Nothing here is drawn from model
memory. Positions used: UTG (=LJ in some sources), HJ, CO, BTN, SB, BB.

No GTO Wizard content, no paywalled content, and no bulk range-library scraping was
used. Solver-output aggregator sites (PreflopWizard, FreeBetRange) were read as single
public blog articles for cross-checking percentages only — not treated as primary
"coaching" sources and never bulk-scraped.

---

## 1. Source table

| # | URL | Publisher | Provides | Free access confirmed |
|---|-----|-----------|----------|------------------------|
| S1 | https://pokercoaching.com/preflop-charts/ | PokerCoaching.com | 6-max cash 100bb RFI ranges (hand classes + %), RFI/3bet/4bet sizing (cash), tournament ranges for context | Yes — page loaded with no paywall; text ranges are in-page, not gated behind login |
| S2 | https://nlh.poker/articles/six-max-rfi-range-guide-en | nlh.poker | Qualitative RFI widening statement, 2.5bb sizing note; hand chart is an embedded image, not extractable as text | Yes |
| S3 | https://www.preflopwizard.app/blog/6-max-preflop-charts | Preflop Wizard (blog) | 6-max 100bb RFI % per position, sizing (2.5bb / 3bb SB) | Yes — confirmed no paywall/login gate |
| S4 | https://blog.freebetrange.com/article/preflop-charts-open-raise-in-6-max-poker-cash-games | FreeBetRange (blog) | 6-max RFI % per position, sizing rationale (2.5bb / 3bb SB) | Yes |
| S5 | https://upswingpoker.com/3-bet-strategy-aggressive-preflop/ | Upswing Poker | 3-bet sizing IP vs OOP, linear vs polarized range construction guidance | Yes |
| S6 | https://upswingpoker.com/4-bet-size-strategy/ | Upswing Poker | 4-bet sizing (cash, 100bb) IP vs OOP, and tournament comparison | Yes |
| S7 | https://www.splitsuit.com/poker-squeezes-with-example | SplitSuit (Poker) | Squeeze sizing formula (3x + 1x/caller) | Yes |
| S8 | https://www.blackrain79.com/2022/08/preflop-bet-sizing.html | BlackRain79 | Open-raise sizing by position, 3bet sizing (3x IP / 4x OOP), squeeze sizing (4x IP / 5x OOP + 1x/caller), limper adjustment | Yes |
| S9 | https://pokercoaching.com/blog/mastering-big-blind-strategy-a-guide-to-profitable-defence/ | PokerCoaching.com | Qualitative BB defense guidance (no explicit % breadth) | Yes |
| S10 | https://upswingpoker.com/small-blind-poker-strategy-tips/ | Upswing Poker | SB raise-or-fold vs limp guidance, 40–50% raise range, BvB sizing (~3x) | Yes |
| S11 | https://upswingpoker.com/6-handed-max-poker-strategy/ | Upswing Poker | 6-max positional collapse explanation (why UTG/UTG+1/UTG+2 disappear vs full ring), range-widening-toward-BTN rationale | Yes |
| S12 | https://pokercoaching.com/blog/poker-ante/ | PokerCoaching.com | Ante-widens-ranges guidance, tournament-numeric example, brief cash-game commentary | Yes |
| S13 | https://upswingpoker.com/blind-vs-small-blind-limp/ | Upswing Poker | BB response to SB limp: raise %, sizing vs balanced/weak limpers | Yes |
| S14 | https://www.cardplayer.com/rules-of-poker/glossary/big-blind-in-poker | CardPlayer | Numeric pot-odds/equity-needed examples for BB defense at various raise sizes | Yes |

---

## 2. Per-anchor verification

### Anchor 1 — RFI ranges per position (100bb, 6-max cash)

**S1 (PokerCoaching.com), "Poker Preflop Charts for 6-Max" section — hand classes + %:**
- LJ/UTG: 17.6% — `66+,A3s+,K8s+,Q9s+,J9s+,T9s,ATo+,KJo+,QJo`
- HJ: 21.4% — `55+,A2s+,K6s+,Q9s+,J9s+,T9s,98s,87s,76s,ATo+,KTo+,QTo+`
- CO: 27.8% — `33+,A2s+,K3s+,Q6s+,J8s+,T7s+,97s+,87s,76s,A8o+,KTo+,QTo+,JTo`
- BTN: 43.5% — `33+,A2s+,K2s+,Q3s+,J4s+,T6s+,96s+,85s+,75s+,64s+,53s+,A4o+,K8o+,Q9o+,J9o+,T8o+,98o`
- SB: 62.3% — `22+,A2s+,K2s+,Q2s+,J2s+,T3s+,94s+,84s+,74s+,63s+,53s+,43s,A2o+,K4o+,Q5o+,J7o+,T7o+,96o+,86o+`
  (Note: this SB figure is total raise-or-limp participation in S1's chart; see Anchor 6 for the raise-only SB figure from other sources.)

**S3 (Preflop Wizard blog) — % only, no hand classes given:**
- UTG: "15-17%"; HJ: "19-22%"; CO: "25-28%"; BTN: "40-45%"; SB: "39-47%"

**S4 (FreeBetRange blog) — % only, no hand classes given:**
- Early/UTG: "15-17% of all starting hands"; MP/HJ: "19-22% of hands"; CO: "25-30% of starting poker hands"; BTN: "40 to 48%"; SB: "39-47% of hands"

**S2 (nlh.poker):** confirms only the qualitative direction — "the range of hands that we can open-raise with gets wider and wider, the closer we are to the button" — hand chart itself is an image and was not extractable.

**Verdict: VERIFIED (usable as SOURCE) for the percentage bands and their monotonic widening UTG→BTN.** Three independent sources (S1, S3, S4) converge tightly on UTG ~15-17%, HJ ~19-22%, CO ~25-30%, BTN ~40-48%. S1 is the only source that additionally states specific hand-class boundaries, and those are attributed to S1 alone — no second source was found giving 13x13-class detail for the 6-max cash 100bb spot, so **the exact hand-class boundaries are PARTIALLY VERIFIED (single-sourced, DERIVED)**: the percentage is corroborated three ways, the specific hand list is corroborated only by S1.

**Disagreement noted:** S1's SB figure (62.3%) is a raise-or-limp composite in that chart, not directly comparable to S3/S4's SB "39-47%" which (per S10/S13, see Anchor 6) is a raise-only figure. Do not conflate the two; see Anchor 6.

---

### Anchor 2 — RFI sizing

**S1 (PokerCoaching.com):** "Raise to 2.5bb first in; Raise to 3bb first in from SB" (cash 6-max section). Also, for micro-stakes exploit adjustment: "Some coaches advocate a 4x UTG open raise. Then reducing to 3x for HJ, 2.5x for CO and BTN, and then back to between 3 and 4x for SB opens."

**S3 (Preflop Wizard):** "The standard open size is 2.5bb from all positions (3bb from the small blind)."

**S4 (FreeBetRange):** "Recommended sizing for opening raise is 2.5bb from all positions except SB. From Small Blind we usually use a slightly increased 3bb sizing, to avoid giving the player in the big blind too good odds for a call."

**S8 (BlackRain79):** "Open-raising to 3 big blinds is the norm, particularly for online cash games" as a general default, but also: "Late Position (CO/BU): Can decrease to 2.5x or 2x"; "Early Position: Increase to 4x or 5x on fishy tables"; "if you're playing out of position, it may be wise to bump up your open-raise an additional big blind"; "add 1 BB per limper before you act."

**Verdict: VERIFIED (SOURCE) for the core figures — 2.5bb standard open, 3bb from SB — corroborated identically by three independent sources (S1, S3, S4).** S8 shows a real spread exists in the wider coaching literature (2x–5x depending on stakes/opponent pool/live vs online), which should be recorded as the known variance rather than averaged away.

---

### Anchor 3 — 3-bet sizing

**S1 (PokerCoaching.com), cash 6-max section:** "3-Bet to 3.5x the raise IP; 3-Bet to 4x the raise OOP."

**S5 (Upswing Poker):** "raising to around 3 times the open-raise size is good when in position"; "When out of position, use a size around 4–4.5x the open-raise." Also: "If someone opens to 2.2x or smaller, sizing up slightly to around 3.5x can help you avoid exploitation."

**S8 (BlackRain79):** "You should 3-bet 3 times the amount of the open-raise when you're playing in position" / "4 times the amount when you're playing out of position." Also: "You shouldn't make your 3-bets smaller than 3 times the open-raise."

**Range construction (S5, Upswing):** Linear ranges are used "When there are players left to act behind you" or against calling stations, including "premium hands, strong hands, and decent hands that benefit from protection." Polarized ranges are used "when there are no new players left to act" or in position, shifting toward "premium hands and semi-bluffs."

**Verdict: PARTIALLY VERIFIED / sources disagree on the exact IP multiplier (3.0x vs 3.5x), but agree on OOP (~4x) and on the IP<OOP direction.** Three sources: S1 says IP 3.5x / OOP 4x; S5 and S8 both say IP 3x / OOP 4-4.5x. **DERIVED rule recommended: IP 3-3.5x, OOP 4x** (splitting the difference is not appropriate per the no-averaging instruction — instead the range itself is recorded as the anchor, with 3x as the lower/majority-cited IP bound and 3.5x as PokerCoaching's specific figure). Range construction guidance (linear when players remain behind, polarized when in position / no one left to act) is VERIFIED via S5 only — single-sourced, so classify as DERIVED.

---

### Anchor 4 — 4-bet sizing

**S6 (Upswing Poker), cash games ~100bb deep:** IP: "The 4-bet size that hammers his range most is somewhere around 2.3x his 3-bet size." OOP: "Something in the neighborhood of 2.5x to 2.6x the 3-bet size is appropriate." (Tournament figures given separately: IP 2.2x, OOP 2.6-2.8x — not used here since our target is cash.)

**S1 (PokerCoaching.com), tournament exploitative section (not cash-labeled, used only as corroboration of the general shape):** "2.5x the 3-bet when 4-betting IP... 2.75x the 3-bet when 4-betting OOP" (tournament). PokerCoaching's cash 6-max section separately states: "4-bet to 2.5x the 3-bet OOP; 4-bet to 2.3x the 3-bet IP."

**Verdict: VERIFIED (SOURCE).** S6 (cash-specific) and S1's cash 6-max section agree closely: IP ≈2.3x the 3-bet, OOP ≈2.5x (S6 gives 2.5-2.6x OOP; S1 gives 2.5x OOP). This matches the anchor as proposed almost exactly.

---

### Anchor 5 — Squeeze sizing

**S7 (SplitSuit):** "When it comes to squeezing, it's helpful to use the 3x + 1x/caller formula. So if the raiser opens to 3bb and there is 1 caller, you would squeeze to 12bb (3+1 = 4 and 4*3bb = 12bb total)." Qualifier: "This is a starting point and should be calibrated..." No separate IP/OOP adjustment given; only a qualitative note that "good players are less likely to call lots of squeezes out of position."

**S8 (BlackRain79):** "You should use at least 4x the open-raise when playing in position, and 5x when playing out of position" plus "an extra 1x the open-raise for each additional caller."

**Verdict: PARTIALLY VERIFIED / sources disagree.** S7's baseline multiplier (3x + 1x/caller, no IP/OOP split) is meaningfully smaller than S8's (4x IP / 5x OOP, + 1x/caller). These are two different named formulas from two independent, freely accessible strategy sites — record both explicitly, do not average. **DERIVED rule recommended:** use position-aware sizing per S8 (4x IP / 5x OOP baseline vs one open-raiser, +1x per additional cold-caller) as the primary rule since it is more granular and matches the IP/OOP asymmetry already established for plain 3-bets (Anchor 3); flag S7's flat 3x+1x formula as the documented alternative in comments.

---

### Anchor 6 — SB strategy (raise-or-fold vs limp) and BB defense

**S10 (Upswing Poker), cash games:** "A limping strategy from the small blind has merits, but it is a lot tougher to implement effectively" — cash-game default is raise-or-fold. Raise-only sizing recommendation: "anywhere between 40% and 50% of hands is a good starting point" for the SB open-raise range. Sizing in BvB: "You should lean towards using a larger open-raise size (around 3x) in blind vs blind situations," because smaller sizes give BB favorable pot odds.

**Verdict on SB raise-or-fold vs limp: VERIFIED (SOURCE)** — matches our engine's raise-or-fold-only design for cash 100bb. Note S10 explicitly contrasts this with tournaments, where "calling ranges from the small blind are more viable... because of antes and smaller average open-raise sizes" — i.e. the limp-viability caveat is a tournament-only exception per this source, not applicable to our cash-game target.

**SB raise-only %:** S10's "40-50%" matches S3/S4's SB figures ("39-47%") closely — **VERIFIED (SOURCE)**, three sources converge on ~40-47% raise-only from SB. (Contrast with S1's 62.3% figure in Anchor 1, which per S1's own chart layout is a combined raise-or-limp total and should not be used for a raise-or-fold-only engine.)

**BB defense breadth — pot odds driven:**
- S9 (PokerCoaching.com): purely qualitative — "You often get attractive odds to call raises, but you will end up out of position for the rest of the hand." No explicit % breadth given: "The article does not provide specific defense frequencies against different positions... Instead, it prescribes a qualitative strategy."
- S14 (CardPlayer): gives concrete pot-odds math rather than a range %: "Against a 2.5 big blind raise, you're risking 1.5 to win a total pot of 5... you need roughly 23% equity to break even." Also multiway: "you need about 16% equity," and vs a 6bb raise: "you are risking 5 to win 12... requiring roughly 29% equity."

**Verdict: UNVERIFIED for a specific "defend X% of hands vs each position" number** — no public source in this search gave a concrete BB-defense percentage-of-combos table; both public sources found frame it as pot-odds/equity math or qualitative hand-quality principles, not as a percentage-of-range chart. **Any specific BB defense % breadth used in the engine must be classified HEURISTIC**, though the underlying pot-odds relationship (larger raise → less BB defense, per S14's worked numbers of 23%/16%/29% equity thresholds at 2.5bb/multiway/6bb) is itself VERIFIED and can inform a HEURISTIC formula.

---

### Anchor 7 — Blind-vs-blind and vs-limp guidance

**S10 (Upswing Poker), BvB sizing:** "You should lean towards using a larger open-raise size (around 3x) in blind vs blind situations" (rather than the standard 3bb/2.5bb open).

**S13 (Upswing Poker), BB response to an SB limp:**
- Vs a "balanced" limper: "The optimal response is to raise with a range of around 40-45% of the hands," sized to "3.5-4 big blinds," reasoning "gives a good price to steal the pot preflop while also putting a large portion of the small blind's range in a tough spot, needing ~37% equity to call."
- Vs a "weak" limper: raise range "almost always... above 50% of hands," sized "to about 4.5 big blinds," reasoning "we want to play bigger pots in which their mistakes will be magnified."
- Postflop note: "Because the ranges and positions are extremely similar to button versus big blind situations, the postflop strategy will be very similar."

**Verdict: VERIFIED (SOURCE)** for the qualitative shape (raise wide vs SB limp, size up to 3.5-4.5bb depending on limper strength) — single-sourced to S13, so treat the exact numeric thresholds (40-45% / 4.5bb) as DERIVED rather than cross-source SOURCE; no second independent article with matching numbers was found in this pass.

---

### Anchor 8 — Short-handed range shift (5-handed / 4-handed collapsing toward later-position ladder)

**S11 (Upswing Poker), 6-max vs full ring:** "the positions from which we play the tightest — UTG (Under the Gun), UTG+1 and UTG+2 — no longer exist in 6-max." "You can see that our range of raising hands gets wider as we move around the table" because "with fewer players left to act behind us, we are more likely to win the blinds with our raise and less likely to run into a strong hand." "Your opening range is at its widest from the small blind because there is only one player between us and the 1.5BB in the pot."

**Verdict: PARTIALLY VERIFIED.** S11 clearly and explicitly documents the *mechanism* our DERIVED rule depends on — fewer players behind a seat → wider range, and removing early positions (going from 9-max/full-ring to 6-max) simply drops the tightest seats rather than reshaping the remaining ladder. This directly supports "5-handed reuses the 6-max positional ladder, shifted" as a reasonable DERIVED rule. However, **no source found in this pass explicitly states numeric 5-handed or 4-handed ranges**, or explicitly confirms "5-handed = drop UTG, keep HJ/CO/BTN/SB/BB ladder unchanged" as a stated rule anywhere. That specific mechanical claim is **UNVERIFIED and must be classified HEURISTIC**; only the general "fewer players behind → wider range, dropping seats removes the tightest ones first" mechanism is VERIFIED.

---

### Anchor 9 — Ante-game adjustment guidance

**S12 (PokerCoaching.com):** "GTO poker recommends opening just 10% of all hands UTG+1 in an 8-handed game without an ante but recommends opening nearly 20% from the same position with an ante" — this example is **tournament-context (8-handed, BB ante)**, not our 6-max-cash-with-fixed-0.16bb/player-ante setup. The article does separately address cash: "If you play in a private cash game with your friends, I highly recommend thinking about introducing antes into it" and "antes entice action in cash games as well," with the same directional guidance to "open wider, steal more aggressively."

**Verdict: VERIFIED (SOURCE) for the qualitative direction only** — antes widen opening ranges, confirmed for both tournament (with a concrete but tournament-specific numeric example, 10%→20% at UTG+1 in an 8-handed ante game) and cash contexts (qualitative only, no cash-specific numeric adjustment found). **No public source gives a numeric ante-adjustment factor applicable to a 6-max, 0.16bb/player-ante cash structure.** Per the milestone's own scope, this is consistent with **not encoding a numerical ante adjustment** — the engine should treat ante-driven range widening as an acknowledged, cited, but numerically UNVERIFIED effect, left out of V1 by design rather than guessed at.

---

## 3. Recommended V1 constants

| Anchor | Recommended deterministic value | Classification | Backed by |
|---|---|---|---|
| RFI % bands (UTG/HJ/CO/BTN/SB) | UTG ~15-17%, HJ ~19-22%, CO ~25-30%, BTN ~40-48%, SB (raise-only) ~40-47% | SOURCE (percentages); DERIVED (monotonic widening rule) | S1, S3, S4, S11 |
| RFI hand-class boundaries (13x13 notation) | Use S1's exact lists per position (only source with hand-class detail) | DERIVED (single-sourced) | S1 |
| RFI sizing | 2.5bb all positions, 3bb from SB | SOURCE | S1, S3, S4 |
| 3-bet sizing IP | 3.0-3.5x the open (use 3x as default, 3.5x as documented alternative) | DERIVED (sources disagree 3.0 vs 3.5) | S1, S5, S8 |
| 3-bet sizing OOP | ~4x the open | SOURCE | S1, S5, S8 |
| 3-bet range construction | Linear when players remain behind / vs weak ranges; polarized when in position / no one left to act | DERIVED (single-sourced) | S5 |
| 4-bet sizing IP | ~2.3x the 3-bet | SOURCE | S1, S6 |
| 4-bet sizing OOP | ~2.5x the 3-bet (S6 gives up to 2.6x) | SOURCE | S1, S6 |
| Squeeze sizing | 4x the open IP / 5x OOP, +1x per additional cold-caller (primary); flag SplitSuit's flat 3x+1x/caller as documented alternative | DERIVED (sources disagree on baseline multiplier) | S7, S8 |
| SB strategy | Raise-or-fold only (no limping) for cash 100bb; raise ~40-47% of hands | SOURCE | S10, S3, S4 |
| SB open sizing | 3bb (or ~3x in BvB specifically) | SOURCE | S1, S3, S4, S10 |
| BB defense breadth (%) | No numeric chart available publicly | UNVERIFIED → HEURISTIC | S9, S14 (pot-odds math only) |
| BB defense pot-odds relationship | Larger open size → BB needs proportionally more equity to defend (worked examples: ~23% eq needed vs 2.5bb open heads-up, ~16% multiway, ~29% vs 6bb) | SOURCE (as a relationship, not a %-of-range table) | S14 |
| BB vs SB limp | Raise ~40-45% (balanced limper) to ~50%+ (weak limper), sized 3.5-4bb / ~4.5bb respectively | DERIVED (single-sourced) | S13 |
| BvB open sizing | ~3x (larger than standard heads-up-into-blinds default) | DERIVED (single-sourced) | S10 |
| 5/4-handed positional-ladder reuse | Mechanism (fewer players behind → wider range; shrinking the field drops tightest seats first) is supported; the specific mechanical rule "5-handed = drop UTG, reuse HJ→BB ladder" is not itself stated by any source found | Mechanism: SOURCE. Mechanical rule: UNVERIFIED → HEURISTIC | S11 |
| Ante adjustment (0.16bb/player) | Do not encode a numeric adjustment in V1; direction (antes widen ranges) is acknowledged but no cash-applicable numeric factor exists publicly | Directional claim: SOURCE (qualitative only). Any numeric factor: UNVERIFIED → HEURISTIC (and out of V1 scope per milestone) | S12 |

---

## 4. Summary of surprises / notable gaps

- No public source was found giving a **BB defense frequency as a percentage of combos** per opponent position — every free source frames it as pot-odds/equity math (CardPlayer) or purely qualitative hand-quality guidance (PokerCoaching). This is a real gap, not an oversight — it should stay HEURISTIC.
- No public source explicitly states a **numeric 5-handed or 4-handed range table**, nor an explicit rule that "5-handed reuses the 6-max ladder minus UTG." The mechanism that would justify it (fewer players behind → wider range; shrinking the field drops the tightest seats first) is well documented (Upswing S11), but the specific mechanical shortcut is our own DERIVED extrapolation, not a cited public rule.
- Squeeze sizing has a genuine, non-trivial public disagreement: SplitSuit's flat "3x + 1x/caller" vs BlackRain79's position-aware "4x IP / 5x OOP + 1x/caller." These produce different bet sizes even in the simplest case (open 3bb, one caller: SplitSuit → 12bb; BlackRain79 IP → 12bb also by coincidence at that specific number, but diverges once the open size or IP/OOP differs). Recorded as two named alternatives, not averaged.
- No cash-specific, 6-max, 0.16bb-ante numeric adjustment exists anywhere in public education content found. All ante-widening numeric examples are tournament-specific (8-handed, BB ante). This directly supports the milestone's own decision not to encode a numeric ante adjustment in V1.
- 3-bet IP sizing has minor disagreement (3.0x vs 3.5x) rather than clean convergence — worth flagging since the original anchor assumption ("IP ~3-3.5x") already anticipated this spread and is confirmed correct as a range rather than a single number.
