import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * SITE-WIDE COPY GUARDS.
 *
 * Both independent reviews (`docs/reports/WP_P1_POKER_CORRECTNESS_REVIEW.md`,
 * `docs/reports/REVIEW_BEGINNER_UX_SEO.md`) converged on one structural finding, recorded as
 * ruling 94 in `docs/FISHTILT_STATE.md`: **`src/**` Korean prose had never been audited.**
 *
 * Every sweep this project ran — the content audit, the ruling-26 sweep, both filter passes,
 * and the advice guard in `src/content/content.test.ts` — looked only at `content/**`. But
 * roughly half the user-visible sentences on this site live in `app/**\/page.tsx` explanation
 * cards, `features/*\/copy.ts` and `components/*.tsx`, and that half turned out to hold the
 * site's MOST confident claims: a profitability rationale, a universal tiebreaker rule, a
 * shortcut's error direction stated backwards, and a provenance sentence that said the
 * opposite of the truth. Six of WP-P1's thirteen findings lived there.
 *
 * These guards close that hole. They read BOTH trees, and they pin the defect CLASS rather
 * than the instances that were fixed.
 */

const SRC = join(import.meta.dirname, '.');
const CONTENT = join(import.meta.dirname, '..', 'content');

function walk(dir: string, keep: (name: string) => boolean): readonly string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      out.push(...walk(path, keep));
    } else if (keep(name)) {
      out.push(path);
    }
  }
  return out;
}

/** Where a JSX prop's Korean string is spliced back into the prose stream, so `sentencesOf`
 *  can treat it as its own sentence. A quiz option rarely ends in `다`/`요`, so the ordinary
 *  sentence split would run three of them together into one.
 *
 *  A Private Use Area code point rather than `\u0000`: ESLint's `no-control-regex` rejects a
 *  NUL in a pattern, and `\uE000` has the same property that matters here — it cannot occur in
 *  Korean prose, in JSX, or in any string this repo ships. */
const PROP_BREAK = '\uE000';

/**
 * The Korean strings inside one JSX tag — a quiz's questions, options and explanations, a
 * `<Callout>` title, an `<Accordion>` label.
 *
 * The Stage-2 review is what put this here. `proseOf` used to delete every `<...>` from an
 * MDX file wholesale, which is right for `<Term id="term-suited">` (the visible word is the
 * text BETWEEN the tags, and the `id` is not prose) and quietly wrong for `<Quiz>`, whose
 * entire visible content — every question, every option, every answer explanation — lives in
 * props and was therefore invisible to all of these guards. The review found `실제로 여는 패`
 * as the ANSWER to a quiz in `learn/hand-matrix.mdx`; the guard written for that class did not
 * fail on it, because the sentence was being deleted before the guard ran.
 *
 * Attribute names and ids drop out on their own: they carry no Hangul.
 */
function propStringsIn(tag: string): string {
  const strings = [...tag.matchAll(/'([^']*)'|"([^"]*)"/gu)]
    .map((m) => m[1] ?? m[2] ?? '')
    .filter((value) => /[가-힣]/u.test(value));
  return strings.length === 0 ? ' ' : ` ${strings.join(PROP_BREAK)}${PROP_BREAK}`;
}

/** Korean-bearing source, minus tests and comments, with JSX line wrapping undone. */
function proseOf(path: string): string {
  const raw = readFileSync(path, 'utf8');
  const withoutComments = path.endsWith('.mdx')
    ? raw.replace(/<[^>]+>/gu, propStringsIn)
    : raw.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//gu, ' ');
  // JSX wraps a sentence across lines mid-phrase, so a scanner that splits on newlines misses
  // the claim that spans them. The first run of this scan returned zero hits for exactly that
  // reason and missed the round's blocker; normalising whitespace first is not optional.
  return withoutComments.split(/\s+/u).join(' ');
}

