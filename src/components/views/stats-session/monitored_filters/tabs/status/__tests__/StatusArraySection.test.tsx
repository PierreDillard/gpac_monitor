import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusArraySection from '../StatusArraySection';
import type { ArrayGroup } from '../../../utils/statusViewModel';

const longTimeValue = '8.85s (424960/48000)';

const audioTrackArray: ArrayGroup = {
  key: 'audio',
  label: '',
  items: [
    {
      key: 'track-1',
      name: 'audio',
      metrics: [{ key: 'time', value: longTimeValue }],
      progress: 42.7,
    },
  ],
};

describe('StatusArraySection', () => {
  it('lets a long metric value wrap inside its column', () => {
    render(<StatusArraySection array={audioTrackArray} />);
    const valueElement = screen.getByText(longTimeValue);
    expect(valueElement).toHaveClass('[overflow-wrap:anywhere]');
    expect(valueElement.parentElement).not.toHaveClass('whitespace-nowrap');
  });

  it('keeps the metric label on a single line', () => {
    render(<StatusArraySection array={audioTrackArray} />);
    expect(screen.getByText('time:')).toHaveClass(
      'shrink-0',
      'whitespace-nowrap',
    );
  });
});
