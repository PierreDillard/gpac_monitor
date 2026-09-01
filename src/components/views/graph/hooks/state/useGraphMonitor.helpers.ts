import { Node, Edge } from '@xyflow/react';

export function updateNodesWithPositions(
  newNodes: Node[],
  nodesRef: React.MutableRefObject<Node[]>,
) {
  const existingById = new Map(nodesRef.current.map((node) => [node.id, node]));
  return newNodes.map((node) => {
    const existingNode = existingById.get(node.id);
    if (existingNode) {
      return {
        ...node,
        position: existingNode.position,
        selected: existingNode.selected,
        dragging: existingNode.dragging,
      };
    }
    return node;
  });
}

export function updateEdgesWithState(
  newEdges: Edge[],
  edgesRef: React.MutableRefObject<Edge[]>,
  selectedNodeId: string | null,
) {
  const existingById = new Map(edgesRef.current.map((edge) => [edge.id, edge]));
  return newEdges.map((edge) => {
    const isIncidentToSelection =
      selectedNodeId !== null &&
      (edge.source === selectedNodeId || edge.target === selectedNodeId);
    const existingEdge = existingById.get(edge.id);
    if (existingEdge) {
      return {
        ...edge,
        selected: existingEdge.selected,
        animated: isIncidentToSelection,
      };
    }
    return { ...edge, animated: isIncidentToSelection };
  });
}
