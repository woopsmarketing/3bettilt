/**
 * `QuizPageHeader` — the recessed header band every `/practice/*` page opens with: the
 * breadcrumb trail, the `PageHero` (one `<h1>`), and a row of plain facts about the round
 * (문제 수, 채점 방식, 데이터 출처) so a reader knows what they are about to do before the
 * first question appears (Stage 3 contract BF).
 *
 * A server component; the pages compose it inside a `Section`. The facts are strings the
 * page owns — counts come from the page's own constants (`limit`), never typed twice.
 */
import type { BreadcrumbItem } from '../lib/seo/index.js';
import { Breadcrumbs } from './Breadcrumbs.js';
import { PageHero, type PageHeroFact } from './PageHero.js';

export interface QuizPageHeaderProps {
  readonly trail: readonly BreadcrumbItem[];
  readonly title: string;
  readonly description: string;
  readonly facts: readonly PageHeroFact[];
  readonly eyebrow?: string;
}

export function QuizPageHeader({
  trail,
  title,
  description,
  facts,
  eyebrow = '퀴즈',
}: QuizPageHeaderProps) {
  return (
    <>
      <Breadcrumbs className="mb-6" trail={trail} />
      <PageHero eyebrow={eyebrow} title={title} description={description} />
      <ul aria-label="퀴즈 정보" className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
        {facts.map((fact) => (
          <li key={fact.label} className="min-w-0">
            <span className="block text-xs font-semibold tracking-[0.06em] text-text-300">
              {fact.label}
            </span>
            <span className="prose-ko block text-sm font-medium text-text-100">{fact.value}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
