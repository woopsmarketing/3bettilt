'use client';

/**
 * `HandRangeHighlight` — the 13x13 chart on a `/hands/[hand]` page, with that hand's own
 * cell picked out.
 *
 * ## Why this exists instead of reusing `RangeMatrixMini`
 *
 * `docs/FISHTILT_STATE.md` ruling 17: a hand page highlights its cell with `RangeMatrix`'s
 * own `selectedKey`, not by adding a highlight prop to `RangeMatrixMini`. `RangeMatrixMini`
 * is a range-explorer composition — it always resolves a real `RangeQuery` and draws
 * membership colouring (in-range/out-of-range) alongside the selection. A hand page needs
 * neither: it is not asking "is this hand in some position's range", only "where does this
 * hand sit on the grid" — `range={null}` already renders that neutral, no-legend state, and
 * `selectedKey` already exists for exactly this purpose. Building a second capability into
 * `RangeMatrixMini` would duplicate what `RangeMatrix` can already do on its own.
 *
 * ## Why this thin wrapper exists at all
 *
 * `RangeMatrix` is a client component whose `onSelectKey` callback cannot be handed to it
 * directly from a Server Component (`/hands/[hand]/page.tsx`) — a function prop crossing the
 * server/client boundary is not serialisable. This component supplies that callback locally
 * (`useState`), seeded to the page's own hand so it opens already pointing at the hand the
 * reader came to look at; tapping another cell just moves the pointer, the same explorable
 * behaviour every other `RangeMatrix` use offers.
 */
import { useState } from 'react';
import { RangeMatrix } from './RangeMatrix.js';

export interface HandRangeHighlightProps {
  /** The class key to open selected, e.g. `'AKs'`. */
  readonly handKey: string;
  readonly label: string;
  readonly className?: string;
}

export function HandRangeHighlight({ handKey, label, className = '' }: HandRangeHighlightProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(handKey);

  return (
    <RangeMatrix
      className={className}
      range={null}
      selectedKey={selectedKey}
      onSelectKey={setSelectedKey}
      label={label}
    />
  );
}
