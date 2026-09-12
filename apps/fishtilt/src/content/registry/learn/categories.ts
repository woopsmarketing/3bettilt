/**
 * Learn categories and roadmap stages (WP-S3-09, contract AR).
 *
 * The curriculum ORDER is the owner's decision and lives on each record's `order`; nothing
 * here reorders it. This module adds two orthogonal ways of reading the same fifteen
 * records:
 *
 * - **Categories** ("특정 주제 배우기"): the seven subjects the content audit
 *   (`3BETTILT_CONTENT_AUDIT.md` §3) proposed, verified against the inventory. Every lesson
 *   belongs to exactly one, by SLUG, in `LESSON_CATEGORY` below. The mapping is kept here
 *   rather than on `LearnRecord` because `types.ts` is owned by another WP this round and
 *   because a category is a hub concern, not a property the article template needs.
 *
 * - **Stages** ("처음부터 배우기"): three contiguous runs of the roadmap, so the ordered list
 *   reads as a progression rather than fifteen equal rows. Stages never interleave — a stage
 *   is `[first, last]` on `order`, and `categories.test.ts` proves the three tile 1..N with no
 *   gap and no overlap.
 *
 * ## Why `poker-actions` is "게임 시작" and not "베팅"
 *
 * Its `topic` is `'betting'`, but the lesson is the five actions a turn allows — mechanics a
 * reader needs before any betting strategy. The audit put it under 게임 시작 on that ground
 * and this module follows the audit; `topic` stays what it is (it drives thumbnails and
 * "same idea" grouping, not this browse).
 *
 * Nothing here is a poker fact: labels, descriptions and stage names describe what the
 * lessons cover, and every number on the hub is counted from the records at render.
 */
import type { LearnRecord } from '../../types.js';
import { LEARN_RECORDS } from './index.js';

export const LEARN_CATEGORIES = [
  {
    id: 'game-start',
    label: '게임 시작',
    description: '한 판이 어떤 순서로 흘러가고, 내 차례에 무엇을 할 수 있는지.',
  },
  {
    id: 'hand-rankings',
    label: '카드와 족보',
    description: '다섯 장으로 만드는 패의 순서와, 같은 족보끼리는 어떻게 비교하는지.',
  },
  {
    id: 'starting-hands',
    label: '시작 패',
    description: '처음 받은 두 장을 읽는 기준과, 시작 패를 강한 순서로 늘어놓으면 보이는 것.',
  },
  {
    id: 'range',
    label: '레인지',
    description: '13×13 표를 읽는 법과, 상대가 들고 있을 수 있는 패를 하나로 묶어 보는 방법.',
  },
  {
    id: 'position',
    label: '포지션',
    description: '여섯 자리의 이름과, 자리가 판단에 어떤 차이를 만드는지.',
  },
  {
    id: 'betting',
    label: '베팅',
    description: '프리플랍의 흐름과, 상대의 레이즈에 다시 레이즈하는 3벳.',
  },
  {
    id: 'math',
    label: '확률과 수학',
    description: '승률, 팟오즈, 아웃츠. 콜할 값어치를 숫자로 재는 세 가지 개념.',
  },
] as const;

export type LearnCategoryId = (typeof LEARN_CATEGORIES)[number]['id'];

export interface LearnCategory {
  readonly id: LearnCategoryId;
  readonly label: string;
  readonly description: string;
}

/**
 * slug → category. Keyed by slug (the URL segment), which is what a content agent sees in
 * the MDX filename; ids and slugs differ for one lesson (`hand-rankings` ↔
 * `poker-hand-rankings`) and the slug is the less ambiguous handle.
 */
export const LESSON_CATEGORY: Readonly<Record<string, LearnCategoryId>> = {
  'holdem-basics': 'game-start',
  'poker-actions': 'game-start',
  'flop-turn-river': 'game-start',
  'poker-hand-rankings': 'hand-rankings',
  'starting-hands': 'starting-hands',
  'starting-hand-ranking': 'starting-hands',
  'hand-matrix': 'range',
  'poker-range': 'range',
  position: 'position',
  'positions-6max': 'position',
  preflop: 'betting',
  'three-bet': 'betting',
  equity: 'math',
  'pot-odds': 'math',
  outs: 'math',
};

export interface LearnStage {
  readonly id: string;
  /** "1단계" — the ordinal the roadmap prints. */
  readonly ordinal: number;
  readonly label: string;
  readonly description: string;
  /** Inclusive `order` range. Contiguous with its neighbours; see the test. */
  readonly first: number;
  readonly last: number;
}

