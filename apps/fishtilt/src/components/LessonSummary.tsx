/**
 * `<LessonSummary>` — the quick-summary block a lesson closes with (WP-S3-09, contract AS).
 * Prose declares it as `<LessonSummary items={['…', '…']} />`, before the "자주 헷갈리는
 * 부분" section, so a reader who skims gets the lesson's few sentences in one place.
 *
 * Same string-only `items` contract as `LessonGoals`, for the same two reasons: attributes
 * do not move `readMinutes`, and a summary line carries a sentence, never a number (numbers
 * are `<Fact>`s in the prose the summary points back to).
 *
 * Visually it IS a `KeyPoint` (`Callout variant="key"`, the site's summary well) holding an
 * ordered list — one summary surface, not a second one.
 */
import { KeyPoint } from './KeyPoint.js';

export interface LessonSummaryProps {
  readonly items: readonly string[];
  readonly title?: string;
  readonly className?: string;
}

const DEFAULT_TITLE = '한눈에 정리';

export function LessonSummary({
  items,
  title = DEFAULT_TITLE,
  className = '',
}: LessonSummaryProps) {
  if (items.length === 0) return null;
  return (
    <KeyPoint title={title} className={className}>
      <ol
        data-lesson="summary"
        className="list-decimal space-y-2.5 pl-5 marker:font-semibold marker:text-brand-500"
      >
        {items.map((item) => (
          <li key={item} className="pl-1">
            {item}
          </li>
        ))}
      </ol>
    </KeyPoint>
  );
}
