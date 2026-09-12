/**
 * `ComparisonTable` — "A vs B (vs C)" across a list of criteria (D-S3-13).
 *
 * `DataTable` with the shape a comparison always has: the first column is the criterion
 * (a row header), every other column is one option, and at most one option is
 * `highlight`ed. Written as a mapping onto `DataTable` rather than as its own `<table>` so
 * there is exactly one table implementation to keep accessible and scrollable.
 *
 * Cells are `ReactNode`s: a "승률" row's cells should be `<Fact>`s, not typed percentages.
 */
import { DataTable, type DataTableAlign } from './DataTable.js';

export interface ComparisonOption {
  readonly key: string;
  readonly label: string;
  readonly highlight?: boolean;
}

export interface ComparisonRow {
  /** The criterion — "포지션", "필요 승률", "언제 쓰나". */
  readonly criterion: string;
  /** One cell per option, by option key. */
  readonly cells: Readonly<Record<string, React.ReactNode>>;
}

export interface ComparisonTableProps {
  readonly options: readonly ComparisonOption[];
  readonly rows: readonly ComparisonRow[];
  readonly caption: string;
  /** Header text over the criterion column. Default "기준". */
  readonly criterionLabel?: string;
  readonly align?: DataTableAlign;
  readonly className?: string;
}

const CRITERION_KEY = '__criterion';

export function ComparisonTable({
  options,
  rows,
  caption,
  criterionLabel = '기준',
  align = 'start',
  className = '',
}: ComparisonTableProps) {
  return (
    <DataTable
      caption={caption}
      rowHeader={CRITERION_KEY}
      className={className}
      columns={[
        { key: CRITERION_KEY, label: criterionLabel },
        ...options.map((option) => ({
          key: option.key,
          label: option.label,
          align,
          highlight: option.highlight,
        })),
      ]}
      rows={rows.map((row) => ({
        key: row.criterion,
        cells: { ...row.cells, [CRITERION_KEY]: row.criterion },
      }))}
    />
  );
}
