import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { StreetSection } from './StreetSection.js';

describe('StreetSection (D-S3-14)', () => {
  it('is a region named by the street heading, with board, actions and narrative in order', () => {
    renderBothThemes(
      <StreetSection
        street="flop"
        board={{ flop: 'As Kd 7c' }}
        actions={[{ position: 'BTN', action: '벳', amount: '4BB', hero: true }]}
        pot="팟 14BB"
      >
        <p>탑 페어가 떴다.</p>
      </StreetSection>,
    );
    const region = screen.getByRole('region', { name: '플랍' });
    expect(within(region).getByRole('heading', { level: 2, name: '플랍' })).toHaveAttribute('id', 'street-flop');
    expect(within(region).getByRole('group', { name: '플랍' })).toBeInTheDocument();
    expect(within(region).getByRole('list', { name: '플랍 액션' })).toBeInTheDocument();
    const order = [...region.querySelectorAll('h2, [role="group"], ol, p')].map((el) => el.tagName);
    expect(order[0]).toBe('H2');
    expect(order.indexOf('OL')).toBeGreaterThan(order.indexOf('DIV'));
    expect(within(region).getByText('탑 페어가 떴다.')).toBeInTheDocument();
    expect(within(region).getByText('팟 14BB')).toBeInTheDocument();
  });

  it('takes a custom title and a nested heading level', () => {
    renderBothThemes(<StreetSection street="river" title="리버 — 결정의 순간" headingAs="h3" />);
    expect(screen.getByRole('heading', { level: 3, name: '리버 — 결정의 순간' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '리버 — 결정의 순간' })).toBeInTheDocument();
  });

  it('renders no board and no list when the street has neither', () => {
    const { container } = renderBothThemes(<StreetSection street="preflop">본문</StreetSection>);
    expect(container.querySelector('[role="group"]')).toBeNull();
    expect(container.querySelector('ol')).toBeNull();
  });
});
