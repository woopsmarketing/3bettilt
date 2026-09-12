import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuizVisualView } from './QuizVisual.js';

describe('QuizVisualView', () => {
  it('renders a HAND_CLASS visual as that class\'s real cards', () => {
    render(<QuizVisualView visual={{ kind: 'HAND_CLASS', key: 'AKs' }} />);
    expect(screen.getByRole('group', { name: 'AKs' })).toBeInTheDocument();
    expect(screen.getByText('AKs')).toBeInTheDocument();
  });

  it('renders a CARDS visual by parsing its notation into real cards', () => {
    render(<QuizVisualView visual={{ kind: 'CARDS', notation: 'As Ks' }} />);
    expect(screen.getByRole('img', { name: '스페이드 A' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '스페이드 K' })).toBeInTheDocument();
  });

  it('hides the Korean reading when asked', () => {
    render(<QuizVisualView visual={{ kind: 'HAND_CLASS', key: 'AKs' }} showReading={false} />);
    expect(screen.queryByText('AKs')).not.toBeInTheDocument();
  });
});
