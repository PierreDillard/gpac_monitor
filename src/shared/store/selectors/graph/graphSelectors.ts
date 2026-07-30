import { createSelector } from '@reduxjs/toolkit';
import { isEqual } from 'lodash';
import type { RootState } from '../../index';
import { selectStalledFilters } from '../session/sessionStatsSelectors';

const selectGraphState = (state: RootState) => state.graph;

// Selectors memoized
export const selectNodesForGraphMonitor = createSelector(
  [selectGraphState, selectStalledFilters],
  (graph, stalledFilters) =>
    graph.nodes.map((node) => {
      const { status, ...dataWithoutBytesDone } = node.data;
      const isStalled = stalledFilters[node.id] ?? false;
      return {
        ...node,
        data: {
          ...dataWithoutBytesDone,
          isStalled,
        },
      };
    }),
  {
    memoizeOptions: {
      resultEqualityCheck: isEqual,
    },
  },
);

// Memoized selectors
export const selectEdges = createSelector(
  [selectGraphState],
  (graph) => graph.edges,
  {
    memoizeOptions: {
      resultEqualityCheck: isEqual,
    },
  },
);

export const selectIsLoading = createSelector(
  [selectGraphState],
  (graph) => graph.isLoading,
);

export const selectError = createSelector(
  [selectGraphState],
  (graph) => graph.error,
);

export const selectPidReconfiguredCounts = (state: RootState) =>
  state.graph.pidReconfiguredCounts;

export const selectArgUpdatedCounts = (state: RootState) =>
  state.graph.argUpdatedCounts;

export const selectSelectedNodeId = (state: RootState) =>
  state.graph.selectedNodeId;
