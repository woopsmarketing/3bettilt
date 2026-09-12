/**
 * `Fact` — a number inside a sentence, computed rather than typed.
 *
 * MDX prose is not allowed to write a figure. It writes `<Fact name="COMBO_COUNT" />` and
 * `src/content/facts.ts` answers from `strategy-core` / `learn-core`. See that module for
 * why (CLAUDE.md rule 2, build spec §46) and for the provenance of every name.
 *
 * Renders a bare `<span>` — phrasing content, so it is valid in the middle of a paragraph —
 * with tabular figures so a number sitting in a line of Korean does not jitter the baseline.
 */
import { factValue, type FactName } from '../content/facts.js';

export interface FactProps {
  readonly name: FactName;
  /** Required by some names (a position, a hand class, a class kind). See `facts.ts`. */
  readonly arg?: string;
  readonly className?: string;
}

export function Fact({ name, arg, className = '' }: FactProps) {
  return (
    <span className={`tabular font-semibold text-text-100 ${className}`}>
      {factValue(name, arg)}
    </span>
  );
}
