/**
 * The featured-visual registry — which picture belongs to which page.
 *
 * ## Two kinds of picture, one lookup
 *
 * Most pages SHARE a picture: a lesson, a glossary term, a search guide and a hand page draw
 * the visual of their THEME (eight of them, below). A few pages carry their OWN picture —
 * today the six hand stories — and the page slots that belong to no record (home, hubs, About)
 * carry theirs in `PAGE_VISUALS`. `visualOf(record)` resolves a
 * record to an ordered list of candidate assets (its own first, then its theme's), and the
 * server-side source resolver (`components/visual/assetSource.ts`) serves the first one whose
 * file actually exists under `public/visuals/`.
 *
 * The files are built by `scripts/process-editorial-images.mjs` from
 * `scripts/editorial-images.manifest.json` (source PNG → crop → resize → JPEG); every asset
 * listed here has exactly one manifest row with the same file name and output size, and
 * `visualAssets.test.ts` holds the registry, the manifest and `public/visuals/` together.
 * A missing file still degrades to `ThemeArt` — the deterministic CSS/SVG scene for the
 * theme — in exactly the same box, so a slot never breaks; it just loses its photograph.
 *
 * ## Why a registry and not a field on each record
 *
 * Content records describe the piece (title, relations, level). A picture is presentation,
 * and 116 of the 124 records would carry the same eight values. Keying individual pictures by
 * record id here keeps the records untouched and the theme rules in one place.
 *
 * ## What a picture may show (AI image policy)
 *
 * Atmosphere only: a room, a table, light, a player thinking. Never a fact — no readable
 * card, no 13×13 range, no board, no number. Cards on a page are drawn by `PokerCards` from
 * data; a picture sits BEHIND them. Titles are never baked into a file: the page renders the
 * category and title as live HTML over a gradient (`EditorialCard`, `EditorialVisual`).
 */
import type {
  AnyContentRecord,
  BlogRecord,
  ContentTopic,
  GlossaryRecord,
  LearnRecord,
} from './types.js';
import { LESSON_CATEGORY, type LearnCategoryId } from './registry/learn/categories.js';
import { TERM_CATEGORY, type GlossaryCategoryId } from './registry/glossary/categories.js';

export const VISUAL_THEMES = [
  'basics',
  'rankings',
  'starting-hands',
  'range',
  'position',
  'betting',
  'math',
  'story',
] as const;

export type VisualThemeId = (typeof VISUAL_THEMES)[number];

/**
 * How a picture is announced where a slot opts in to describing it (`EditorialVisual`'s
 * `describe`). `informational`: the picture shows something the page is about — a six-seat
 * table on a position lesson, the moment a story is about — so it carries a descriptive `alt`.
 * `decorative`: atmosphere beside text that already says everything (a hub's opening portrait,
 * a band behind a sentence), so its `alt` is deliberately `''`. Every asset makes the choice
 * explicitly; there is no "no alt" state.
 */
export type VisualRole = 'informational' | 'decorative';

/** One raster the site can use. `file` is relative to `public/visuals/`. */
export interface VisualAssetSpec {
  readonly id: string;
  /**
   * Describes what the picture shows, in lowercase ASCII kebab-case, never the brand name —
   * this is the crawlable image URL (`/visuals/{file}`), so it names the content, not the slot.
   */
  readonly file: string;
  /** Intrinsic size of the master file (16:9 masters are 1920×1080). */
  readonly width: number;
  readonly height: number;
  readonly role: VisualRole;
  /** The rendered `alt`: a one-line description for `informational`, `''` for `decorative`. */
  readonly alt: string;
  /** What is in the frame, for maintainers and the manifest — never rendered. */
  readonly description: string;
}

export interface VisualTheme {
  readonly id: VisualThemeId;
  /** Short Korean name — shown nowhere on the page; used by the manifest and tests. */
  readonly label: string;
  readonly asset: VisualAssetSpec;
}

/** A resolved visual for one page: its candidates in priority order, plus the drawn fallback. */
export interface ContentVisual {
  readonly theme: VisualThemeId;
  /** `individual` when the record has its own slot, `theme` when it shares one. */
  readonly scope: 'individual' | 'theme';
  /** Own asset first (if any), then the theme's. The first existing file wins. */
  readonly candidates: readonly VisualAssetSpec[];
  /** Stable per-page seed for `ThemeArt`, so siblings of one theme are not identical. */
  readonly variant: string;
}

