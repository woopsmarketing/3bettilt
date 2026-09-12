/**
 * @vitest-environment node
 *
 * Node, not happy-dom: the literal guard below resolves `src/` off `import.meta.url`, which
 * happy-dom turns into an `http:` URL that `fileURLToPath` rejects (same as `routes.test.ts`).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  HREFLANG,
  isLocale,
  localeOfPath,
  localePath,
  localiseHref,
  sitePathOf,
  SUPPORTED_LOCALES,
} from './locale.js';

describe('the locale list', () => {
  it('has exactly the languages the site is written in, and a default among them', () => {
    expect(SUPPORTED_LOCALES).toEqual(['ko']);
    expect(isLocale(DEFAULT_LOCALE)).toBe(true);
    expect(isLocale('en')).toBe(false);
    expect(isLocale('KO')).toBe(false);
    expect(isLocale('')).toBe(false);
  });

  it('maps every locale to a BCP 47 hreflang tag', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(HREFLANG[locale]).toMatch(/^[a-z]{2}-[A-Z]{2}$/u);
    }
    expect(HREFLANG.ko).toBe('ko-KR');
  });
});

describe('localePath', () => {
  it('prefixes a site path with the locale, and makes the root the bare prefix', () => {
    expect(localePath('ko', '/learn/pot-odds')).toBe('/ko/learn/pot-odds');
    expect(localePath('ko', '/')).toBe('/ko');
  });

  it('keeps a query string and a fragment after the path', () => {
    expect(localePath('ko', '/tools/range?hero=BTN')).toBe('/ko/tools/range?hero=BTN');
    expect(localePath('ko', '/?q=x')).toBe('/ko?q=x');
    expect(localePath('ko', '/learn/outs#faq')).toBe('/ko/learn/outs#faq');
  });

  it('refuses what is not a root-relative site path', () => {
    expect(() => localePath('ko', 'learn')).toThrow(/root-relative/u);
    expect(() => localePath('ko', 'https://elsewhere.invalid/learn')).toThrow(/root-relative/u);
    expect(() => localePath('ko', '//elsewhere.invalid/learn')).toThrow(/protocol-relative/u);
  });

  it('refuses to double a prefix', () => {
    expect(() => localePath('ko', '/ko/learn')).toThrow(/already carries a locale/u);
    expect(() => localePath('ko', '/ko')).toThrow(/already carries a locale/u);
  });
});

describe('localeOfPath / sitePathOf', () => {
  it('reads the locale segment exactly, never by prefix', () => {
    expect(localeOfPath('/ko')).toBe('ko');
    expect(localeOfPath('/ko/learn')).toBe('ko');
    expect(localeOfPath('/ko?q=1')).toBe('ko');
    expect(localeOfPath('/ko-something')).toBeNull();
    expect(localeOfPath('/korean/learn')).toBeNull();
    expect(localeOfPath('/')).toBeNull();
    expect(localeOfPath('/learn')).toBeNull();
    expect(localeOfPath('/og.png')).toBeNull();
  });

  it('inverts localePath', () => {
    for (const sitePath of ['/', '/learn', '/learn/pot-odds', '/tools/range?hero=BTN', '/?q=1']) {
      expect(sitePathOf(localePath('ko', sitePath))).toBe(sitePath);
    }
    expect(() => sitePathOf('/learn')).toThrow(/supported locale/u);
  });
});

describe('localiseHref', () => {
  it('prefixes a hand-written internal link once, and leaves everything else alone', () => {
    expect(localiseHref('/learn/pot-odds')).toBe('/ko/learn/pot-odds');
    expect(localiseHref('/')).toBe('/ko');
    expect(localiseHref('/ko/learn/pot-odds')).toBe('/ko/learn/pot-odds');
    expect(localiseHref('#faq')).toBe('#faq');
    expect(localiseHref('https://schema.org')).toBe('https://schema.org');
    expect(localiseHref('//cdn.invalid/x')).toBe('//cdn.invalid/x');
    expect(localiseHref('mailto:x@y.z')).toBe('mailto:x@y.z');
  });
});

/*
 * D-S3-02: the prefix is spelt in ONE place. Every other file derives it through
 * `localePath`, so a `/ko` literal anywhere else in shipped source is a second spelling
 * that will be wrong the day the default changes. Test files are exempt — an expectation
 * has to state the answer literally, or it is not testing anything.
 */
const SRC_DIR = fileURLToPath(new URL('..', import.meta.url));
const APP_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Comments are documentation and may name `/ko/learn` as an example; only code counts. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
}

function shippedSources(dir: string, prefix: string): (readonly [string, string])[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) return shippedSources(join(dir, entry.name), rel);
    if (!/\.(?:ts|tsx|mdx)$/u.test(entry.name) || entry.name.includes('.test.')) return [];
    return [[rel, withoutComments(readFileSync(join(dir, entry.name), 'utf8'))] as const];
  });
}

describe('the locale prefix is spelt once', () => {
  const LITERAL = /["'`]\/ko(?:\/|["'`?#]|$)/u;

  it('no shipped file under src/ contains a "/ko" literal', () => {
    const offenders = shippedSources(SRC_DIR, 'src')
      .filter(([, source]) => LITERAL.test(source))
      .map(([rel]) => rel);
    expect(offenders).toEqual([]);
  });

  it('nor does the MDX component map, the config, or any MDX body', () => {
    const files = [
      ...shippedSources(join(APP_ROOT, 'content'), 'content'),
      [
        'mdx-components.tsx',
        withoutComments(readFileSync(join(APP_ROOT, 'mdx-components.tsx'), 'utf8')),
      ] as const,
      ['next.config.ts', withoutComments(readFileSync(join(APP_ROOT, 'next.config.ts'), 'utf8'))] as const,
    ];
    const offenders = files.filter(([, source]) => LITERAL.test(source)).map(([rel]) => rel);
    expect(offenders).toEqual([]);
  });

  it('and the guard itself would catch one', () => {
    expect(LITERAL.test("href: '/ko/learn'")).toBe(true);
    expect(LITERAL.test('goto("/ko")')).toBe(true);
    expect(LITERAL.test("'/korean'")).toBe(false);
    expect(LITERAL.test("'/tools/ko'")).toBe(false);
  });
});
