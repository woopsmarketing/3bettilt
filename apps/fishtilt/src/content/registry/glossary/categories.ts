/**
 * Glossary categories and headwords (WP-S3-11, contracts AU/AV).
 *
 * Two orthogonal readings of the same records, kept OUT of `GlossaryRecord` for the same
 * reason `registry/learn/categories.ts` keeps lesson categories out of `LearnRecord`: a
 * category is a hub concern, `types.ts` is shared with other WPs, and a mapping keyed by
 * slug is what a content agent sees in the MDX filename.
 *
 * - **Categories** — the six subjects the content audit (`3BETTILT_CONTENT_AUDIT.md` §4)
 *   proposed, verified against the inventory. Every term belongs to exactly one, by SLUG,
 *   in `TERM_CATEGORY`; `categories.test.ts` proves the mapping is exhaustive, that no
 *   category is empty, and that it matches the audit's per-term assignment.
 *
 * - **Headwords** — the Korean name a dictionary row is filed under (ㄱ ㄴ ㄷ …). A record's
 *   `title` leads with this headword and then glosses it ("포지션 (Position) — 내 차례가 오는
 *   자리", WP-S3-19) and its `term` is the Latin name; the headword is the word a Korean
 *   reader looks up, so every `title` must contain it (`categories.test.ts`). The headword
 *   is ALWAYS one of the record's own `aliases` or its `term` — the test enforces it — so this table
 *   invents no name, it only picks which existing spelling leads. Where a term has a
 *   digit-first spelling ("3벳") the Hangul spelling ("쓰리벳") is chosen so the row files
 *   under a consonant tab rather than under A–Z.
 *
 * ## Category assignment notes (differences from `topic`)
 *
 * `topic` drives thumbnails and "same idea" grouping and stays untouched. Three terms sit
 * in a different category than their `topic` suggests, exactly as the audit ruled:
 * `preflop` (topic betting → 게임 구조: it names a street), `equity` (topic equity → 확률·
 * 수학) and `nuts` (topic hand-strength → 카드·족보, unchanged in spirit).
 */
import type { GlossaryRecord } from '../../types.js';
import { GLOSSARY_RECORDS } from './index.js';
import { compareHeadwords, initialOf, initialRank } from './initials.js';

export const GLOSSARY_CATEGORIES = [
  {
    id: 'game',
    label: '게임 구조',
    description: '한 판이 어떻게 돌아가는지: 강제로 내는 돈, 판돈, 카드가 열리는 순서와 이름.',
  },
  {
    id: 'betting',
    label: '베팅·액션',
    description: '내 차례에 고를 수 있는 행동과, 프리플랍에서 오가는 레이즈에 붙은 이름들.',
  },
  {
    id: 'position',
    label: '포지션',
    description: '6인 테이블의 여섯 자리와, 자리가 행동 순서를 어떻게 정하는지.',
  },
  {
    id: 'hand-rankings',
    label: '카드·족보',
    description: '다섯 장으로 만드는 아홉 가지 족보와, 같은 족보끼리 승부를 가리는 말들.',
  },
  {
    id: 'math',
    label: '확률·수학',
    description: '아직 완성되지 않은 패를 세고, 콜할 값어치를 숫자로 재는 개념들.',
  },
  {
    id: 'starting-hands',
    label: '시작 핸드·레인지',
    description: '처음 받은 두 장을 부르는 말과, 그 패들을 묶어서 보는 13×13 표.',
  },
] as const;

export type GlossaryCategoryId = (typeof GLOSSARY_CATEGORIES)[number]['id'];

export interface GlossaryCategory {
  readonly id: GlossaryCategoryId;
  readonly label: string;
  readonly description: string;
}