const MASTER_16_9 = { width: 1920, height: 1080 } as const;

/**
 * A picture that shows what its page is about: the `alt` is also its description.
 * Written for the picture as it appears on EVERY page that uses it (a theme picture opens
 * many lessons), so it describes the frame plus the topic, never one page's claim.
 */
function informational(
  id: string,
  file: string,
  size: { readonly width: number; readonly height: number },
  alt: string,
): VisualAssetSpec {
  return { id, file, ...size, role: 'informational', alt, description: alt };
}

/** Atmosphere only: rendered with `alt=""`; the description stays for maintainers. */
function decorative(
  id: string,
  file: string,
  size: { readonly width: number; readonly height: number },
  description: string,
): VisualAssetSpec {
  return { id, file, ...size, role: 'decorative', alt: '', description };
}

export const THEME_VISUALS: Readonly<Record<VisualThemeId, VisualTheme>> = {
  basics: {
    id: 'basics',
    label: '홀덤 기초',
    asset: informational(
      'theme-basics',
      'empty-poker-table-under-pendant-light.jpg',
      MASTER_16_9,
      '어두운 방, 펜던트 조명 아래 게임을 기다리는 빈 포커 테이블',
    ),
  },
  rankings: {
    id: 'rankings',
    label: '카드와 족보',
    asset: informational(
      'theme-rankings',
      'card-decks-and-poker-chips.jpg',
      MASTER_16_9,
      '뒷면이 보이는 카드 덱과 포커 칩을 가까이서 담은 장면',
    ),
  },
  'starting-hands': {
    id: 'starting-hands',
    label: '시작 패',
    asset: informational(
      'theme-starting-hands',
      'two-face-down-hole-cards.jpg',
      MASTER_16_9,
      '플레이어의 손 옆에 뒷면으로 놓인 두 장의 홀카드',
    ),
  },
  range: {
    id: 'range',
    label: '레인지와 표',
    asset: informational(
      'theme-range',
      'poker-study-notebook-and-cards.jpg',
      MASTER_16_9,
      '노트와 연필, 카드 한 벌이 놓인 붉은 조명의 포커 공부 책상',
    ),
  },
  position: {
    id: 'position',
    label: '포지션과 테이블',
    asset: informational(
      'theme-position',
      'six-seat-poker-table-top-view.jpg',
      MASTER_16_9,
      '위에서 내려다본 6인용 포커 테이블의 좌석과 딜러 버튼',
    ),
  },
  betting: {
    id: 'betting',
    label: '베팅과 액션',
    asset: informational(
      'theme-betting',
      'hand-pushing-poker-chips.jpg',
      MASTER_16_9,
      '칩 한 묶음을 앞으로 미는 손과 흐릿한 배경의 테이블',
    ),
  },
  math: {
    id: 'math',
    label: '확률과 수학',
    asset: informational(
      'theme-math',
      'player-thinking-by-probability-charts.jpg',
      MASTER_16_9,
      '확률 그래프가 흐릿하게 비치는 벽 앞에서 생각에 잠긴 플레이어',
    ),
  },
  story: {
    id: 'story',
    label: '핸드 스토리',
    asset: informational(
      'theme-story',
      'late-night-poker-hand-in-progress.jpg',
      MASTER_16_9,
      '늦은 밤 포커 룸, 한 판에 집중한 두 플레이어',
    ),
  },
};

/**
 * Pages with their own picture, keyed by content id. Every hand story gets one — the
 * editorial pillar of the blog, and the pages the home page and the hub feature. Each is the
 * story's moment, so its `alt` names the moment in the story's words.
 */
