/**
 * `DataTable` — a real `<table>` for numbers and comparisons in an article (D-S3-13).
 *
 * Semantic first: `<caption>`, `<thead>` with `scope="col"`, an optional row-header column
 * with `scope="row"`, so a screen reader can walk it by cell. The table scrolls INSIDE its
 * own wrapper on a phone (`overflow-x-auto`) and the page never gains horizontal scroll —
 * the same rule `mdx-components.tsx` applies to a Markdown table and `responsive-a11y.spec`
 * holds for every surface.
 *
 * `cells` are `ReactNode`s so that a number in an article can be a `<Fact>` rather than a
 * figure the author typed (CLAUDE.md rule 2). The component computes nothing: no totals,
 * no sorting, no formatting.
 *
 * A `highlight` column is tinted with the recessed well and its header set in the brand
 * ink — "this is the one we recommend" — and it is carried by `data-highlight` too, never by
 * colour alone. `ComparisonTable` is this component with a row-header column and a
 * highlighted option, under the name the article component list uses.
 */
export type DataTableAlign = 'start' | 'center' | 'end';

export interface DataTableColumn {
  readonly key: string;
  readonly label: string;
  readonly align?: DataTableAlign;
  /** Lining figures for a column of numbers. */
  readonly numeric?: boolean;
  readonly highlight?: boolean;
}

export interface DataTableRow {
  /** Stable key; defaults to the row-header cell's text or the row index. */
  readonly key?: string;
  readonly cells: Readonly<Record<string, React.ReactNode>>;
}

export interface DataTableProps {
  readonly columns: readonly DataTableColumn[];
  readonly rows: readonly DataTableRow[];
  /** What the table is. Rendered as `<caption>`; required, an unlabelled table is a grid. */
  readonly caption: string;
  /** Column key rendered as `<th scope="row">` for each row. */
  readonly rowHeader?: string;
  readonly className?: string;
}

const ALIGN_CLASS: Readonly<Record<DataTableAlign, string>> = {
  start: 'text-left',
  center: 'text-center',
  end: 'text-right',
};

function cellClass(column: DataTableColumn): string {
  return [
    ALIGN_CLASS[column.align ?? 'start'],
    column.numeric ? 'tabular' : '',
    column.highlight ? 'bg-ground-800' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function DataTable({ columns, rows, caption, rowHeader, className = '' }: DataTableProps) {
  return (
    <div data-table="" className={`my-8 min-w-0 max-w-full ${className}`}>
      {/* The caption a reader SEES sits outside the scroller, so it wraps to the column and
          never scrolls off with a wide table (at 320px it did). It also sits OUTSIDE the
          `table-scroll` box: that box paints the right-edge fade over its whole height
          while there is more table to the right, and at 320px the fade was erasing the end
          of the caption's lines — "6인 · 100BB · First In" lost its "· First" (WP-S3-19,
          review B-M5). The `<caption>` inside the table keeps the accessible name —
          `sr-only`, and `aria-hidden` on the visible copy, so a screen reader hears it once
          (WP-S3-17). */}
      <p
        aria-hidden="true"
        data-table-caption=""
        className="prose-ko mb-3 min-w-0 max-w-full text-sm text-text-300"
      >
        {caption}
      </p>
      {/* `table-scroll` (globals.css): the wrapper scrolls, and a right-edge fade tells a
          phone reader there is more table to the right — drawn only while there IS more
          (scroll-driven, no JavaScript), so a table that fits shows nothing extra. */}
      <div className="table-scroll">
        <div data-scroller="" className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.9375rem]">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    data-highlight={column.highlight ? 'true' : undefined}
                    className={`border-b border-line-500 px-3 py-2.5 align-bottom text-sm font-medium break-keep ${column.numeric || column.highlight ? 'whitespace-nowrap' : ''} ${column.highlight ? 'text-brand-500' : 'text-text-300'} ${cellClass(column)}`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => {
                const headerText = rowHeader === undefined ? undefined : row.cells[rowHeader];
                const key =
                  row.key ?? (typeof headerText === 'string' ? headerText : String(rowIndex));
                return (
                  <tr key={key}>
                    {columns.map((column) => {
                      const content = row.cells[column.key] ?? null;
                      // `break-keep`, NOT `prose-ko`: `prose-ko` allows a break anywhere as an
                      // escape hatch for one over-long word in a paragraph, and in a 320px table
                      // it split "UTG" into "UT / G" and "19.15%" into "19.15 / %". A cell wraps
                      // between words only; a numeric column and the row header never wrap at
                      // all — the wrapper scrolls instead (WP-S3-17).
                      const classes = `border-b border-line-500 px-3 py-2.5 align-top break-keep ${column.numeric ? 'whitespace-nowrap' : ''} ${cellClass(column)}`;
                      if (column.key === rowHeader) {
                        return (
                          <th
                            key={column.key}
                            scope="row"
                            className={`${classes} font-medium whitespace-nowrap text-text-100`}
                          >
                            {content}
                          </th>
                        );
                      }
                      return (
                        <td
                          key={column.key}
                          data-highlight={column.highlight ? 'true' : undefined}
                          className={`${classes} ${column.highlight ? 'text-text-100' : 'text-text-100/90'}`}
                        >
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
