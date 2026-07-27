import { useCallback, MutableRefObject } from 'react';
import { Node, Edge } from '@xyflow/react';
import dagre from 'dagre';

interface UseGraphLayoutProps {
  localNodes: Node[];
  localEdges: Edge[];
  setLocalNodes: (nodes: Node[]) => void;
  nodesRef: MutableRefObject<Node[]>;
  isApplyingLayout: MutableRefObject<boolean>;
}

const performDagreLayout = (nodes: Node[], edges: Edge[]): Node[] => {
  if (nodes.length === 0 || nodes.some((node) => !node.measured)) {
    return nodes;
  }

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'LR',
    nodesep: 250,
    ranksep: 100,
  });

  nodes.forEach((node) => {
    g.setNode(node.id, {
      width: node.measured?.width || 100,
      height: node.measured?.height || 100,
    });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target, { points: [] });
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const dagreNode = g.node(node.id);
    if (!dagreNode) return node;

    const { x, y, width, height } = dagreNode;
    return {
      ...node,
      position: {
        x: x - width / 2,
        y: y - height / 2,
      },
    };
  });
};

export const useGraphLayout = ({
  localNodes,
  localEdges,
  setLocalNodes,
  nodesRef,
  isApplyingLayout,
}: UseGraphLayoutProps) => {
  const applyLayoutWithNodes = useCallback(
    (nodes: Node[]) => {
      if (nodes.length === 0) return;

      isApplyingLayout.current = true;
      const layoutedNodes = performDagreLayout(nodes, localEdges);

      setLocalNodes(layoutedNodes);
      nodesRef.current = layoutedNodes;

      setTimeout(() => {
        isApplyingLayout.current = false;
      }, 100);
    },
    [localEdges, setLocalNodes, nodesRef, isApplyingLayout],
  );

  const autoLayout = useCallback(() => {
    applyLayoutWithNodes(localNodes);
  }, [localNodes, applyLayoutWithNodes]);

  return {
    autoLayout,
  };
};
