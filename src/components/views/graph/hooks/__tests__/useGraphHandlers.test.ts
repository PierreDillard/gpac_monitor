import { renderHook } from '@testing-library/react';
import { useGraphHandlers } from '../interaction/useGraphHandlers';
import { updateNodesWithPositions } from '../state/useGraphMonitor.helpers';
import { MutableRefObject } from 'react';
import { Node, Edge } from '@xyflow/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock des dépendances
const mockOnNodesChange = vi.fn();
const mockOnEdgesChange = vi.fn();
const mockSetLocalNodes = vi.fn();
const mockService = {};
const mockDispatch = vi.fn();
const mockOnNodeClick = vi.fn();

const createMockRef = <T>(initial: T): MutableRefObject<T> => ({
  current: initial,
});

const defaultProps = {
  onNodesChange: mockOnNodesChange,
  onEdgesChange: mockOnEdgesChange,
  localNodes: [] as Node[],
  localEdges: [] as Edge[],
  nodesRef: createMockRef([] as Node[]),
  edgesRef: createMockRef([] as Edge[]),
  setLocalNodes: mockSetLocalNodes,
  service: mockService,
  dispatch: mockDispatch,
  onNodeClick: mockOnNodeClick,
};

describe('useGraphHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return handler functions', () => {
    const { result } = renderHook(() => useGraphHandlers(defaultProps));

    expect(result.current).toHaveProperty('handleNodesChange');
    expect(result.current).toHaveProperty('handleEdgesChange');
    expect(result.current).toHaveProperty('handleNodeClick');
    expect(typeof result.current.handleNodesChange).toBe('function');
    expect(typeof result.current.handleEdgesChange).toBe('function');
    expect(typeof result.current.handleNodeClick).toBe('function');
  });

  it('should handle node changes and update refs', () => {
    const mockChanges = [
      {
        id: 'node-1',
        type: 'position',
        position: { x: 100, y: 200 },
      },
    ];

    const initialNodes = [
      {
        id: 'node-1',
        position: { x: 0, y: 0 },
        data: { label: 'Test Node' },
      },
    ] as Node[];

    const nodesRef = createMockRef(initialNodes);

    const props = {
      ...defaultProps,
      nodesRef,
    };

    const { result } = renderHook(() => useGraphHandlers(props));

    // Appeler handleNodesChange
    result.current.handleNodesChange(mockChanges);

    // Vérifier que onNodesChange est appelé
    expect(mockOnNodesChange).toHaveBeenCalledWith(mockChanges);

    // Vérifier que la référence est mise à jour
    expect(nodesRef.current[0].position).toEqual({ x: 100, y: 200 });
  });

  it('preserves node measurements across a Redux resync', () => {
    const nodesRef = createMockRef([
      {
        id: 'node-1',
        position: { x: 0, y: 0 },
        data: { label: 'Test Node' },
      },
    ] as Node[]);

    const { result } = renderHook(() =>
      useGraphHandlers({ ...defaultProps, nodesRef }),
    );

    result.current.handleNodesChange([
      {
        id: 'node-1',
        type: 'dimensions',
        dimensions: { width: 180, height: 60 },
      },
    ]);

    expect(nodesRef.current[0].measured).toEqual({ width: 180, height: 60 });

    const resyncedNodes = updateNodesWithPositions(
      [
        {
          id: 'node-1',
          position: { x: 0, y: 0 },
          data: { label: 'Test Node' },
        },
      ] as Node[],
      nodesRef,
    );

    expect(resyncedNodes[0].measured).toEqual({ width: 180, height: 60 });
  });

  it('should handle edge changes', () => {
    const mockChanges = [
      {
        id: 'edge-1',
        type: 'remove',
      },
    ];

    const mockEdges = [] as Edge[];

    const props = {
      ...defaultProps,
      localEdges: mockEdges,
    };

    const { result } = renderHook(() => useGraphHandlers(props));

    // Appeler handleEdgesChange
    result.current.handleEdgesChange(mockChanges);

    // Vérifier que onEdgesChange est appelé
    expect(mockOnEdgesChange).toHaveBeenCalledWith(mockChanges);

    // Vérifier que edgesRef est mis à jour
    expect(props.edgesRef.current).toBe(mockEdges);
  });

  it('should handle node clicks', () => {
    const { result } = renderHook(() => useGraphHandlers(defaultProps));

    const mockEvent = {} as React.MouseEvent;
    const mockNode = {
      id: '42',
      position: { x: 0, y: 0 },
      data: { label: 'Test Node' },
    } as Node;

    // Call handleNodeClick
    result.current.handleNodeClick(mockEvent, mockNode);

    // Verify onNodeClick is called with correct idx
    expect(mockOnNodeClick).toHaveBeenCalledWith(42);
  });

  it('should ignore invalid node IDs in click handler', () => {
    const { result } = renderHook(() => useGraphHandlers(defaultProps));

    const mockEvent = {} as React.MouseEvent;
    const mockNode = {
      id: 'invalid-id',
      position: { x: 0, y: 0 },
      data: { label: 'Test Node' },
    } as Node;

    // Call handleNodeClick with invalid ID
    result.current.handleNodeClick(mockEvent, mockNode);

    // Verify onNodeClick is not called
    expect(mockOnNodeClick).not.toHaveBeenCalled();
  });

  it('should handle missing onNodeClick callback gracefully', () => {
    const propsWithoutCallback = {
      ...defaultProps,
      onNodeClick: undefined,
    };

    const { result } = renderHook(() => useGraphHandlers(propsWithoutCallback));

    const mockEvent = {} as React.MouseEvent;
    const mockNode = {
      id: '1',
      position: { x: 0, y: 0 },
      data: { label: 'Test Node' },
    } as Node;

    // Call handleNodeClick without callback - should not crash
    expect(() => {
      result.current.handleNodeClick(mockEvent, mockNode);
    }).not.toThrow();
  });
});
