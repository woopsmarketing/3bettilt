/**
 * `ToolPageShell` — the top of every tool page: breadcrumbs, the `WebApplication` block, a
 * short hero and the tool itself, in the page's wide column; then whatever the page stacks
 * underneath (its guide, FAQ, onward links, next tool) as full-bleed `Section` bands.
 *
 * TOOL FIRST (contract BA/BE). The hero is one heading and one line so the interactive tool
 * is inside the first viewport at 1440 and one short scroll away at 390 — the guide is
 * below the tool, never above it. Six pages used to repeat this block by hand; one shell
 * means the six cannot drift in the order or the spacing of the part a reader meets first.
 */
import { JsonLd, routeBreadcrumbs, webApplicationJsonLd } from '../../lib/seo/index.js';
import { routeById } from '../../lib/routes.js';
import { Breadcrumbs } from '../Breadcrumbs.js';
import { PageHero } from '../PageHero.js';
import { Section, type SectionWidth } from '../Section.js';

export interface ToolPageShellProps {
  /** Route id from `src/lib/routes.ts` — the breadcrumb trail and the canonical path. */
  readonly routeId: string;
  /** The tool's NAME and one-line description, published as the `WebApplication` block. */
  readonly app: { readonly name: string; readonly description: string };
  readonly hero: { readonly eyebrow: string; readonly title: string; readonly description: string };
  /** `shell` for a calculator; `matrix` for the one page that shows two 13x13 grids. */
  readonly toolWidth?: Extract<SectionWidth, 'shell' | 'matrix'>;
  readonly tool: React.ReactNode;
  /** Everything under the tool: guide bands, FAQ, links, the next-tool CTA. */
  readonly children?: React.ReactNode;
}

export function ToolPageShell({
  routeId,
  app,
  hero,
  toolWidth = 'shell',
  tool,
  children,
}: ToolPageShellProps) {
  const route = routeById(routeId);
  return (
    <main>
      <Section width={toolWidth} padded="none" as="div" innerClassName="pt-8 pb-12 sm:pt-10">
        <Breadcrumbs className="mb-8" trail={routeBreadcrumbs(routeId)} />
        {/* `WebApplication`, not `SoftwareApplication`: this page hosts a calculator that
            runs in the browser, free, with no account — every field is literally true. */}
        <JsonLd
          blocks={[
            webApplicationJsonLd({
              path: route.path,
              name: app.name,
              description: app.description,
            }),
          ]}
        />
        <PageHero eyebrow={hero.eyebrow} title={hero.title} description={hero.description} />
        <div className="mt-8">{tool}</div>
      </Section>
      {children}
    </main>
  );
}
