'use client';

/**
 * The right column's strategy slot, shown while HERO is the seat on the clock.
 *
 * It shows NO strategy number, frequency, range, percentage or chart, because none exists
 * yet: inventing one and presenting it as GTO is forbidden outright (`CLAUDE.md` rule 2),
 * and a plausible-looking placeholder is exactly the failure that rule exists to prevent.
 * The honest thing to render is that there is no recommendation, and where the real one is
 * coming from.
 *
 * The two phase numbers below are ROADMAP references, not data. There is deliberately no
 * other numeral in this panel.
 */
export function StrategyPanelPlaceholder() {
  return (
    <section data-testid="strategy-placeholder" aria-label="전략" className="flex flex-col gap-1.5">
      <h2 className="text-[0.65rem] uppercase tracking-widest text-ink-500">전략</h2>
      <p className="text-xs font-medium text-ink-300">전략 데이터는 아직 준비되지 않았습니다.</p>
      <p className="text-[0.7rem] leading-snug text-ink-500">
        지금 이 화면은 어떤 액션도 추천하지 않습니다. 아무도 풀지 않은 숫자를 지어내지 않기 위해
        비워 둡니다.
      </p>
      <p className="text-[0.7rem] leading-snug text-ink-700">
        Phase 9에서 GTOProvider와 매처 골격이 들어오고, Phase 10에서 전략 UI가 이 자리에 붙습니다.
      </p>
    </section>
  );
}
