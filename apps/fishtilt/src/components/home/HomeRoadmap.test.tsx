import { describe, expect, it } from 'vitest';
import { hrefOfContent, LEARN_ROADMAP, PUBLISHED_LESSONS } from '../../content/graph.js';
import { LEARN_STAGES, lessonsOfStage } from '../../content/registry/learn/categories.js';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import { HomeRoadmap } from './HomeRoadmap.js';

describe('HomeRoadmap', () => {
  it('is the learn module’s stages, each with exactly its own lessons, numbered by lesson order', () => {
    const { container } = renderBothThemes(<HomeRoadmap labelledBy="h" />);
    const stages = Array.from(container.querySelectorAll('[data-stage]'));
    expect(stages.map((stage) => stage.getAttribute('data-stage'))).toEqual(
      LEARN_STAGES.map((stage) => stage.id),
    );
    stages.forEach((stage, index) => {
      const expected = lessonsOfStage(LEARN_STAGES[index] as (typeof LEARN_STAGES)[number]);
      const orders = Array.from(stage.querySelectorAll('[data-order]')).map((item) =>
        Number(item.getAttribute('data-order')),
      );
      expect(orders).toEqual(expected.map((lesson) => lesson.order));
      // Real list numbering: the `<ol>` starts at the stage's first lesson order.
      expect(stage.querySelector('ol')?.getAttribute('start')).toBe(String(expected[0]?.order));
    });
  });

  it('links every published lesson to its page, and nothing else', () => {
    const { container } = renderBothThemes(<HomeRoadmap labelledBy="h" />);
    const links = Array.from(container.querySelectorAll('a[href]')).map((a) =>
      a.getAttribute('href'),
    );
    expect(links).toEqual(PUBLISHED_LESSONS.map((lesson) => hrefOfContent(lesson)));
    expect(container.querySelectorAll('[data-order]')).toHaveLength(LEARN_ROADMAP.length);
  });

  it('prints only counts it summed from records (편, 분) — never a poker number', () => {
    const { container } = renderBothThemes(<HomeRoadmap labelledBy="h" />);
    for (const stage of LEARN_STAGES) {
      const lessons = lessonsOfStage(stage);
      expect(container.textContent).toContain(`${lessons.length}편`);
    }
    // No percentage anywhere: the component prints record counts, the titles are the records'.
    expect(container.textContent).not.toMatch(/\d+(\.\d+)?%/u);
  });
});
