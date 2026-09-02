import { Node } from '@xyflow/react';

interface AnnotationCacheEntry {
  sourceNode: Node;
  isMonitored: boolean;
  annotatedNode: Node;
}

export type NodeAnnotationCache = Map<string, AnnotationCacheEntry>;

function getFilterIdx(node: Node): number | undefined {
  const filterIdx = node.data?.idx as number | undefined;
  return typeof filterIdx === 'number' ? filterIdx : undefined;
}

export function annotateNodesStable(
  cache: NodeAnnotationCache,
  nodes: Node[],
  subscribedSet: Set<number>,
): Node[] {
  const seenNodeIds = new Set<string>();

  const annotatedNodes = nodes.map((node): Node => {
    seenNodeIds.add(node.id);

    const filterIdx = getFilterIdx(node);
    const isMonitored = filterIdx !== undefined && subscribedSet.has(filterIdx);

    const cachedEntry = cache.get(node.id);
    if (
      cachedEntry &&
      cachedEntry.sourceNode === node &&
      cachedEntry.isMonitored === isMonitored
    ) {
      return cachedEntry.annotatedNode;
    }

    const annotatedNode: Node = {
      ...node,
      data: {
        ...node.data,
        isMonitored,
      },
    };
    cache.set(node.id, {
      sourceNode: node,
      isMonitored,
      annotatedNode,
    });
    return annotatedNode;
  });

  for (const nodeId of cache.keys()) {
    if (!seenNodeIds.has(nodeId)) cache.delete(nodeId);
  }

  return annotatedNodes;
}
