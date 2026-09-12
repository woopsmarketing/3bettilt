/**
 * The locale segment (Stage 3, D-S3-01). Every page on the site sits under this directory,
 * so every page URL is `/<locale>/…` and the locale is a route parameter, not a literal
 * directory name.
 *
 * `generateStaticParams` enumerates `SUPPORTED_LOCALES` and `dynamicParams = false` makes
 * any other first segment (`/xx/learn`) a 404 instead of an on-demand render — the site
 * stays entirely prerendered, exactly as the content templates already do for their slugs.
 * Every child route's own `generateStaticParams` is multiplied by this one, so `/ko/learn/
 * pot-odds` is one prerendered file per locale per lesson.
 *
 * The layout renders nothing of its own. The site shell (header, footer, `<html lang>`,
 * `metadataBase`) stays in the root layout so the global `not-found.tsx` and `error.tsx`
 * keep the chrome; with one locale, `<html lang>` is the default-locale constant there. The
 * `isLocale` guard is belt and braces under `dynamicParams = false`: it is what makes a
 * request for a locale that is not served answer with the site's own 404 rather than with
 * whatever a misconfigured host might pass through.
 */
import { notFound } from 'next/navigation.js';
import { isLocale, SUPPORTED_LOCALES, type Locale } from '../../lib/locale.js';

export const dynamicParams = false;

export function generateStaticParams(): { locale: Locale }[] {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  readonly children: React.ReactNode;
  readonly params: Promise<{ readonly locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return children;
}
