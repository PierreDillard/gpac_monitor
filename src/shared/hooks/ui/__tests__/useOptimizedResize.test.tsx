import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useOptimizedResize } from '../useOptimizedResize';

const subscribeSpy = vi.fn(() => vi.fn());
const observeElementSpy = vi.fn();
const unobserveElementSpy = vi.fn();
// Stable across calls, matching the real useTransformResize post-stabilization
// (module-level functions, not recreated per render) — see transform-resize.ts.
const startTransformSpy = vi.fn();
const updateTransformSpy = vi.fn();
const commitResizeSpy = vi.fn();

vi.mock('@/utils/performance', () => ({
  useResizeOptimization: () => ({
    observeElement: observeElementSpy,
    unobserveElement: unobserveElementSpy,
    subscribe: subscribeSpy,
  }),
  useTransformResize: () => ({
    startTransform: startTransformSpy,
    updateTransform: updateTransformSpy,
    commitResize: commitResizeSpy,
  }),
}));

interface TestComponentProps {
  onResizeStart: () => void;
}

const TestComponent = ({ onResizeStart }: TestComponentProps) => {
  const { ref } = useOptimizedResize({ onResizeStart });
  return <div ref={ref as React.RefObject<HTMLDivElement>} />;
};

describe('useOptimizedResize', () => {
  beforeEach(() => {
    subscribeSpy.mockClear();
  });

  it('does not resubscribe when the caller passes a new inline callback every render', () => {
    const { rerender } = render(<TestComponent onResizeStart={() => {}} />);
    expect(subscribeSpy).toHaveBeenCalledTimes(1);

    // Simulates every real consumer (WidgetWrapper, GraphMonitorUI, MetricsMonitor,
    // session-overview/entry): a brand-new arrow function identity each render,
    // e.g. from an unrelated state update ticking live data.
    rerender(<TestComponent onResizeStart={() => {}} />);
    rerender(<TestComponent onResizeStart={() => {}} />);
    rerender(<TestComponent onResizeStart={() => {}} />);

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
  });
});
