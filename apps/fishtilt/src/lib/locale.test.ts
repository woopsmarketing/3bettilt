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
  localePrefixOf,
  localiseHref,
  sitePathOf,
  SUPPORTED_LOCALES,
  type Locale,
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
  it('leaves the default locale prefixless, the root included (D-S3-23)', () => {
    expect(localePath('ko', '/learn/pot-odds')).toBe('/learn/pot-odds');
    expect(localePath('ko', '/')).toBe('/');
  });

  it('prefixes a non-default locale, and makes its root the bare prefix', () => {
    // No second locale exists yet; the cast pins the future `/en` URL contract.
    const en = 'en' as Locale;
    expect(localePath(en, '/learn')).toBe('/en/learn');
    expect(localePath(en, '/')).toBe('/en');
    expect(localePath(en, '/tools/range?hero=BTN')).toBe('/en/tools/range?hero=BTN');
    expect(localePath(en, '/?q=x')).toBe('/en?q=x');
  });

  it('keeps a query string and a fragment after the path', () => {
    expect(localePath('ko', '/tools/range?hero=BTN')).toBe('/tools/range?hero=BTN');
    expect(localePath('ko', '/?q=x')).toBe('/?q=x');
    expect(localePath('ko', '/learn/outs#faq')).toBe('/learn/outs#faq');
  });

  it('refuses what is not a root-relative site path', () => {
    expect(() => localePath('ko', 'learn')).toThrow(/root-relative/u);
    expect(() => localePath('ko', 'https://elsewhere.invalid/learn')).toThrow(/root-relative/u);
    expect(() => localePath('ko', '//elsewhere.invalid/learn')).toThrow(/protocol-relative/u);
  });

  it('refuses a path that already carries a locale, including the legacy default prefix', () => {
    expect(() => localePath('ko', '/ko/learn')).toThrow(/already carries a locale/u);
    expect(() => localePath('ko', '/ko')).toThrow(/already carries a locale/u);
  });
});

describe('localePrefixOf / localeOfPath / sitePathOf', () => {
  it('reads the prefix segment exactly, never by string prefix', () => {
    expect(localePrefixOf('/ko')).toBe('ko');
    expect(localePrefixOf('/ko/learn')).toBe('ko');
    expect(localePrefixOf('/ko?q=1')).toBe('ko');
    expect(localePrefixOf('/ko-something')).toBeNull();
    expect(localePrefixOf('/korean/learn')).toBeNull();
    expect(localePrefixOf('/')).toBeNull();
    expect(localePrefixOf('/learn')).toBeNull();
    expect(localePrefixOf('/og.png')).toBeNull();
  });

  it('assigns every unprefixed path to the default locale', () => {
    expect(localeOfPath('/')).toBe(DEFAULT_LOCALE);
    expect(localeOfPath('/learn')).toBe(DEFAULT_LOCALE);
    expect(localeOfPath('/learn/pot-odds?x=1')).toBe(DEFAULT_LOCALE);
    expect(localeOfPath('/korean/learn')).toBe(DEFAULT_LOCALE);
  });

  it('refuses a legacy default-locale-prefixed path: it is a redirect, not a page', () => {
    expect(() => localeOfPath('/ko')).toThrow(/never a URL prefix/u);
    expect(() => localeOfPath('/ko/learn')).toThrow(/never a URL prefix/u);
    expect(() => sitePathOf('/ko/learn')).toThrow(/never a URL prefix/u);
  });

  it('inverts localePath', () => {
    for (const sitePath of ['/', '/learn', '/learn/pot-odds', '/tools/range?hero=BTN', '/?q=1']) {
      expect(sitePathOf(localePath('ko', sitePath))).toBe(sitePath);
    }
  });
});

describe('localiseHref', () => {
  it('localises a hand-written internal link, and leaves everything else alone', () => {
    expect(localiseHref('/learn/pot-odds')).toBe('/learn/pot-odds');
    expect(localiseHref('/')).toBe('/');
    expect(localiseHref('#faq')).toBe('#faq');
    expect(localiseHref('https://schema.org')).toBe('https://schema.org');
    expect(localiseHref('//cdn.invalid/x')).toBe('//cdn.invalid/x');
    expect(localiseHref('mailto:x@y.z')).toBe('mailto:x@y.z');
  });

  it('refuses a legacy default-locale link instead of shipping a redirecting href', () => {
    expect(() => localiseHref('/ko/learn/pot-odds')).toThrow(/already carries a locale/u);
  });
});

/*
 * D-S3-02 / D-S3-23: locale paths are built in ONE place. The default locale is prefixless,
 * so a `/ko` literal anywhere in shipped source is a link to a legacy address that only
 * redirects (the migration list in `legacyLocaleRedirects.ts` derives its prefix from
 * `DEFAULT_LOCALE` in `next.config.ts` and spells no literal). Test files are exempt — an expectation
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
