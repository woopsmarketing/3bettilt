/**
 * `VisualBackdrop` — a featured visual used as ATMOSPHERE behind deterministic content.
 *
 * The hand page and the card-subject glossary entries show real cards drawn from data
 * (`PokerCards`, `GlossaryVisual`). A picture must never draw those cards itself, so here the
 * picture sits behind them: the visual fills the box, a strong theme-aware scrim flattens it
 * into a dark stage, and the children render on top in cover ink. Because the scrim is always
 * dark, the children are rendered inside `.cover-stage`, which re-points the page-ink tokens
 * to their dark values for that subtree only — a card face and its labels keep AA contrast in
 * the light theme too.
 */
import type { ReactNode } from 'react';
import type { ContentVisual } from '../../content/visuals.js';
import { EditorialVisual } from './EditorialVisual.js';

export interface VisualBackdropProps {
  readonly visual: ContentVisual;
  readonly children: ReactNode;
  readonly sizes: string;
  readonly className?: string;
  readonly as?: 'div' | 'section';
  readonly 'aria-label'?: string;
  readonly [key: `data-${string}`]: string | boolean | undefined;
}

export function VisualBackdrop({
  visual,
  children,
  sizes,
  className = '',
  as: Tag = 'div',
  ...rest
}: VisualBackdropProps) {
  return (
    <Tag
      {...rest}
      className={`cover-stage relative isolate overflow-hidden rounded-xl ${className}`}
    >
      <span aria-hidden="true" className="absolute inset-0 -z-10">
        <EditorialVisual
          visual={visual}
          aspect="fill"
          sizes={sizes}
          rounded={false}
          motif={false}
        />
        <span className="cover-scrim-stage absolute inset-0" />
      </span>
      {children}
    </Tag>
  );
}
