'use client';

/**
 * The right panel's default content.
 *
 * It shows NO strategy number, frequency, range or percentage, because none exists yet:
 * inventing one and presenting it as GTO is forbidden outright (`CLAUDE.md` rule 2). The
 * honest thing to render is that the panel is empty and why.
 */
export function StrategyPanelPlaceholder() {
  return (
    <section
      data-testid="strategy-placeholder"
      aria-label="Strategy"
      className="flex flex-col gap-2"
    >
      <h2 className="text-[0.65rem] uppercase tracking-widest text-ink-500">strategy</h2>
      <p className="text-xs text-ink-500">
        No strategy data is available yet. Solution lookup arrives in a later phase; until then this
        panel shows nothing rather than a number nobody solved for.
      </p>
      <p className="text-xs text-ink-700">Click a seat to see that player&rsquo;s profile.</p>
    </section>
  );
}