export const INDIVIDUAL_VISUALS: Readonly<Record<string, VisualAssetSpec>> = {
  'blog-qq-vs-72o-flop-227': informational(
    'story-qq-vs-72o-flop-227',
    'player-stunned-by-qq-vs-72o-flop.jpg',
    MASTER_16_9,
    '2-2-7 플랍을 보고 입을 가린 채 테이블을 내려다보는 플레이어',
  ),
  'blog-full-house-loses': informational(
    'story-full-house-loses',
    'player-leaning-back-after-full-house-loss.jpg',
    MASTER_16_9,
    '풀하우스로 지고 의자에 등을 기댄 채 허공을 올려다보는 플레이어',
  ),
  'blog-qq-three-bet-frustration': informational(
    'story-qq-three-bet-frustration',
    'player-frustrated-after-qq-three-bet.jpg',
    MASTER_16_9,
    'QQ로 3벳한 뒤 팔짱을 끼고 맞은편 상대를 노려보는 플레이어',
  ),
  'blog-river-changes-everything': informational(
    'story-river-changes-everything',
    'dealer-placing-river-card.jpg',
    MASTER_16_9,
    '딜러가 보드에 마지막 리버 카드를 내려놓는 순간',
  ),
  'blog-aa-loses': informational(
    'story-aa-loses',
    'player-losing-stack-with-pocket-aces.jpg',
    MASTER_16_9,
    '포켓 에이스로 스택을 잃고 눈을 감은 채 카드를 밀어 내는 플레이어',
  ),
  'blog-ak-flop-miss': informational(
    'story-ak-flop-miss',
    'player-thinking-after-ak-misses-flop.jpg',
    MASTER_16_9,
    'AK로 플랍을 놓치고 턱을 괸 채 칩을 만지작거리며 고민하는 플레이어',
  ),
};

const size = (width: number, height: number) => ({ width, height }) as const;

/**
 * Page-level slots that belong to no content record: the brand pictures of the home page, the
 * hubs and About. Each key is used by exactly one component (`visualAssets.test.ts` checks),
 * so a picture never repeats on a screen and no component spells a file path.
 *
 * All decorative: each sits beside the page's `<h1>` or behind a sentence that already says
 * what the section is, and a portrait of a player adds nothing a screen reader should repeat.
 */
export const PAGE_VISUALS = {
  /** Home hero, 4:5 — the five code-drawn cards sit in its lower band. */
  homeHero: decorative(
    'home-hero',
    'smiling-player-in-poker-lounge.jpg',
    size(1120, 1400),
    '포커 룸의 가죽 의자에 턱을 괴고 앉아 미소 짓는 플레이어',
  ),
  /** Home breathing band, 21:9 — the statement sits over its left side. */
  homeBreathing: decorative(
    'home-breathing',
    'poker-lounge-table-wide-view.jpg',
    size(2400, 1028),
    '어두운 포커 룸의 넓은 전경, 조명 아래 칩이 놓인 테이블',
  ),
  /** Home roadmap, one 21:9 picture per learning stage. */
  homeStageRules: decorative(
    'home-stage-rules',
    'face-down-cards-fanned-on-felt.jpg',
    size(1680, 720),
    '펠트 위에 뒷면으로 펼쳐 놓은 카드와 칩',
  ),
  homeStageRangePosition: decorative(
    'home-stage-range-position',
    'round-poker-table-top-view.jpg',
    size(1680, 720),
    '위에서 내려다본 원형 포커 테이블과 둘러앉을 자리',
  ),
  homeStagePostflopMath: decorative(
    'home-stage-postflop-math',
    'notebook-pen-and-cards-on-poker-table.jpg',
    size(1680, 720),
    '테이블 위에 놓인 노트와 펜, 카드 한 벌',
  ),
  /** Home closing call to action, 21:9 backdrop under the band's text. */
  homeFeature: decorative(
    'brand-feature',
    'hand-stacking-poker-chips.jpg',
    size(2400, 1028),
    '테이블 위에서 칩을 쌓는 손',
  ),
  /** Hub and About heroes. */
  blogHub: decorative(
    'brand-blog',
    'player-on-red-velvet-sofa.jpg',
    size(1200, 800),
    '붉은 벨벳 소파 앞에서 턱을 괴고 앉은 플레이어',
  ),
  learnHub: decorative(
    'brand-learn',
    'hand-resting-on-face-down-cards.jpg',
    size(1200, 800),
    '뒷면으로 놓인 두 장의 카드에 손을 올린 플레이어',
  ),
  handsHub: decorative(
    'brand-hands',
    'player-resting-chin-at-poker-table.jpg',
    size(1200, 800),
    '칩을 앞에 두고 테이블에 턱을 괴고 앉은 플레이어',
  ),
  practiceHub: decorative(
    'brand-practice',
    'player-holding-up-two-cards.jpg',
    size(1200, 800),
    '뒷면이 보이는 카드 두 장을 들어 보이는 플레이어',
  ),
  glossaryHub: decorative(
    'brand-glossary',
    'player-thinking-at-poker-table.jpg',
    size(1200, 800),
    '테이블에 앉아 생각에 잠긴 플레이어',
  ),
  toolsHub: decorative(
    'brand-tools',
    'player-in-red-lit-poker-room.jpg',
    size(1200, 800),
    '붉은 조명 아래 테이블 앞에 선 플레이어',
  ),
  aboutHero: decorative(
    'brand-about',
    'player-beside-spade-emblem-wall.jpg',
    size(1280, 720),
    '스페이드 문양이 걸린 벽 앞에서 턱을 괴고 미소 짓는 플레이어',
  ),
  aboutTable: decorative(
    'brand-about-table',
    'two-players-facing-off-late-night.jpg',
    size(1680, 720),
    '늦은 밤 테이블에서 마주 앉아 수를 고민하는 두 플레이어',
  ),
} as const satisfies Readonly<Record<string, VisualAssetSpec>>;

