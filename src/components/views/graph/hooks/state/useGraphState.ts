import { useState, useRef, useMemo, MutableRefObject } from 'react';
import { Node, Edge } from '@xyflow/react';
import { useAppSelector } from '@/shared/hooks/redux';
import {
  selectNodesForGraphMonitor,
  selectEdges,
  selectIsLoading,
  selectError,
  selectSelectedNodeId,
} from '@/shared/store/selectors/graph/graphSelectors';
import {
  updateNodesWithPositions,
  updateEdgesWithState,
} from './useGraphMonitor.helpers';

/**
 * Hook for managing graph state
 * Handles state selection from Redux and local state transformations
 */
export const useGraphState = (
  nodesRef: MutableRefObject<Node[]>,
  edgesRef: MutableRefObject<Edge[]>,
) => {
  // Local connection error state
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Redux selectors
  const reduxNodes = useAppSelector(selectNodesForGraphMonitor);
  const reduxEdges = useAppSelector(selectEdges);
  const isLoading = useAppSelector(selectIsLoading);
  const error = useAppSelector(selectError);
  const selectedNodeId = useAppSelector(selectSelectedNodeId);

  // Performance tracking (debug only)
  const renderCount = useRef(0);

  // Transformed nodes and edges with proper positioning and state
  const nodes = useMemo(() => {
    return updateNodesWithPositions(reduxNodes, nodesRef);
  }, [reduxNodes, nodesRef]);

  const edges = useMemo(() => {
    return updateEdgesWithState(reduxEdges, edgesRef, selectedNodeId);
  }, [reduxEdges, edgesRef, selectedNodeId]);

  return {
    nodes,
    edges,
    isLoading,
    error,
    connectionError,
    setConnectionError,
    renderCount,
  };
};
