import { createSelector } from '@reduxjs/toolkit';
import { isEqual } from 'lodash';
import type { RootState } from '../../index';

const selectGraphState = (state: RootState) => state.graph;

// Selectors memoized
export const selectNodesForGraphMonitor = createSelector(
  [selectGraphState],
  (graph) =>
    graph.nodes.map((node) => {
      const { status, ...dataWithoutBytesDone } = node.data;
      return {
        ...node,
        data: dataWithoutBytesDone,
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
