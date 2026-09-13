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

/** One raster the site can use. `file` is relative to `public/visuals/`. */
export interface VisualAssetSpec {
  readonly id: string;
  readonly file: string;
  /** Intrinsic size of the master file (16:9 masters are 1920×1080). */
  readonly width: number;
  readonly height: number;
  /** Describes the picture itself, for the rare non-decorative use and for the manifest. */
  readonly alt: string;
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

function themeAsset(id: VisualThemeId, alt: string): VisualAssetSpec {
  return { id: `theme-${id}`, file: `theme-${id}.jpg`, ...MASTER_16_9, alt };
}

export const THEME_VISUALS: Readonly<Record<VisualThemeId, VisualTheme>> = {
  basics: {
    id: 'basics',
    label: '홀덤 기초',
    asset: themeAsset('basics', '어두운 방, 펜던트 조명 아래 게임을 기다리는 빈 포커 테이블'),
  },
  rankings: {
    id: 'rankings',
    label: '카드와 족보',
    asset: themeAsset('rankings', '뒷면이 보이는 카드 덱과 칩을 가까이서 담은 장면'),
  },
  'starting-hands': {
    id: 'starting-hands',
    label: '시작 패',
    asset: themeAsset('starting-hands', '플레이어의 손 옆에 뒷면으로 놓인 두 장의 카드'),
  },
  range: {
    id: 'range',
    label: '레인지와 표',
    asset: themeAsset('range', '노트와 연필, 카드 한 벌이 놓인 붉은 조명의 책상'),
  },
  position: {
    id: 'position',
    label: '포지션과 테이블',
    asset: themeAsset('position', '위에서 내려다본 6인 포커 테이블과 딜러 버튼'),
  },
  betting: {
    id: 'betting',
    label: '베팅과 액션',
    asset: themeAsset('betting', '칩을 앞으로 미는 손과 흐릿한 배경의 테이블'),
  },
  math: {
    id: 'math',
    label: '확률과 수학',
    asset: themeAsset('math', '생각에 잠긴 플레이어의 옆모습, 뒤로 흐릿한 추상 도형'),
  },
  story: {
    id: 'story',
    label: '핸드 스토리',
    asset: themeAsset('story', '늦은 밤 포커 룸, 한 판에 집중한 두 플레이어'),
  },
};

function individualAsset(id: string, alt: string): VisualAssetSpec {
  return { id, file: `${id}.jpg`, ...MASTER_16_9, alt };
}

/**
 * Pages with their own picture, keyed by content id. Every hand story gets one — the
 * editorial pillar of the blog, and the pages the home page and the hub feature.
 */
export const INDIVIDUAL_VISUALS: Readonly<Record<string, VisualAssetSpec>> = {
  'blog-qq-vs-72o-flop-227': individualAsset(
    'story-qq-vs-72o-flop-227',
    '입을 가린 채 굳은 표정으로 테이블을 내려다보는 플레이어',
  ),
  'blog-full-house-loses': individualAsset(
    'story-full-house-loses',
    '의자에 등을 기대고 허공을 올려다보는 플레이어',
  ),
  'blog-qq-three-bet-frustration': individualAsset(
    'story-qq-three-bet-frustration',
    '팔짱을 끼고 맞은편 상대를 노려보는 플레이어',
  ),
  'blog-river-changes-everything': individualAsset(
    'story-river-changes-everything',
    '딜러가 마지막 카드를 내려놓는 순간의 손',
  ),
  'blog-aa-loses': individualAsset('story-aa-loses', '눈을 감고 카드를 앞으로 밀어 내는 플레이어'),
  'blog-ak-flop-miss': individualAsset(
    'story-ak-flop-miss',
    '턱을 괸 채 칩을 만지작거리며 생각하는 플레이어',
  ),
};

function pageAsset(id: string, width: number, height: number, alt: string): VisualAssetSpec {
  return { id, file: `${id}.jpg`, width, height, alt };
}

/**
 * Page-level slots that belong to no content record: the brand pictures of the home page, the
 * hubs and About. Each key is used by exactly one component (`visualAssets.test.ts` checks),
 * so a picture never repeats on a screen and no component spells a file path.
 */
export const PAGE_VISUALS = {
  /** Home hero, 4:5 — the five code-drawn cards sit in its lower band. */
  homeHero: pageAsset(
    'home-hero',
    1120,
    1400,
    '붉은 조명의 포커 룸, 테이블에 턱을 괴고 앉은 플레이어',
  ),
  /** Home breathing band, 21:9 — the statement sits over its left side. */
  homeBreathing: pageAsset(
    'home-breathing',
    2400,
    1028,
    '어두운 포커 룸의 넓은 전경, 조명 아래 칩이 놓인 테이블',
  ),
  /** Home roadmap, one 21:9 picture per learning stage. */
  homeStageRules: pageAsset(
    'home-stage-rules',
    1680,
    720,
    '펠트 위에 뒷면으로 펼쳐 놓은 카드와 칩',
  ),
  homeStageRangePosition: pageAsset(
    'home-stage-range-position',
    1680,
    720,
    '위에서 내려다본 원형 포커 테이블과 둘러앉을 자리',
  ),
  homeStagePostflopMath: pageAsset(
    'home-stage-postflop-math',
    1680,
    720,
    '테이블 위에 놓인 노트와 펜, 카드 한 벌',
  ),
  /** Home closing call to action, 21:9 backdrop under the band's text. */
  homeFeature: pageAsset('brand-feature', 2400, 1028, '테이블 위에서 칩을 쌓는 손'),
  /** Hub and About heroes. */
  blogHub: pageAsset('brand-blog', 1200, 800, '붉은 벨벳 소파 앞에서 턱을 괴고 앉은 플레이어'),
  learnHub: pageAsset('brand-learn', 1200, 800, '뒷면으로 놓인 두 장의 카드에 손을 올린 플레이어'),
  handsHub: pageAsset('brand-hands', 1200, 800, '칩을 앞에 두고 테이블에 턱을 괴고 앉은 플레이어'),
  practiceHub: pageAsset(
    'brand-practice',
    1200,
    800,
    '뒷면이 보이는 카드 두 장을 들어 보이는 플레이어',
  ),
  glossaryHub: pageAsset('brand-glossary', 1200, 800, '테이블에 앉아 생각에 잠긴 플레이어'),
  toolsHub: pageAsset('brand-tools', 1200, 800, '붉은 조명 아래 테이블 앞에 선 플레이어'),
  aboutHero: pageAsset('brand-about', 1280, 720, '가죽 의자에 앉아 미소 짓는 플레이어'),
  aboutTable: pageAsset(
    'brand-about-table',
    1680,
    720,
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
