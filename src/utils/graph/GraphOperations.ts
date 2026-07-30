import { FilterType, GraphFilterData } from '@/types/domain/gpac';
import { Node, Edge, MarkerType } from '@xyflow/react';
import { isSource } from './filterType';
import {
  determineFilterType,
  getFilterColor,
  STREAM_TYPE_TO_FILTER,
} from '@/utils/filters/streamType';

// Create a node from a filter object
export function createNodeFromFilter(
  filter: GraphFilterData,
  index: number,
  existingNodes: Node[],
  allFilters?: GraphFilterData[], // Add this parameter to calculate proper positioning
): Node {
  const existingNode = existingNodes.find(
    (n) => n.id === filter.idx.toString(),
  );
  const filterType = determineFilterType(filter);

  // Calculate topological position if allFilters is provided
  let topologicalX = 150 + index * 300; // Default fallback

  if (allFilters) {
    // Calculate dependency depth for proper ordering
    const calculateDepth = (
      currentFilter: GraphFilterData,
      visited = new Set<number>(),
    ): number => {
      if (visited.has(currentFilter.idx)) return 0; // Avoid cycles
      visited.add(currentFilter.idx);

      // Source nodes (no inputs) are at depth 0
      if (isSource(currentFilter)) return 0;

      // Find maximum depth among all source dependencies
      let maxDepth = 0;
      currentFilter.ipid.forEach((pid) => {
        const sourceFilter = allFilters.find((f) => f.idx === pid.source_idx);
        if (sourceFilter && !visited.has(sourceFilter.idx)) {
          const sourceDepth = calculateDepth(sourceFilter, new Set(visited));
          maxDepth = Math.max(maxDepth, sourceDepth);
        }
      });

      return maxDepth + 1;
    };

    // Sort filters by dependency depth for correct ordering
    const sortedFilters = [...allFilters].sort((a, b) => {
      const depthA = calculateDepth(a);
      const depthB = calculateDepth(b);

      if (depthA !== depthB) return depthA - depthB;
      return a.idx - b.idx; // Stable sort by idx
    });

    // Find the position of current filter in sorted array
    const sortedIndex = sortedFilters.findIndex((f) => f.idx === filter.idx);
    topologicalX = 150 + sortedIndex * 300;
  }

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
  return filters.map((filter, index) =>
    createNodeFromFilter(filter, index, existingNodes, filters),
  );
}
