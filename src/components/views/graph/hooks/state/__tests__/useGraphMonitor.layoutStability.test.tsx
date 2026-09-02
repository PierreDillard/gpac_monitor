import { PropsWithChildren } from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Edge, Node } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';
import useGraphMonitor from '../useGraphMonitor';
import graphReducer, {
  setSelectedNode,
} from '@/shared/store/slices/graphSlice';

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return { ...actual, useNodesInitialized: () => true };
});

vi.mock('@/shared/hooks/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/hooks/index')>();
  return {
    ...actual,
    useToast: () => ({ toast: vi.fn() }),
    useSubscribedFilters: () => [],
  };
});

vi.mock('../../connection/useGraphConnection', () => ({
  useGraphConnection: () => ({ retryConnection: vi.fn() }),
}));

vi.mock('../../interaction/useGraphNotifications', () => ({
  useGraphNotifications: vi.fn(),
}));

vi.mock('../../interaction/useFilterArgs', () => ({
  useFilterArgs: () => ({ getFilterArgs: vi.fn(), hasFilterArgs: vi.fn() }),
}));

vi.mock('@/services/dataSource/DataSourceContext', () => ({
  useDataSource: () => ({ mode: 'live' }),
}));

const graphNodes: Node[] = [
  {
    id: '1',
    type: 'gpac',
    position: { x: 150, y: 100 },
    measured: { width: 220, height: 80 },
    data: { idx: 1, name: 'source' },
  },
  {
    id: '2',
    type: 'gpac',
    position: { x: 450, y: 100 },
    measured: { width: 220, height: 80 },
    data: { idx: 2, name: 'video-sink' },
  },
  {
    id: '3',
    type: 'gpac',
    position: { x: 750, y: 100 },
    measured: { width: 220, height: 80 },
    data: { idx: 3, name: 'audio-sink' },
  },
];

const graphEdges: Edge[] = [
  { id: 'edge-1-2', source: '1', target: '2' },
  { id: 'edge-1-3', source: '1', target: '3' },
];

const positionsByNodeId = (nodes: Node[]) =>
  Object.fromEntries(nodes.map((node) => [node.id, node.position]));

describe('useGraphMonitor layout stability', () => {
  it('preserves Dagre positions when selecting a node changes edge state', async () => {
    const initialGraphState = graphReducer(undefined, { type: 'test/init' });
    const store = configureStore({
      reducer: { graph: graphReducer },
      preloadedState: {
        graph: { ...initialGraphState, nodes: graphNodes, edges: graphEdges },
      },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <Provider store={store}>{children}</Provider>
    );
    const { result } = renderHook(() => useGraphMonitor(), { wrapper });

    await waitFor(() => {
      const sinkYPositions = result.current.localNodes
        .filter((node) => node.id !== '1')
        .map((node) => node.position.y);
      expect(new Set(sinkYPositions).size).toBe(2);
    });
    await act(() => new Promise((resolve) => window.setTimeout(resolve, 110)));
    const layoutedPositions = positionsByNodeId(result.current.localNodes);

    act(() => {
      store.dispatch(setSelectedNode('2'));
    });

    await waitFor(() => {
      expect(
        result.current.localEdges.find((edge) => edge.id === 'edge-1-2')
          ?.animated,
      ).toBe(true);
    });
    expect(positionsByNodeId(result.current.localNodes)).toEqual(
      layoutedPositions,
    );
  });
});
