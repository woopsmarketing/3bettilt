import { describe, expect, it } from 'vitest';
import { RELATED_LABELS } from '../../components/RelatedContent.js';
import { contentById, hrefOfContent, isHandStory } from '../../content/graph.js';
import { routeById, ROUTES } from '../../lib/routes.js';
import { TOOL_GUIDE_LINK_IDS, toolGuideLinkGroups } from './guideLinks.js';
import { toolLessonIds } from './related.js';

const TOOL_IDS = ROUTES.filter((route) => route.section === 'tools' && route.id !== 'tools').map(
  (route) => route.id,
);

describe('toolGuideLinkGroups', () => {
  it('has a link plan for every tool route', () => {
    for (const id of TOOL_IDS) expect(TOOL_GUIDE_LINK_IDS[id], id).toBeDefined();
  });

  it('resolves every id through the registry or the content graph — never a bare string', () => {
    for (const id of TOOL_IDS) {
      const plan = TOOL_GUIDE_LINK_IDS[id];
      if (plan === undefined) continue;
      for (const contentId of [...plan.glossary, ...plan.articles]) {
        expect(() => contentById(contentId), `${id}: ${contentId}`).not.toThrow();
      }
      if (plan.quiz !== null)
        expect(() => routeById(plan.quiz ?? ''), `${id}: ${plan.quiz}`).not.toThrow();
    }
  });

  it('labels groups only with the Stage 3 relation labels, in the fixed order', () => {
    for (const id of TOOL_IDS) {
      const labels = toolGuideLinkGroups(id).map((group) => group.label);
      for (const label of labels) expect(RELATED_LABELS).toContain(label);
      expect(labels[0]).toBe('더 배우기');
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it('leads with the same lessons the tool page always linked (toolLessonIds)', () => {
    for (const id of TOOL_IDS) {
      const learn = toolGuideLinkGroups(id).find((group) => group.label === '더 배우기');
      expect(learn).toBeDefined();
      const hrefs = learn?.links.map((link) => link.href) ?? [];
      for (const lessonId of toolLessonIds(id)) {
        expect(hrefs, `${id}: ${lessonId}`).toContain(hrefOfContent(contentById(lessonId)));
      }
    }
  });

  it('gives an unpublished piece a null href, never a path that would 404', () => {
    for (const id of TOOL_IDS) {
      for (const group of toolGuideLinkGroups(id)) {
        for (const link of group.links) {
          expect(link.title).toBeTruthy();
          if (link.href !== null) expect(link.href).toMatch(/^\/(?!\/)/u);
        }
      }
    }
  });

  it('every tool points at at least one glossary term and one article', () => {
    for (const id of TOOL_IDS) {
      const groups = toolGuideLinkGroups(id);
      expect(groups.find((g) => g.label === '같이 알아둘 용어')?.links.length ?? 0).toBeGreaterThan(
        0,
      );
      expect(
        groups.find((g) => g.label === '이런 이야기도 있어요')?.links.length ?? 0,
      ).toBeGreaterThan(0);
    }
  });

  it('lists a hand story on a tool only when the story itself declares that tool (WP-S3-16)', () => {
    let storiesListed = 0;
    for (const id of TOOL_IDS) {
      const group = toolGuideLinkGroups(id).find((g) => g.label === '이런 이야기도 있어요');
      for (const link of group?.links ?? []) {
        const record = contentById(link.key);
        if (!isHandStory(record)) continue;
        storiesListed += 1;
        expect(
          record.relatedTools,
          `${link.key} is listed on ${id} but does not declare it`,
        ).toContain(id);
      }
    }
    // The mirror is not vacuous: tools do list stories now.
    expect(storiesListed).toBeGreaterThan(0);
  });
});