/** slug → category. The audit's §4 table, one line per term. */
export const TERM_CATEGORY: Readonly<Record<string, GlossaryCategoryId>> = {
  // 게임 구조
  ante: 'game',
  blind: 'game',
  'big-blind': 'game',
  'small-blind': 'game',
  stack: 'game',
  pot: 'game',
  'heads-up': 'game',
  showdown: 'game',
  preflop: 'game',
  board: 'game',
  'community-cards': 'game',
  flop: 'game',
  turn: 'game',
  river: 'game',
  // 베팅·액션
  'open-raise': 'betting',
  action: 'betting',
  'all-in': 'betting',
  check: 'betting',
  call: 'betting',
  bet: 'betting',
  raise: 'betting',
  fold: 'betting',
  limp: 'betting',
  'three-bet': 'betting',
  'four-bet': 'betting',
  'c-bet': 'betting',
  bluff: 'betting',
  vpip: 'betting',
  pfr: 'betting',
  // 포지션
  position: 'position',
  button: 'position',
  cutoff: 'position',
  hijack: 'position',
  utg: 'position',
  'ip-oop': 'position',
  // 카드·족보
  'hand-ranking': 'hand-rankings',
  'high-card': 'hand-rankings',
  'one-pair': 'hand-rankings',
  'two-pair': 'hand-rankings',
  'three-of-a-kind': 'hand-rankings',
  'set-vs-trips': 'hand-rankings',
  straight: 'hand-rankings',
  flush: 'hand-rankings',
  'full-house': 'hand-rankings',
  'four-of-a-kind': 'hand-rankings',
  'straight-flush': 'hand-rankings',
  kicker: 'hand-rankings',
  'split-pot': 'hand-rankings',
  nuts: 'hand-rankings',
  // 확률·수학
  draw: 'math',
  outs: 'math',
  equity: 'math',
  'pot-odds': 'math',
  gutshot: 'math',
  'open-ended': 'math',
  // 시작 핸드·레인지
  range: 'starting-hands',
  suited: 'starting-hands',
  offsuit: 'starting-hands',
  'pocket-pair': 'starting-hands',
  combo: 'starting-hands',
  hand: 'starting-hands',
  'hand-matrix': 'starting-hands',
  broadway: 'starting-hands',
  connector: 'starting-hands',
};

/**
 * slug → headword. Each value is verbatim one of that record's `aliases` or its `term`
 * (`categories.test.ts`). Chosen for how a Korean reader says the word, with the spaced
 * spelling where the aliases offer both ("빅 블라인드" over "빅블라인드").
 */
export const TERM_HEADWORD: Readonly<Record<string, string>> = {
  ante: '앤티',
  blind: '블라인드',
  'big-blind': '빅 블라인드',
  'small-blind': '스몰 블라인드',
  stack: '스택',
  pot: '팟',
  'heads-up': '헤즈업',
  showdown: '쇼다운',
  preflop: '프리플랍',
  board: '보드',
  'community-cards': '커뮤니티 카드',
  flop: '플랍',
  turn: '턴',
  river: '리버',
  'open-raise': '오픈 레이즈',
  action: '액션',
  'all-in': '올인',
  check: '체크',
  call: '콜',
  bet: '베팅',
  raise: '레이즈',
  fold: '폴드',
  limp: '림프',
  'three-bet': '쓰리벳',
  'four-bet': '포벳',
  'c-bet': '컨티뉴에이션 벳',
  bluff: '블러프',
  vpip: 'VPIP',
  pfr: 'PFR',
  position: '포지션',
  button: '버튼',
  cutoff: '컷오프',
  hijack: '하이잭',
  utg: '언더 더 건',
  'ip-oop': '인포지션',
  'hand-ranking': '족보',
  'high-card': '하이카드',
  'one-pair': '원페어',
  'two-pair': '투페어',
  'three-of-a-kind': '트리플',
  'set-vs-trips': '셋 vs 트립스',
  straight: '스트레이트',
  flush: '플러시',
  'full-house': '풀하우스',
  'four-of-a-kind': '포카드',
  'straight-flush': '스트레이트 플러시',
  kicker: '키커',
  'split-pot': '스플릿 팟',
  nuts: '넛',
  draw: '드로우',
  outs: '아웃츠',
  equity: '에퀴티',
  'pot-odds': '팟오즈',
  gutshot: '거트샷',
  'open-ended': '오픈엔디드',
  range: '레인지',
  suited: '수티드',
  offsuit: '오프수트',
  'pocket-pair': '포켓 페어',
  combo: '콤보',
  hand: '핸드',
  'hand-matrix': '핸드 매트릭스',
  broadway: '브로드웨이',
  connector: '커넥터',
};

