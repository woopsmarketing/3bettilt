import { describe, expect, it } from 'vitest';
import { CONTENT_TOPICS } from '../../content/types.js';
import { ALL_CONTENT } from '../../content/registry/index.js';
import { TOPIC_LABEL, TOPIC_ORDER, topicLabel } from './topic.js';

describe('TOPIC_LABEL', () => {
  it('labels every topic in the union, with no extra keys', () => {
    // Total over the union, checked in both directions: a topic added to `types.ts` without
    // a label here would render a blank chip, and a label left behind after a topic was
    // removed would be dead copy nobody notices.
    expect(Object.keys(TOPIC_LABEL).toSorted()).toEqual([...CONTENT_TOPICS].toSorted());
  });

  it('gives every topic a non-empty Korean label', () => {
    for (const topic of CONTENT_TOPICS) {
      const label = topicLabel(topic);
      expect(label.trim(), topic).not.toBe('');
      expect(label, topic).toMatch(/[가-힣]/u);
    }
  });

  it('never repeats a label, so two chips can never mean the same thing', () => {
    const labels = CONTENT_TOPICS.map(topicLabel);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('uses the site nav’s own word for the range topic rather than a synonym', () => {
    // A chip that said "레인지" would send a reader looking for a header item called
    // "핸드레인지". The label and the nav have to be the same string.
    expect(topicLabel('range')).toBe('핸드레인지');
  });

  it('orders the groups by the declared union, not by how many articles each holds', () => {
    expect(TOPIC_ORDER).toEqual(CONTENT_TOPICS);
  });

  it('covers every topic that real content actually uses', () => {
    // The registry is the reason this map exists; if a record carries a topic this file has
    // no word for, `/blog` renders a group with an empty heading.
    for (const record of ALL_CONTENT) {
      expect(TOPIC_LABEL[record.topic], `${record.id} → ${record.topic}`).toBeDefined();
    }
  });
});
