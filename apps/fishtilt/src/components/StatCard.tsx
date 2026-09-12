/**
 * `StatCard` — one number with its label: "169" over "핸드 클래스", "약 4분" over "읽는 시간".
 *
 * ## No arithmetic, no invented numbers
 *
 * `value` is a `ReactNode`, not a number, for one reason: inside prose the value should be
 * a `<Fact>` — a quantity computed by `learn-core` — and never a figure the author typed
 * (CLAUDE.md rule 2, the same discipline `OutsFigure` and `PotOddsFigure` hold). A page
 * component may pass a string it derived itself (`record.readMinutes`), but this component
 * computes nothing and formats nothing.
 *
 * ## Plain by default
 *
 * The design direction (D-S3-17) is "stat strips, not bordered cards". So the default is
 * TYPOGRAPHY ONLY — a large tabular number, a small label, an optional note — and a border
 * appears only under `variant="card"`, for the rare place a stat has to sit alone on the
 * page rather than in a `StatStrip`.
 */
export type StatCardVariant = 'plain' | 'card';

export interface StatCardProps {
  readonly label: string;
  readonly value: React.ReactNode;
  /** One short line of context under the label — the unit, the condition, the source. */
  readonly note?: string;
  readonly variant?: StatCardVariant;
  readonly className?: string;
}

const VARIANT_CLASS: Readonly<Record<StatCardVariant, string>> = {
  plain: '',
  card: 'rounded-lg border border-line-500 bg-panel-700 p-5',
};

export function StatCard({ label, value, note, variant = 'plain', className = '' }: StatCardProps) {
  return (
    <div data-variant={variant} className={`min-w-0 ${VARIANT_CLASS[variant]} ${className}`}>
      {/* Value first, then label: the number is what the eye lands on, the label is what
          it reads second. `tabular` so a row of them lines up on the digits. */}
      <p className="tabular text-3xl font-semibold tracking-[-0.01em] text-text-100">{value}</p>
      <p className="mt-1 text-sm font-medium text-text-300">{label}</p>
      {note ? <p className="mt-1 text-xs text-text-300">{note}</p> : null}
    </div>
  );
}
