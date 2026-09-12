import { describe, expect, it } from 'vitest';
import { contentById } from '../../content/graph.js';
import { routeById } from '../../lib/routes.js';
import { PRACTICE_QUIZ_ENTRIES } from './hub.js';
import {
  PRACTICE_FLOW_STEPS,
  PRACTICE_QUIZ_DETAIL_IDS,
  practiceQuizDetail,
} from './hubPresentation.js';

describe('hubPresentation', () => {
  it('describes every quiz the hub declares, and nothing the hub does not', () => {
    const hubIds = PRACTICE_QUIZ_ENTRIES.map((entry) => entry.id);
    expect([...PRACTICE_QUIZ_DETAIL_IDS].sort()).toEqual([...hubIds].sort());
  });

  it('returns null for an id it has no story for, so the hub can still list the quiz', () => {
    expect(practiceQuizDetail('practiceSomethingElse')).toBeNull();
  });

  it('points every quiz at a lesson that exists and a tool the registry knows', () => {
    for (const id of PRACTICE_QUIZ_DETAIL_IDS) {
      const detail = practiceQuizDetail(id);
      expect(detail, id).not.toBeNull();
      if (detail === null) continue;
      expect(() => contentById(detail.lesson), `${id}: lesson ${detail.lesson}`).not.toThrow();
      expect(() => routeById(detail.tool), `${id}: tool ${detail.tool}`).not.toThrow();
    }
  });

  it('keeps the training list to plain skills — no digits a reader would have to trust, no GTO', () => {
    for (const id of PRACTICE_QUIZ_DETAIL_IDS) {
      const detail = practiceQuizDetail(id);
      if (detail === null) continue;
      expect(detail.trains.length, id).toBeGreaterThanOrEqual(2);
      for (const skill of detail.trains) {
        expect(skill, id).not.toMatch(/\d/u);
        expect(skill, id).not.toMatch(/GTO/iu);
      }
      expect(detail.format, id).not.toMatch(/GTO/iu);
    }
  });

  it('lists the four shared steps of a round, in order, each with a title and a body', () => {
    expect(PRACTICE_FLOW_STEPS).toHaveLength(4);
    for (const step of PRACTICE_FLOW_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
    }
    expect(PRACTICE_FLOW_STEPS[0]?.title).toMatch(/한 문제씩/u);
    expect(PRACTICE_FLOW_STEPS[3]?.title).toMatch(/틀린 문제만/u);
  });
});
