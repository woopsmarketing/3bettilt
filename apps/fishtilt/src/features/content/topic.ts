/**
 * The Korean label for a `ContentTopic`.
 *
 * ## Why this exists and why it is here
 *
 * `topic` is a closed Latin union (`src/content/types.ts`) chosen so two pieces about the
 * same subject cannot drift into `'range'` and `'ranges'`. It has never been shown to a
 * reader, so it has never needed a label — WP-5 puts the topic on the blog card and on the
 * article header, which is the first consumer.
 *
 * `graph.ts` already owns `LEVEL_LABEL` and `KIND_LABEL`, and that is where a fourth label
 * map would naturally go. It is deliberately NOT there: `src/content/` is the registry
 * boundary this work package was told not to write into, and a label is presentation rather
 * than graph structure. One map, one file, imported by everything that needs it — the rule
 * that matters is that there is exactly ONE place the Korean word for a topic is written.
 *
 * ## Why the words are these words
 *
 * They match the vocabulary the rest of the site already uses in its nav and its glossary,
 * so a chip reading 핸드레인지 sends the reader to the header item of the same name rather
 * than to a synonym they then have to reconcile:
 *
 * - `range` → `핸드레인지`, the header's own word (`src/lib/routes.ts`), not "레인지".
 * - `hand-strength` → `족보`, the word every hand-ranking lesson and quiz uses.
 * - `odds` → `확률과 오즈`, because the topic genuinely covers both the exact probability
 *   (`outsOdds`) and the price of a call (`potOdds`), and a chip saying only "오즈" would
 *   read as the second one.
 * - `position` → `자리`, the beginner-first word the position lessons lead with; the
 *   notation 포지션 is taught in the glossary, not used as a category name.
 *
 * Nothing here is a poker claim: these are category names for articles, not statements
 * about the game.
 */
import { CONTENT_TOPICS, type ContentTopic } from '../../content/types.js';

export const TOPIC_LABEL: Readonly<Record<ContentTopic, string>> = {
  rules: '규칙',
  'hand-strength': '족보',
  'starting-hands': '시작 패',
  range: '핸드레인지',
  position: '자리',
  betting: '베팅',
  odds: '확률과 오즈',
  equity: '승률',
};

/**
 * The label for a topic. Total over the union, so this cannot return `undefined` — but it
 * exists rather than exporting only the map so a call site reads as a lookup and a future
 * locale switch has one function to change.
 */
export function topicLabel(topic: ContentTopic): string {
  return TOPIC_LABEL[topic];
}

/**
 * The eight topics in their declared order (`CONTENT_TOPICS`).
 *
 * `/blog` groups its 20 articles by topic and renders the groups in this order. That is a
 * deliberate choice of a DECLARED order over a computed one: the alternatives available to
 * this site are article count (which would claim the biggest pile is the most important),
 * alphabetical (which is meaningless in a mixed Korean/Latin key space) and recency (which
 * FISHTILT_STATE ruling 105 rules out, there being no date on a record at all). The union's
 * own order happens to run rules → 족보 → 시작 패 → 레인지 → 자리 → 베팅 → 오즈 → 승률,
 * which is the order the curriculum introduces them in, and it is stable because
 * `content.test.ts` pins the union.
 */
export const TOPIC_ORDER: readonly ContentTopic[] = CONTENT_TOPICS;
