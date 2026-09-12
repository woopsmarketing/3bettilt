/**
 * `PokerCards` — real playing cards inside prose.
 *
 * Two ways to ask for them, and both resolve to actual `Card` values rather than to a
 * picture an author chose:
 *
 * - `hand="AKs"` — one of the 169 classes. The cards shown are that class's representative
 *   combo from `learn-core`'s `handClassFacts`, which is deterministic and is the same pair
 *   the rest of the app shows for that class. An author cannot accidentally illustrate `AKs`
 *   with two different suits.
 * - `cards="As Ks"` — explicit cards, parsed by `@gto-self/shared`'s `parseCards`, which
 *   rejects a malformed or duplicated card. A typo is a build failure, not a wrong picture.
 *
 * The reading (`에이스 킹 수티드`) and the plain-Korean description (`같은 무늬의 A와 K`) come
 * from `features/range/copy.ts`, so the article never spells a hand out in its own words.
 * That is build spec §3's pattern — easy Korean first, notation second — applied to a
 * component instead of to every sentence.
 */
import { parseCards, rankOf, suitOf, type Card } from '@gto-self/shared';
import { handClassByKey } from '@gto-self/strategy-core';
import { handClassFacts } from '@gto-self/learn-core';
import { describeHandClassKorean, handClassReading } from '../features/range/index.js';
import { PokerCard, type PokerCardSize } from './PokerCard.js';

interface PokerCardsBaseProps {
  readonly size?: PokerCardSize;
  /** Show the plain-Korean reading and description under the cards. Default `true`. */
  readonly showReading?: boolean;
  readonly className?: string;
}

export type PokerCardsProps = PokerCardsBaseProps &
  (
    | { readonly hand: string; readonly cards?: never }
    | { readonly cards: string; readonly hand?: never }
  );

interface Resolved {
  readonly cards: readonly Card[];
  readonly key: string | null;
  readonly reading: string | null;
  readonly description: string | null;
}

function resolve(props: PokerCardsProps): Resolved {
  if (props.hand !== undefined) {
    const handClass = handClassByKey(props.hand);
    if (handClass === undefined) {
      throw new Error(`<PokerCards hand> must be one of the 169 classes, got "${props.hand}"`);
    }
    return {
      cards: handClassFacts(handClass).exampleCards,
      key: handClass.key,
      reading: handClassReading(handClass),
      description: describeHandClassKorean(handClass),
    };
  }

  const parsed = parseCards(props.cards);
  if (!parsed.ok) throw new Error(`<PokerCards cards="${props.cards}">: ${parsed.error}`);
  return { cards: parsed.value, key: null, reading: null, description: null };
}

export function PokerCards(props: PokerCardsProps) {
  const { size = 'md', showReading = true, className = '' } = props;
  const { cards, key, reading, description } = resolve(props);

  return (
    <span className={`my-6 flex flex-wrap items-center gap-4 ${className}`}>
      <span className="flex flex-wrap gap-2" role="group" aria-label={key ?? '카드'}>
        {cards.map((card) => (
          <PokerCard key={card} rank={rankOf(card)} suit={suitOf(card)} size={size} />
        ))}
      </span>
      {showReading && key !== null ? (
        <span className="text-sm text-text-300">
          <span className="block font-mono text-base font-semibold text-text-100">{key}</span>
          <span className="block">{reading}</span>
          <span className="block">{description}</span>
        </span>
      ) : null}
    </span>
  );
}