function sentencesOf(path: string): readonly string[] {
  return proseOf(path)
    .split(path.endsWith('.mdx') ? /(?<=[다요])\.\s|\uE000/u : /(?<=[다요])\.\s|[{}`;]/u)
    .map((s) => s.trim())
    .filter((s) => s.length >= 6 && /[가-힣]/u.test(s));
}

const SRC_FILES = walk(SRC, (n) => /\.tsx?$/u.test(n) && !n.includes('.test.'));
const MDX_FILES = walk(CONTENT, (n) => n.endsWith('.mdx'));

describe('site-wide copy guards', () => {
  /*
   * GUARD 1 — the site never tells a reader what to do at the table, and never asserts that a
   * choice is profitable.
   *
   * `src/content/content.test.ts` already pins the recommendation half for MDX. This is the
   * `src/**` half plus the PROFITABILITY half, which no guard covered and which is what
   * WP-P1's blocker F2 actually was: `RangeExplorer`'s "더 넓은 레인지로 오픈해도 손해를 보지
   * 않기 때문입니다" — a claim the site has no dataset for, contradicting its own
   * `blog/btn-why-wide.mdx`.
   *
   * The legitimate use of every one of these verbs on this site is to DENY them, so a match
   * must also carry a refusal marker. Two calibration notes, both learned the hard way:
   *
   *   - `않기` is deliberately NOT a refusal marker. "손해를 보지 않기 때문입니다" is
   *     grammatically negative and semantically an ASSERTION of profitability — it is the
   *     blocker itself. `않습니다` / `않는` / `않고` are refusals; `않기 때문` is not.
   *   - `아니려면` IS allowed. "손해가 아니려면 최소한 얼마의 승률이 필요한가" is conditional
   *     break-even arithmetic, which WP-P1 §8 explicitly rules acceptable and which the pot-odds
   *     surfaces are built on. Bare `아니` is NOT allowed, because it would swallow the rest.
   */
  const TABLE_ACTION = '(?:콜|폴드|레이즈|베팅|배팅|체크|올인|오픈)';
  const RECOMMENDATION = new RegExp(
    `${TABLE_ACTION}(?:을|를|하|해)?\\s*(?:하세요|해야 합니다|해야 한다|하는 것이 좋|고려해 볼 수 있|추천|권장|하면 됩니다|하십시오|하는 게 좋)`,
    'u',
  );
  const PROFIT_CLAIM =
    /(?:손해를? 보지|손해가 아니(?!려면)|이득이|이득입니|수익성|유리하기 때문|유리합니|이익이)/u;
  const REFUSAL_MARKERS = [
    '아닙니다',
    '아니라',
    '아니고',
    '아니려면',
    '않습니다',
    '않는',
    '않고',
    '없습니다',
    '없고',
    '뜻은',
    '정해 주지',
    '정해주지',
    '대신 판단',
    '범위 밖',
    '묻지 않',
  ];

  it.each([
    ['src/**', SRC_FILES],
    ['content/**', MDX_FILES],
  ])('never recommends a table action or asserts profitability (%s)', (_label, files) => {
    const claims: string[] = [];
    for (const path of files) {
      for (const sentence of sentencesOf(path)) {
        const match = RECOMMENDATION.exec(sentence) ?? PROFIT_CLAIM.exec(sentence);
        if (match === null) continue;
        if (REFUSAL_MARKERS.some((marker) => sentence.includes(marker))) continue;
        claims.push(
          `${path.split('/apps/')[1] ?? path}: «${match[0]}» in "${sentence.slice(0, 140)}"`,
        );
      }
    }
    expect(claims).toEqual([]);
  });

  /*
   * GUARD 2 — one spelling per word.
   *
   * WP-P2's M5: the same word was spelled differently depending on the page, and the glossary —
   * the surface whose whole job is to fix a spelling in a beginner's head — was the one
   * disagreeing with the lessons. A reader who learned 플랍 in lesson 11 then followed its own
   * CTA found the control labelled 플롭.
   *
   * This guard is site-wide because the per-module version was not enough: `features/tools/copy.ts`
   * had a "says 플랍, never 플롭" test that covered its own labels, and `features/tools/equity.ts`
   * still shipped `0장(프리플롭), 3장(플롭)` right past it. Running the same check over BOTH trees
   * at once immediately found `content/learn/outs.mdx` still saying 것샷 after the tool had been
   * corrected to 거트샷 — a miss that fell between two fix agents' file boundaries.
   *
   * SEARCH ALIASES ARE EXEMPT, deliberately. 배팅 and 플롭 are things people really type, and
   * `registry/glossary/*.ts` lists them so search finds the right entry. An alias is what a
   * reader types; this guard is about what the site SAYS.
   */
  const CANON: ReadonlyArray<readonly [string, string]> = [
    ['플롭', '플랍'],
    ['오프슈트', '오프수트'],
    ['배팅', '베팅'],
    ['수트드', '수티드'],
    ['것샷', '거트샷'],
  ];

  /*
   * GUARD 3 — the site never ranks how common something is.
   *
   * Ruling 101 already settled this once, against `가장 널리 쓰이는 세는 방식`: the site has no
   * dataset about what other players or other sites do, so a superlative about prevalence is an
   * invented fact. The guard that ruling produced was written INSIDE
   * `registry/blog/i4.test.ts`, scoped to `why-called-3bet.mdx`, and the independent Stage-2
   * review found the identical sentence still shipping from `learn/outs.mdx` and
   * `blog/outs-nine.mdx` — two clicks from the page that declares the site does not write
   * claims it has no evidence for. A per-file guard cannot pin a class.
   *
   * The same review found the FAQ blurbs doing the measurable version of it: seven sections
   * called their questions the ones this site is asked most, on a site with no accounts, no
   * contact channel and no analytics (`lib/seo/jsonLd.ts` says so in as many words). The
   * project had already retreated from `인기 무료 도구` and from a `많이 읽은 글` sort for
   * exactly this reason; the FAQ descriptions were simply missed by that sweep.
   *
   * WHAT IS NOT BANNED, and why the pattern is this narrow: `가장 강한 패`, `가장 낮은
   * 스트레이트`, `가장 먼저 액션하는 자리`, `가장 먼저 레이즈` are rules of hold'em — checkable
   * facts about the game, not measurements of a population. Only `가장` bound to a verb about
   * what PEOPLE do (use it, ask it, get it wrong, be confused by it) is a claim this site
   * cannot source. The accepted replacement register is ruling 101's own: `일반적으로 쓰이는`.
   */
  const PREVALENCE_SUPERLATIVE =
    /가장\s*(?:널리|많이|자주|먼저|흔히)?\s*\S{0,6}?(?:쓰이|쓰는|받는|묻는|나오는 질문|막히|헷갈리|오해|틀리|인기)/u;

  it.each([
    ['src/**', SRC_FILES],
    ['content/**', MDX_FILES],
  ])('never ranks how common a practice or a question is (%s)', (_label, files) => {
    const claims: string[] = [];
    for (const path of files) {
      for (const sentence of sentencesOf(path)) {
        const match = PREVALENCE_SUPERLATIVE.exec(sentence);
        if (match === null) continue;
        claims.push(
          `${path.split('/apps/')[1] ?? path}: «${match[0]}» in "${sentence.slice(0, 140)}"`,
        );
      }
    }
    expect(
      claims,
      'ruling 101: the site has no data about what other players or sites do, so it does not\n' +
        'rank prevalence. Say `일반적으로 쓰이는`, or describe what the section actually holds:\n' +
        claims.join('\n'),
    ).toEqual([]);
  });

  /*
   * GUARD 4 — the range table is teaching material, and the site never describes it as
   * observed play.
   *
   * `app/tools/starting-hand/page.tsx` carries this rule as a comment: `실제 어떤 패를
   * 플레이하는지` reads as a description of what players actually do at tables, which is a claim
   * this site has no data for, and it drops the `학습용 기본 레인지` label every other surface
   * attaches to that table. The comment records a fix; nothing enforced it, and the Stage-2
   * review found the phrasing alive in four content files — including as the ANSWER to a quiz
   * in `learn/hand-matrix.mdx`, which is the one place a reader is being told to remember it.
   *
   * A denial is allowed and is the reason for the refusal check: `blog/btn-why-wide.mdx` says
   * the table does NOT mean this, and has to be able to say the words to deny them.
   */
  const OBSERVED_PLAY =
    /실제(?:로)?\s*(?:어떤 패를 |어떤 패가 )?(?:여는|쓰는|플레이하는|플레이한)/u;

  it.each([
    ['src/**', SRC_FILES],
    ['content/**', MDX_FILES],
  ])('never describes the learning range as what players actually do (%s)', (_label, files) => {
    const claims: string[] = [];
    for (const path of files) {
      for (const sentence of sentencesOf(path)) {
        const match = OBSERVED_PLAY.exec(sentence);
        if (match === null) continue;
        if (REFUSAL_MARKERS.some((marker) => sentence.includes(marker))) continue;
        claims.push(
          `${path.split('/apps/')[1] ?? path}: «${match[0]}» in "${sentence.slice(0, 140)}"`,
        );
      }
    }
    expect(
      claims,
      'the range table came from teaching material, not from watching tables. Name the table\n' +
        '(`학습용 기본 레인지`, `표가 칠하는 패`) rather than the players:\n' +
        claims.join('\n'),
    ).toEqual([]);
  });

  /*
   * GUARD 6 — the old brand name never comes back.
   *
   * WP-S3-01b renamed the public brand from FishTilt to 3BetTilt across every user- and
   * crawler-visible surface. `FISHTILT_<DOC>.md` references (e.g. `docs/FISHTILT_STATE.md`)
   * are internal document filenames, not the brand, and are exempt via the `(?!_)` guard —
   * everything else spelled `FishTilt` or `FISHTILT` is the retired wordmark and must not
   * silently reappear in prose, a metadata constant, or an SVG title.
   */
  const OLD_BRAND = /FishTilt|FISHTILT(?!_)/gu;

  it('never reintroduces the retired FishTilt brand name', () => {
    const offenders: string[] = [];
    for (const path of [...SRC_FILES, ...MDX_FILES]) {
      const hits = readFileSync(path, 'utf8').match(OLD_BRAND);
      if (hits !== null) {
        offenders.push(`${path.split('/apps/')[1] ?? path}: ${hits.join(', ')}`);
      }
    }
    const iconSvg = join(SRC, 'app', 'icon.svg');
    const iconHits = readFileSync(iconSvg, 'utf8').match(OLD_BRAND);
    if (iconHits !== null) {
      offenders.push(`${iconSvg.split('/apps/')[1] ?? iconSvg}: ${iconHits.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('spells each term one way across both trees (search aliases exempt)', () => {
    const drift: string[] = [];
    for (const path of [...SRC_FILES, ...MDX_FILES]) {
      const lines = readFileSync(path, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (/aliases\s*:/u.test(line)) return; // search aliases keep the variants on purpose
        for (const [variant, canon] of CANON) {
          if (!line.includes(variant)) continue;
          drift.push(
            `${path.split('/apps/')[1] ?? path}:${i + 1} — ${variant} should be ${canon}: ${line.trim().slice(0, 110)}`,
          );
        }
      });
    }
    expect(drift).toEqual([]);
  });
});
