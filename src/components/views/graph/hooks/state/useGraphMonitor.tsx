import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  useNodesInitialized,
  EdgeMouseHandler,
} from '@xyflow/react';
import {
  useAppDispatch,
  useToast,
  useSubscribedFilters,
} from '@/shared/hooks/index';
import {
  setSelectedNode,
  requestFilterOpen,
} from '@/shared/store/slices/graphSlice';
import {
  annotateNodesStable,
  NodeAnnotationCache,
} from '../../utils/nodeAnnotation';

// Modularized hooks
import { useGraphLayout } from '../layout/useGraphLayout';
import { useGraphState } from './useGraphState';
import { useGraphConnection } from '../connection/useGraphConnection';
import { useGraphHandlers } from '../interaction/useGraphHandlers';
import { useGraphNotifications } from '../interaction/useGraphNotifications';
import { useDataSource } from '@/services/dataSource/DataSourceContext';
import { useFilterArgs } from '../interaction/useFilterArgs';

const useGraphMonitor = () => {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const { mode } = useDataSource();

  // Refs to track component state
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const isApplyingLayout = useRef(false);
  const nodeAnnotationCache = useRef<NodeAnnotationCache>(new Map());

  // Local state for nodes and edges with React Flow's state management
  const [localNodes, setLocalNodes, onNodesChange] = useNodesState<Node>([]);
  const [localEdges, setLocalEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const {
    nodes,
    edges,
    isLoading,
    error,
    connectionError,
    setConnectionError,
  } = useGraphState(nodesRef, edgesRef);
  const subscribedFilterIdxs = useSubscribedFilters();

  const subscribedSet = useMemo(
    () => new Set(subscribedFilterIdxs),
    [subscribedFilterIdxs],
  );

  const { autoLayout } = useGraphLayout({
    localNodes,
    localEdges,
    setLocalNodes,
    nodesRef,
    isApplyingLayout,
  });

  const { retryConnection } = useGraphConnection({
    setConnectionError,
  });

  const { getFilterArgs, hasFilterArgs } = useFilterArgs();

  // Handle node click to select filter and open overview
  const handleNodeSelect = useCallback(
    (filterIdx: number) => {
      dispatch(setSelectedNode(String(filterIdx)));
      dispatch(requestFilterOpen({ filterIdx, initialTab: 'overview' }));
    },
    [dispatch],
  );

  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (_mouseEvent, clickedEdge) => {
      const filterIdx = parseInt(clickedEdge.target);
      dispatch(setSelectedNode(clickedEdge.target));
      dispatch(requestFilterOpen({ filterIdx, initialTab: 'inputs' }));
    },
    [dispatch],
  );

  const { handleNodesChange, handleEdgesChange, handleNodeClick } =
    useGraphHandlers({
      onNodesChange,
      onEdgesChange,
      localNodes,
      localEdges,
      nodesRef,
      edgesRef,
      setLocalNodes,
      onNodeClick: handleNodeSelect,
    });

  // Use notification system
  useGraphNotifications({
    nodes,
    error,
    isLoading,
    toast,
    disabled: mode === 'history',
  });

  // Effect to update local nodes and edges from Redux
  useEffect(() => {
    // Only update if not currently applying a layout
    if ((nodes.length > 0 || edges.length > 0) && !isApplyingLayout.current) {
      if (nodesRef.current === nodes && edgesRef.current === edges) return;
      setLocalNodes(nodes);
      setLocalEdges(edges);

      nodesRef.current = nodes;
      edgesRef.current = edges;
    }
  }, [nodes, edges, setLocalNodes, setLocalEdges]);

  const [hasLayoutRun, setHasLayoutRun] = useState(false);
  const nodesInitialized = useNodesInitialized();
  const graphFingerprint = useRef('');

  // Annotate nodes with isMonitored + alerts properties
  const annotatedNodes = useMemo(
    () =>
      annotateNodesStable(
        nodeAnnotationCache.current,
        localNodes,
        subscribedSet,
      ),
    [localNodes, subscribedSet],
  );

  // Reset layout flag when graph structure changes (new/removed filters)
  useEffect(() => {
    if (nodes.length === 0) return;
    const fingerprint = nodes
      .map((n) => n.id)
      .sort()
      .join(',');
    if (fingerprint !== graphFingerprint.current) {
      graphFingerprint.current = fingerprint;
      setHasLayoutRun(false);
    }
  }, [nodes]);

  // Auto-layout hook using useNodesInitialized with boolean guard
  useEffect(() => {
    if (hasLayoutRun) {
      return;
    }
    if (!nodesInitialized) {
      return;
    }
    if (localNodes.length === 0) {
      return;
    }
    if (localNodes.some((node) => !node.measured)) {
      return;
    }
    if (!localNodes.some((n) => n.data && n.data.name)) {
      return;
    }

    // Run the layout and set guard flag
    autoLayout();
    setHasLayoutRun(true);
  }, [nodesInitialized, localNodes, hasLayoutRun, autoLayout]);

  return {
    isLoading,
    connectionError,
    retryConnection,
    localNodes: annotatedNodes,
    localEdges,
    handleNodesChange,
    handleEdgesChange,
    handleNodeClick,
    handleEdgeClick,
    getFilterArgs,
    hasFilterArgs,
  };
};

export default useGraphMonitor;
