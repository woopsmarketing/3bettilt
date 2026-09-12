/**
 * `HomeFeaturedTools` — one featured tool with a worked, computed example, and the other
 * tools as rows that each state the QUESTION they answer (`TOOL_QUESTION`, WP-S3-14).
 *
 * The featured example is `homeEquityExample()`: two named hands, preflop, exact equity
 * from `learn-core` — the same function the calculator runs. The number is printed at the
 * calculator's own precision (`formatPercent`, one decimal) and labelled as hero's share
 * of the pot, ties split, which is what `ExactEquity.equity` means. It says what the tool
 * DOES; it never says what to do with those two hands.
 */
import { GuideCards } from '../tools/GuideCards.js';
import { formatPercent } from '../../features/tools/format.js';
import type { ToolHubEntry } from '../../features/tools/index.js';
import { HOME_EQUITY_EXAMPLE, homeEquityExample } from './homeModel.js';

export interface HomeFeaturedToolsProps {
  readonly featured: ToolHubEntry;
  readonly secondary: readonly ToolHubEntry[];
  readonly className?: string;
}

const PRIMARY_LINK =
  'inline-flex min-h-11 items-center justify-center rounded-md bg-brand-600 px-5 py-2.5 font-medium ' +
  'text-ink-on-brand outline-none transition-colors hover:bg-brand-hover focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-brand-500';

const ROW_LINK =
  'inline-flex min-h-11 items-center gap-2 font-semibold text-text-100 outline-none hover:text-brand-500 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

function Planned({ label }: { readonly label: string }) {
  return (
    <span className="inline-flex min-h-11 items-center gap-2 font-semibold text-text-300">
      {label}
      <span className="rounded-full border border-line-500 px-1.5 py-0.5 text-[10px] font-medium">
        준비 중
      </span>
    </span>
  );
}

function FeaturedExample() {
  const example = homeEquityExample();
  return (
    <figure
      aria-label={`${HOME_EQUITY_EXAMPLE.hero} 대 ${HOME_EQUITY_EXAMPLE.villain}, 프리플랍 승률 예시`}
      className="rounded-xl border border-line-500 bg-ground-800 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <GuideCards cards={HOME_EQUITY_EXAMPLE.hero} label="내 패" size="md" />
        <span aria-hidden="true" className="text-sm font-semibold tracking-[0.1em] text-text-300">
          VS
        </span>
        <GuideCards cards={HOME_EQUITY_EXAMPLE.villain} label="상대 패" size="md" />
      </div>
      <figcaption className="mt-5 border-t border-line-500/60 pt-4">
        <p className="tabular text-4xl font-semibold tracking-[-0.01em] text-text-100">
          {formatPercent(example.result.equity)}
        </p>
        <p className="mt-1 text-sm text-text-300">
          {`프리플랍에서 ${HOME_EQUITY_EXAMPLE.hero.replace(' ', '')}의 팟 지분 · 비김은 반씩 · 남은 ${example.result.runouts.toLocaleString('ko-KR')}가지 보드를 전부 세어 계산`}
        </p>
      </figcaption>
    </figure>
  );
}

export function HomeFeaturedTools({ featured, secondary, className = '' }: HomeFeaturedToolsProps) {
  const featuredHref = featured.route.available ? featured.route.path : null;
  return (
    <div className={`grid gap-12 lg:grid-cols-12 lg:gap-14 ${className}`}>
      <article data-featured-tool={featured.route.id} className="min-w-0 lg:col-span-7">
        <p className="text-sm font-medium tracking-[0.06em] text-brand-500">대표 도구</p>
        <h3 className="mt-2 prose-ko text-2xl font-semibold text-text-100 sm:text-3xl">
          {featured.route.label}
        </h3>
        <p className="mt-2 max-w-lead prose-ko text-lg text-text-300">“{featured.question}”</p>
        <div className="mt-6">
          <FeaturedExample />
        </div>
        <p className="mt-5 max-w-lead prose-ko text-[0.9375rem] text-text-300">
          {featured.description}
        </p>
        <div className="mt-5">
          {featuredHref === null ? (
            <Planned label={`${featured.route.label} 열기`} />
          ) : (
            <a href={featuredHref} className={PRIMARY_LINK}>
              {featured.route.label} 열기
            </a>
          )}
        </div>
      </article>

      <div className="min-w-0 lg:col-span-5 lg:border-l lg:border-line-500 lg:pl-10">
        <p className="text-sm font-semibold tracking-[0.06em] text-text-300">그 밖의 도구</p>
        <ol className="mt-2 divide-y divide-line-500">
          {secondary.map((entry) => {
            const href = entry.route.available ? entry.route.path : null;
            return (
              <li key={entry.route.id} data-tool={entry.route.id} className="py-4">
                {href === null ? (
                  <Planned label={entry.route.label} />
                ) : (
                  <a href={href} className={ROW_LINK}>
                    {entry.route.label}
                    <span aria-hidden="true" className="text-brand-500">
                      →
                    </span>
                  </a>
                )}
                <p className="prose-ko text-sm text-text-300">{entry.question}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
