import { FilterType, GraphFilterData } from '@/types/domain/gpac';
import { Node, Edge, MarkerType } from '@xyflow/react';
import { isSource } from './filterType';
import {
  determineFilterType,
  getFilterColor,
  STREAM_TYPE_TO_FILTER,
} from '@/utils/filters/streamType';

// Depth = longest upstream path to a source filter (memoized, cycle-safe)
function computeFilterDepths(filters: GraphFilterData[]): Map<number, number> {
  const filtersByIdx = new Map(filters.map((filter) => [filter.idx, filter]));
  const depths = new Map<number, number>();
  const visiting = new Set<number>();

  const depthOf = (filter: GraphFilterData): number => {
    const memoized = depths.get(filter.idx);
    if (memoized !== undefined) return memoized;
    if (visiting.has(filter.idx)) return 0;
    if (isSource(filter)) {
      depths.set(filter.idx, 0);
      return 0;
    }

    visiting.add(filter.idx);
    let maxSourceDepth = 0;
    for (const pid of filter.ipid) {
      const sourceFilter = filtersByIdx.get(pid.source_idx);
      if (sourceFilter) {
        maxSourceDepth = Math.max(maxSourceDepth, depthOf(sourceFilter));
      }
    }
    visiting.delete(filter.idx);

    const depth = maxSourceDepth + 1;
    depths.set(filter.idx, depth);
    return depth;
  };

  filters.forEach((filter) => depthOf(filter));
  return depths;
}

// X position from topological rank, computed once per filter list
function computeTopologicalXByIdx(
  filters: GraphFilterData[],
): Map<number, number> {
  const depths = computeFilterDepths(filters);
  const sortedFilters = [...filters].sort((filterA, filterB) => {
    const depthDelta =
      (depths.get(filterA.idx) ?? 0) - (depths.get(filterB.idx) ?? 0);
    return depthDelta !== 0 ? depthDelta : filterA.idx - filterB.idx;
  });

  const xByIdx = new Map<number, number>();
  sortedFilters.forEach((filter, sortedIndex) => {
    xByIdx.set(filter.idx, 150 + sortedIndex * 300);
  });
  return xByIdx;
}

// Create a node from a filter object
export function createNodeFromFilter(
  filter: GraphFilterData,
  index: number,
  existingNodes: Node[],
  topologicalXByIdx?: Map<number, number>,
): Node {
  const existingNode = existingNodes.find(
    (node) => node.id === filter.idx.toString(),
  );
  const filterType = determineFilterType(filter);
  const topologicalX = topologicalXByIdx?.get(filter.idx) ?? 150 + index * 300;

  return {
    id: filter.idx.toString(),
    type: 'gpac',
    data: {
      label: filter.name,
      filterType,
      ...filter,
    },

    position: existingNode?.position || {
      x: topologicalX,
      y: 100,
    },

    className: ` ${
      existingNode?.selected
        ? 'ring-2 ring-offset-2 ring-blue-500 shadow-lg scale-105'
        : ''
    }`,

    selected: existingNode?.selected,

    style: {
      width: 220,
      height: 'auto',
    },
  };
}

// Create edges from a list of filters
export function createEdgesFromFilters(
  filters: GraphFilterData[],
  existingEdges: Edge[],
): Edge[] {
  const newEdges: Edge[] = [];

  filters.forEach((filter) => {
    filter.ipid.forEach((pid) => {
      const edgeId = `edge:${pid.source_idx}->${filter.idx}:ipid:${pid.pid_index}`;
      const existingEdge = existingEdges.find((e) => e.id === edgeId);

      const filterType: FilterType =
        STREAM_TYPE_TO_FILTER[pid.stream_type] ?? 'file';
      const filterColor = getFilterColor(filterType);

      const sourceFilter = filters.find((f) => f.idx === pid.source_idx);
      const opidIndex = pid.source_opid_idx ?? -1;
      const sourceHandle =
        sourceFilter && opidIndex >= 0 && opidIndex < sourceFilter.opid.length
          ? `opid-${opidIndex}`
          : undefined;

      newEdges.push({
        id: edgeId,
        source: pid.source_idx.toString(),
        target: filter.idx.toString(),
        sourceHandle,
        targetHandle: `ipid-${pid.pid_index}`,
        type: 'simplebezier',
        data: {
          filterType,
          sourceFilterIdx: pid.source_idx,
          targetFilterIdx: filter.idx,
        },
        animated: true,
        style: { stroke: filterColor, strokeWidth: 3, opacity: 0.9 },
        markerEnd: { type: MarkerType.ArrowClosed, color: filterColor },
        selected: existingEdge?.selected,
      });
    });
  });

  return newEdges;
}

// Helper function to create nodes with proper topological ordering
export function createNodesFromFilters(
  filters: GraphFilterData[],
  existingNodes: Node[] = [],
): Node[] {
  const topologicalXByIdx = computeTopologicalXByIdx(filters);
  return filters.map((filter, index) =>
    createNodeFromFilter(filter, index, existingNodes, topologicalXByIdx),
  );
}
