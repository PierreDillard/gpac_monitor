import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import FitGraphOnLoad from '../FitGraphOnLoad';

const { mockFitView, nodesInitializedState } = vi.hoisted(() => ({
  mockFitView: vi.fn(),
  nodesInitializedState: { current: true },
}));

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ fitView: mockFitView }),
  useNodesInitialized: () => nodesInitializedState.current,
}));

describe('FitGraphOnLoad', () => {
  beforeEach(() => {
    mockFitView.mockClear();
    nodesInitializedState.current = true;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
  });

  it('fits the view once when nodes are first initialized', () => {
    render(<FitGraphOnLoad nodeCount={3} disabled={false} />);

    expect(mockFitView).toHaveBeenCalledTimes(1);
  });

  it('does not re-fit when nodesInitialized toggles again on a live data refresh', () => {
    const { rerender } = render(
      <FitGraphOnLoad nodeCount={3} disabled={false} />,
    );
    expect(mockFitView).toHaveBeenCalledTimes(1);

    nodesInitializedState.current = false;
    rerender(<FitGraphOnLoad nodeCount={3} disabled={false} />);
    nodesInitializedState.current = true;
    rerender(<FitGraphOnLoad nodeCount={3} disabled={false} />);

    expect(mockFitView).toHaveBeenCalledTimes(1);
  });

  it('does not re-fit when a node is added during a live session', () => {
    const { rerender } = render(
      <FitGraphOnLoad nodeCount={3} disabled={false} />,
    );
    expect(mockFitView).toHaveBeenCalledTimes(1);

    rerender(<FitGraphOnLoad nodeCount={4} disabled={false} />);

    expect(mockFitView).toHaveBeenCalledTimes(1);
  });

  it('still fits once when nodes first appear after starting at zero', () => {
    const { rerender } = render(
      <FitGraphOnLoad nodeCount={0} disabled={false} />,
    );
    expect(mockFitView).not.toHaveBeenCalled();

    rerender(<FitGraphOnLoad nodeCount={5} disabled={false} />);

    expect(mockFitView).toHaveBeenCalledTimes(1);
  });
});