export function categoryById(id: GlossaryCategoryId): GlossaryCategory {
  const category = GLOSSARY_CATEGORIES.find((entry) => entry.id === id);
  if (category === undefined) throw new Error(`unknown glossary category: ${id}`);
  return category;
}

/** The category a term belongs to, or `null` for a slug the mapping does not know. The hub
 *  uses this form so a test fixture still renders in the index (it just joins no category
 *  section); `categories.test.ts` guarantees no real term is ever in that state. */
export function categoryOfTermOrNull(term: Pick<GlossaryRecord, 'slug'>): GlossaryCategory | null {
  const id = TERM_CATEGORY[term.slug];
  return id === undefined ? null : categoryById(id);
}

/** The category a term belongs to. Throws for an unmapped slug — the term TEMPLATE uses
 *  this form, because a published term without a category is a registry bug that should
 *  fail the build rather than ship a header with a hole in it. */
export function categoryOfTerm(term: Pick<GlossaryRecord, 'slug'>): GlossaryCategory {
  const category = categoryOfTermOrNull(term);
  if (category === null) throw new Error(`term "${term.slug}" has no glossary category`);
  return category;
}

/** The terms of one category, in headword (ㄱㄴㄷ) order. */
export function termsOfCategory(id: GlossaryCategoryId): readonly GlossaryRecord[] {
  return sortByHeadword(GLOSSARY_RECORDS.filter((term) => TERM_CATEGORY[term.slug] === id));
}

/**
 * The headword of a record. The explicit table first; for a record outside it (a test
 * fixture) the first Hangul alias, then the `term` — never a made-up string.
 */
export function headwordOf(term: Pick<GlossaryRecord, 'slug' | 'term' | 'aliases'>): string {
  const mapped = TERM_HEADWORD[term.slug];
  if (mapped !== undefined) return mapped;
  const hangul = term.aliases.find((alias) => initialOf(alias) !== 'A–Z');
  return hangul ?? term.term;
}

/**
 * The record's other names, for the "쓰리벳 · 3-Bet · 3bet" line: the Latin `term` first,
 * then every alias that is not the headword itself, in registry order. The `title` is not
 * a name and is not included.
 */
export function otherNamesOf(
  term: Pick<GlossaryRecord, 'slug' | 'term' | 'aliases'>,
): readonly string[] {
  const headword = headwordOf(term);
  const names = [term.term, ...term.aliases].filter((name) => name !== headword);
  return [...new Set(names)];
}

/** Dictionary order: by initial tab (ㄱ … ㅎ, A–Z), then Korean collation of the headword. */
export function sortByHeadword(terms: readonly GlossaryRecord[]): readonly GlossaryRecord[] {
  return [...terms].sort((a, b) => {
    const ha = headwordOf(a);
    const hb = headwordOf(b);
    const byTab = initialRank(initialOf(ha)) - initialRank(initialOf(hb));
    return byTab !== 0 ? byTab : compareHeadwords(ha, hb);
  });
}

/** DOM ids the hub uses for its regions and sections — one definition so the term header's
 *  "back to this category" link and the hub's anchors cannot drift apart. */
export const GLOSSARY_HUB_ANCHORS = {
  search: 'glossary-search',
  popular: 'popular',
  categories: 'categories',
  index: 'index',
  category: (id: GlossaryCategoryId): string => `cat-${id}`,
  initial: (anchor: string): string => `initial-${anchor}`,
} as const;
