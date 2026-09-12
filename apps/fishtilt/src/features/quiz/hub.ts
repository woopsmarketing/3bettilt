/**
 * `/practice`'s content model — which quizzes the hub lists, in the same shape `features/
 * tools/hub.ts` uses for `/tools`.
 *
 * ## Why this is NOT just another filter over `src/lib/routes.ts`
 *
 * `toolHubEntries` can filter `ROUTES` because every tool it lists already has a registry
 * entry (built or not). None of the three quizzes do yet — WP-L1 (this work package) owns
 * only the hub page, and `src/lib/routes.ts` is edited by single-line targeted change only
 * (one entry per WP, per this repo's established rule); adding three placeholder entries
 * here would not be a targeted change and is not this WP's to make.
 *
 * So `PRACTICE_QUIZ_ENTRIES` below is this module's own small, hand-written list — the
 * three quizzes the build spec names — and `practiceHubCards` resolves each one against
 * `ROUTES` by id, TOLERATING an id that is not registered yet (`find`, not `routeById`,
 * which would throw). A quiz whose id has no registry entry renders exactly like one whose
 * entry says `available: false`: a non-interactive "준비 중" card, never a link.
 *
 * The ids below (`practiceRange`, `practiceHandRanking`, `practiceStartingHand`) and their
 * intended paths (`/practice/range`, `/practice/hand-ranking`, `/practice/starting-hand`)
 * are the contract WP-L2/L3 build against: each adds its OWN single targeted `routes.ts`
 * entry, using this exact id, when its route ships. The moment that entry says
 * `available: true`, this hub turns its card into a live link with NO edit to this file —
 * the same "flip the flag, not the page" guarantee `ToolCTA` and `/tools` already rely on.
 */
import { ROUTES, type RouteEntry } from '../../lib/routes.js';

export interface PracticeQuizEntry {
  readonly id: string;
  readonly label: string;
  /** One beginner-facing line: what solving this quiz gets you. No numbers, no claims —
   *  same discipline as `TOOL_DESCRIPTION`. */
  readonly description: string;
}

export const PRACTICE_QUIZ_ENTRIES: readonly PracticeQuizEntry[] = [
  {
    id: 'practiceRange',
    label: '레인지 퀴즈',
    description: '포지션별 학습용 기본 레인지에 이 패가 포함되는지 직접 맞혀보고 바로 확인합니다.',
  },
  {
    id: 'practiceHandRanking',
    label: '족보 퀴즈',
    description: '두 핸드 중 어떤 패가 이기는지 직접 맞혀보고 족보를 다시 확인합니다.',
  },
  {
    id: 'practiceStartingHand',
    label: '시작 핸드 퀴즈',
    description: '두 시작 패 중 어느 쪽이 더 강한지 직접 비교해봅니다.',
  },
];

export interface PracticeHubCard extends PracticeQuizEntry {
  /** `null` when `ROUTES` has no entry for this id yet — today, for all three. Once a WP
   *  registers its own entry, this resolves to it (built or not) and the card behaves
   *  exactly like a `/tools` card: a link when `available`, "준비 중" otherwise. */
  readonly route: RouteEntry | null;
}

/** Every planned quiz, in the order above, each with whatever `ROUTES` currently knows about
 *  it. Never throws — unlike `toolHubEntries`, a missing registry entry here is the expected
 *  state today, not a data error. */
export function practiceHubCards(): readonly PracticeHubCard[] {
  return PRACTICE_QUIZ_ENTRIES.map((entry) => ({
    ...entry,
    route: ROUTES.find((route) => route.id === entry.id) ?? null,
  }));
}
