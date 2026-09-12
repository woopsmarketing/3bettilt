/**
 * `/practice`'s presentation model — what each quiz TRAINS, how a round runs, and which
 * lesson/tool it drills — keyed by the same ids `PRACTICE_QUIZ_ENTRIES` (`hub.ts`) declares.
 *
 * Kept apart from `hub.ts` on purpose. `hub.ts` is the honesty gate (which quizzes exist,
 * which are built) and `practiceHubCards` is mocked wholesale by `page.test.tsx` to prove
 * that gate in all three states; a page that read presentation fields off those cards would
 * either break that mock or have to duplicate it. This module is looked up BY ID at render
 * time and tolerates an id it does not know (`practiceQuizDetail` returns `null`), so the
 * hub can always render a quiz the registry names, with or without a story to tell about it.
 *
 * Copy only — no poker facts, no numbers a reader would have to trust (`hub.test.ts`'s own
 * rule for descriptions applies here too and is tested the same way). The `lesson` and
 * `tool` ids are the ones the quiz banks themselves stamp on every question
 * (`rangeQuestions.ts`, `handRankingQuestions.ts`, `startingHandQuestions.ts`).
 */

export type PracticeQuizVisual = 'position' | 'showdown' | 'compare';

export interface PracticeQuizDetail {
  /** What a reader gets better at by doing this quiz — short noun phrases, no digits. */
  readonly trains: readonly string[];
  /** One line on how a round runs. */
  readonly format: string;
  /** Which drawing the hub row shows beside the text. */
  readonly visual: PracticeQuizVisual;
  /** The lesson this quiz drills — a content id (`hrefOfContent` decides if it is linkable). */
  readonly lesson: string;
  /** The tool this quiz is scored against — a route id (`toolHref` decides if it is linkable). */
  readonly tool: string;
}

const DETAIL: Readonly<Record<string, PracticeQuizDetail>> = {
  practiceRange: {
    trains: ['포지션별 오픈 레인지 감각', '시작 패 표기 읽기', '핸드 매트릭스를 머릿속에 그리기'],
    format: '자리를 하나 고르고, 시작 패가 그 자리의 레인지에 드는지 포함/제외로 답합니다.',
    visual: 'position',
    lesson: 'poker-range',
    tool: 'range',
  },
  practiceHandRanking: {
    trains: ['족보 순서 외우기', '보드와 합친 최고의 다섯 장 찾기', '무승부 알아보기'],
    format: '두 핸드와 보드를 보고 어느 쪽이 이기는지, 또는 무승부인지 고릅니다.',
    visual: 'showdown',
    lesson: 'hand-rankings',
    tool: 'toolHandChecker',
  },
  practiceStartingHand: {
    trains: ['시작 패 강약 비교', '수티드·오프수트·페어의 차이', '직감과 숫자의 차이 확인'],
    format: '두 시작 패 중 프리플랍 기본 강도가 더 높은 쪽을 고릅니다. 동률도 선택지입니다.',
    visual: 'compare',
    lesson: 'starting-hand-ranking',
    tool: 'toolStartingHand',
  },
};

/** The ids this module describes, in `PRACTICE_QUIZ_ENTRIES` order. */
export const PRACTICE_QUIZ_DETAIL_IDS: readonly string[] = Object.keys(DETAIL);

/** `null` for an id this module has no story for — the hub still lists the quiz. */
export function practiceQuizDetail(id: string): PracticeQuizDetail | null {
  return DETAIL[id] ?? null;
}

/** The four steps every quiz shares, for the hub's "어떻게 진행되나요" timeline. */
export const PRACTICE_FLOW_STEPS: readonly { readonly title: string; readonly body: string }[] = [
  { title: '한 문제씩 고릅니다', body: '카드와 질문이 하나씩 나오고, 큰 버튼으로 답을 고릅니다.' },
  {
    title: '그 자리에서 채점됩니다',
    body: '고르는 순간 맞았는지 보이고, 왜 그런지 이유가 함께 나옵니다.',
  },
  {
    title: '관련 레슨과 도구로 이어집니다',
    body: '이유 아래에 그 개념을 설명한 레슨과 직접 확인할 도구가 붙어 있습니다.',
  },
  {
    title: '틀린 문제만 다시 풉니다',
    body: '결과 화면에서 틀린 문제만 골라 다시 풀거나, 처음부터 다시 시작합니다.',
  },
];
