import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Node } from '@xyflow/react';
import { useGraphNotifications } from '../useGraphNotifications';

const makeNodes = (count: number): Node[] =>
  Array.from({ length: count }, (_, i) => ({
    id: String(i),
    position: { x: 0, y: 0 },
    data: {},
  }));

describe('useGraphNotifications', () => {
  it('shows "Graph loaded" once, not again when the graph keeps growing', () => {
    const toast = vi.fn();
    const { rerender } = renderHook(
      (props: { nodes: Node[]; isLoading: boolean }) =>
        useGraphNotifications({ ...props, error: null, toast }),
      { initialProps: { nodes: [], isLoading: true } },
    );

    // Initial snapshot arrives (e.g. 16 filters).
    rerender({ nodes: makeNodes(16), isLoading: false });
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Graph loaded' }),
    );

    // Graph keeps growing shortly after (e.g. a DASH pipeline spawning
    // muxers) — must not re-fire "Graph loaded".
    rerender({ nodes: makeNodes(24), isLoading: false });
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it('notifies again after the graph is cleared and reloaded (reconnect)', () => {
    const toast = vi.fn();
    const { rerender } = renderHook(
      (props: { nodes: Node[]; isLoading: boolean }) =>
        useGraphNotifications({ ...props, error: null, toast }),
      { initialProps: { nodes: makeNodes(16), isLoading: false } },
    );
    expect(toast).toHaveBeenCalledTimes(1);

    rerender({ nodes: [], isLoading: false }); // clearGraph on reconnect
    rerender({ nodes: makeNodes(8), isLoading: false }); // new session graph

    expect(toast).toHaveBeenCalledTimes(2);
  });
});