export const LEARN_STAGES: readonly LearnStage[] = [
  {
    id: 'stage-rules',
    ordinal: 1,
    label: '판의 규칙과 내 패',
    description: '한 판의 흐름, 족보, 시작 패, 그리고 13×13 표를 읽는 법.',
    first: 1,
    last: 5,
  },
  {
    id: 'stage-range-position',
    ordinal: 2,
    label: '레인지, 자리, 행동',
    description: '레인지라는 생각의 틀, 여섯 자리의 이름, 그리고 내 차례에 고를 수 있는 것들.',
    first: 6,
    last: 10,
  },
  {
    id: 'stage-postflop-math',
    ordinal: 3,
    label: '카드가 열린 뒤, 그리고 확률',
    description: '플랍·턴·리버, 재레이즈, 그리고 승률·팟오즈·아웃츠로 콜의 값어치를 재는 법.',
    first: 11,
    last: 15,
  },
];

export function categoryById(id: LearnCategoryId): LearnCategory {
  const category = LEARN_CATEGORIES.find((entry) => entry.id === id);
  if (category === undefined) throw new Error(`unknown learn category: ${id}`);
  return category;
}

/** The category a lesson belongs to, or `null` for a slug the mapping does not know. The
 *  hub uses this form: a record that reaches it uncategorised (a test fixture, or a lesson
 *  added without a mapping) still renders in the roadmap — it just carries no category and
 *  joins no topic section — rather than taking the whole page down. `categories.test.ts`
 *  guarantees no real lesson is ever in that state. */
export function categoryOfLessonOrNull(lesson: Pick<LearnRecord, 'slug'>): LearnCategory | null {
  const id = LESSON_CATEGORY[lesson.slug];
  return id === undefined ? null : categoryById(id);
}

/** The category a lesson belongs to. Throws for a slug the mapping does not know — the
 *  lesson TEMPLATE uses this form, because a published lesson without a category is a
 *  registry bug that should fail the build, not ship a header with a hole in it. */
export function categoryOfLesson(lesson: Pick<LearnRecord, 'slug'>): LearnCategory {
  const category = categoryOfLessonOrNull(lesson);
  if (category === null) throw new Error(`lesson "${lesson.slug}" has no learn category`);
  return category;
}

/** The stage a lesson sits in, or `null` when its order is outside every stage. */
export function stageOfLessonOrNull(lesson: Pick<LearnRecord, 'order'>): LearnStage | null {
  return (
    LEARN_STAGES.find((entry) => lesson.order >= entry.first && lesson.order <= entry.last) ?? null
  );
}

/** The lessons of one category, in curriculum order (never re-sorted by anything else). */
export function lessonsOfCategory(id: LearnCategoryId): readonly LearnRecord[] {
  return LEARN_RECORDS.filter((lesson) => LESSON_CATEGORY[lesson.slug] === id);
}

/** The lessons of one stage, in curriculum order. */
export function lessonsOfStage(stage: LearnStage): readonly LearnRecord[] {
  return LEARN_RECORDS.filter(
    (lesson) => lesson.order >= stage.first && lesson.order <= stage.last,
  );
}

/** The stage a lesson sits in. Throws when its order is outside every stage. */
export function stageOfLesson(lesson: Pick<LearnRecord, 'order'>): LearnStage {
  const stage = stageOfLessonOrNull(lesson);
  if (stage === null) throw new Error(`lesson order ${lesson.order} is outside every stage`);
  return stage;
}

/** Total lessons in the curriculum — the "15" in "레슨 3 / 15". */
export const LESSON_COUNT = LEARN_RECORDS.length;

/**
 * The lesson before and after `lesson` by curriculum ORDER (not by `nextLessons`, which is
 * an editorial relation and may skip ahead). `undefined` at either end of the roadmap — the
 * template renders the end honestly rather than inventing a neighbour.
 */
export function neighboursOf(lesson: Pick<LearnRecord, 'order'>): {
  readonly prev: LearnRecord | undefined;
  readonly next: LearnRecord | undefined;
} {
  return {
    prev: LEARN_RECORDS.find((entry) => entry.order === lesson.order - 1),
    next: LEARN_RECORDS.find((entry) => entry.order === lesson.order + 1),
  };
}

/** DOM ids the hub uses for its two modes and its category sections — one definition so the
 *  lesson header's "back to this category" link and the hub's anchors cannot drift apart. */
export const LEARN_HUB_ANCHORS = {
  roadmap: 'roadmap',
  topics: 'topics',
  category: (id: LearnCategoryId): string => `topic-${id}`,
} as const;
