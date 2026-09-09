import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import HistoryControls from '../timeline/HistoryControls';

vi.mock('@/services/dataSource/DataSourceContext', () => ({
  useDataSource: () => ({ mode: 'history', manifest: null }),
}));

vi.mock('@/services/historyService/usePlayerState', () => ({
  usePlayerState: () => ({
    state: 'idle',
    currentTimeUs: 0,
    durationUs: 0,
    sessionStartUs: 0,
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
  }),
}));

vi.mock('@/services/historyService/useTimelineEvents', () => ({
  useTimelineEvents: () => [],
}));

vi.mock('react-resizable', () => ({
  Resizable: ({
    children,
    handle,
  }: {
    children: React.ReactElement;
    handle: (
      axis: string,
      ref: React.Ref<HTMLDivElement>,
    ) => React.ReactElement;
  }) => (
    <>
      {children}
      {handle('n', { current: null })}
    </>
  ),
}));

describe('HistoryControls', () => {
  describe('regression: build-mode resize direction', () => {
    it('timeline dock uses inline position:absolute, not Tailwind class, to survive react-resizable CSS override', () => {
      const { container } = render(<HistoryControls />);

      // The dock div is the direct child of the Resizable wrapper
      const dockDiv = container.querySelector(
        '[style*="position: absolute"], [style*="position:absolute"]',
      );

      expect(dockDiv).not.toBeNull();
      // Must NOT carry the Tailwind `absolute` class — that class loses to .react-resizable in prod CSS order
      expect(dockDiv!.classList.contains('absolute')).toBe(false);
    });
  });
});
