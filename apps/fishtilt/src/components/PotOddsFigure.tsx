/**
 * `PotOddsFigure` — the final pot as one bar, with the part you are putting in marked.
 *
 * ## Why this picture
 *
 * The step beginners get wrong in a pot-odds calculation is not the division, it is the
 * DENOMINATOR: they divide their call by the pot they can see rather than by the pot that
 * exists after they call. Every sentence about it has to say "원래 팟, 상대 베팅, 내 콜을
 * 더해 최종 팟" and hope the reader assembles three amounts in their head. One bar made of
 * exactly those three pieces is that assembly, already done — and the marked piece is
 * literally the fraction the article's `<Fact name="POT_ODDS_REQUIRED_EQUITY">` computes.
 *
 * ## Every amount comes from `Money` and `potOdds`
 *
 * The two inputs are BB strings and are parsed by `@gto-self/shared`'s `Money.parseBB`, the
 * same way `src/content/facts.ts` parses the identical arguments — so a figure and the
 * `<Fact>` in the sentence beside it are reading one pair of numbers through one parser.
 * Everything else (`calledBet`, `finalPot`) is `learn-core`'s `potOdds` output, and every
 * width is `Money.ratio`. CLAUDE.md rule 1: no BB arithmetic happens in this file, and no
 * amount is a literal.
 *
 * It assumes hero calls the full bet (`callAmount === villainBet`) — `potOdds.ts`' ordinary
 * case, and the same assumption `POT_ODDS_REQUIRED_EQUITY` documents and makes, so the two
 * cannot describe different calls.
 *
 * ## Why it prints no percentage
 *
 * The article's `<Fact>` already states the required equity in its own sentence, with its own
 * rounding. Rendering it again here is how a page ends up showing two numbers for one
 * quantity. The picture's job is to show WHICH fraction that number is; the number itself
 * stays in the prose. `OutsFigure` withholds its probability for the same reason.
 *
 * ## Not advice
 *
 * A break-even price is arithmetic, not a recommendation. Nothing here says to call, and the
 * legend names the pieces rather than judging them — the same line every pot-odds surface on
 * this site holds.
 */
import { Money, type MilliBB } from '@gto-self/shared';
import { potOdds } from '@gto-self/learn-core';
import { formatAmountBB } from '../features/tools/index.js';

export interface PotOddsFigureProps {
  /** What is already in the middle, in BB, before the bet being faced. e.g. `"6"`. */
  readonly pot: string;
  /** What the opponent just bet, in BB. Hero calls all of it. e.g. `"3"`. */
  readonly bet: string;
  readonly className?: string;
}

function requireBB(prop: string, text: string): MilliBB {
  const parsed = Money.parseBB(text);
  if (!parsed.ok) {
    throw new Error(`<PotOddsFigure ${prop}="${text}">: not a BB amount (${parsed.error})`);
  }
  return parsed.value;
}

/** A slice of the bar. `share` is a proportion of the final pot, from `Money.ratio`. */
interface Slice {
  readonly label: string;
  readonly amount: MilliBB;
  readonly share: number;
  /** The one slice the reader is being asked to look at. */
  readonly marked: boolean;
}

export function PotOddsFigure({ pot, bet, className = '' }: PotOddsFigureProps) {
  const potBeforeCallMbb = requireBB('pot', pot);
  const villainBetMbb = requireBB('bet', bet);

  const resolution = potOdds({
    potBeforeCallMbb,
    villainBetMbb,
    // The ordinary case, and the same one `POT_ODDS_REQUIRED_EQUITY` assumes.
    callAmountMbb: villainBetMbb,
  });
  if (!resolution.ok) {
    throw new Error(`<PotOddsFigure pot="${pot}" bet="${bet}">: ${resolution.error}`);
  }
  const odds = resolution.value;

  const shareOf = (amount: MilliBB): number => Money.ratio(amount, odds.finalPotMbb) ?? 0;

  const slices: readonly Slice[] = [
    {
      label: '원래 팟',
      amount: odds.potBeforeCallMbb,
      share: shareOf(odds.potBeforeCallMbb),
      marked: false,
    },
    {
      label: '상대 베팅',
      amount: odds.calledBetMbb,
      share: shareOf(odds.calledBetMbb),
      marked: false,
    },
    {
      label: '내 콜',
      amount: odds.callAmountMbb,
      share: shareOf(odds.callAmountMbb),
      marked: true,
    },
  ];

  return (
    // The diagram carries its own surface: `Figure` is markup and a caption only, so that a
    // component which already has a well (`RangeMatrixMini`) is not boxed twice.
    <div className={`rounded-lg border border-line-500 bg-ground-800 p-4 sm:p-5 ${className}`}>
      {/* The bar. `aria-hidden` because the same three amounts and the total are stated as
          real text underneath — nothing here is carried by the picture or by colour alone. */}
      <div
        aria-hidden="true"
        className="flex h-10 w-full overflow-hidden rounded-md border border-line-500"
      >
        {slices.map((slice) => (
          <span
            key={slice.label}
            // Geometry, not colour: the only inline style is the width the domain computed.
            style={{ width: `${slice.share * 100}%` }}
            className={`block h-full border-r border-line-500 last:border-r-0 ${
              slice.marked ? 'bg-act-raise-500' : 'bg-panel-600'
            }`}
          />
        ))}
      </div>

      <ul className="mt-4 space-y-1.5 text-sm text-text-300">
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`inline-block h-3 w-3 shrink-0 rounded-sm border border-line-500 ${
                slice.marked ? 'bg-act-raise-500' : 'bg-panel-600'
              }`}
            />
            <span>{`${slice.label} ${formatAmountBB(slice.amount)}`}</span>
          </li>
        ))}
        <li className="border-t border-line-500 pt-2 text-text-100">
          {`콜한 뒤의 최종 팟 ${formatAmountBB(odds.finalPotMbb)} — 이 중 색칠된 ${formatAmountBB(
            odds.callAmountMbb,
          )}가 내가 내는 돈입니다.`}
        </li>
      </ul>
    </div>
  );
}