export type PageVisualKey = keyof typeof PAGE_VISUALS;

export const TOPIC_THEME: Readonly<Record<ContentTopic, VisualThemeId>> = {
  rules: 'basics',
  'hand-strength': 'rankings',
  'starting-hands': 'starting-hands',
  range: 'range',
  position: 'position',
  betting: 'betting',
  odds: 'math',
  equity: 'math',
};

export const LEARN_CATEGORY_THEME: Readonly<Record<LearnCategoryId, VisualThemeId>> = {
  'game-start': 'basics',
  'hand-rankings': 'rankings',
  'starting-hands': 'starting-hands',
  range: 'range',
  position: 'position',
  betting: 'betting',
  math: 'math',
};

export const GLOSSARY_CATEGORY_THEME: Readonly<Record<GlossaryCategoryId, VisualThemeId>> = {
  game: 'basics',
  betting: 'betting',
  position: 'position',
  'hand-rankings': 'rankings',
  math: 'math',
  'starting-hands': 'starting-hands',
};

function themeOfLearn(record: LearnRecord): VisualThemeId {
  const category = LESSON_CATEGORY[record.slug];
  return category === undefined ? TOPIC_THEME[record.topic] : LEARN_CATEGORY_THEME[category];
}

function themeOfGlossary(record: GlossaryRecord): VisualThemeId {
  const category = TERM_CATEGORY[record.slug];
  return category === undefined ? TOPIC_THEME[record.topic] : GLOSSARY_CATEGORY_THEME[category];
}

function themeOfBlog(record: BlogRecord): VisualThemeId {
  return record.contentType === 'hand-story' ? 'story' : TOPIC_THEME[record.topic];
}

export function themeOf(record: AnyContentRecord): VisualThemeId {
  switch (record.kind) {
    case 'learn':
      return themeOfLearn(record);
    case 'glossary':
      return themeOfGlossary(record);
    case 'blog':
      return themeOfBlog(record);
    case 'hands':
      return 'starting-hands';
  }
}

export function visualOf(record: AnyContentRecord): ContentVisual {
  const theme = themeOf(record);
  const own = INDIVIDUAL_VISUALS[record.id];
  return {
    theme,
    scope: own === undefined ? 'theme' : 'individual',
    candidates:
      own === undefined ? [THEME_VISUALS[theme].asset] : [own, THEME_VISUALS[theme].asset],
    variant: record.id,
  };
}

/** A theme's shared picture on its own — a hub's category header, where no record applies. */
export function themeVisual(theme: VisualThemeId, variant = ''): ContentVisual {
  return { theme, scope: 'theme', candidates: [THEME_VISUALS[theme].asset], variant };
}

/** A page slot (home hero, breathing band) as a `ContentVisual`, with its drawn theme. */
export function pageVisual(asset: VisualAssetSpec, theme: VisualThemeId): ContentVisual {
  return { theme, scope: 'individual', candidates: [asset], variant: asset.id };
}

/** Every asset the site can use, deduplicated — the manifest and the tests read this. */
export function allVisualAssets(): readonly VisualAssetSpec[] {
  return [
    ...VISUAL_THEMES.map((id) => THEME_VISUALS[id].asset),
    ...Object.values(INDIVIDUAL_VISUALS),
    ...Object.values(PAGE_VISUALS),
  ];
}
