import { describe, it, expect } from 'vitest';
import { Node } from '@xyflow/react';
import {
  annotateNodesStable,
  type NodeAnnotationCache,
} from '../nodeAnnotation';

const graphNode = (id: string, filterIdx: number): Node => ({
  id,
  position: { x: 0, y: 0 },
  data: { idx: filterIdx, name: `filter-${filterIdx}` },
});

describe('annotateNodesStable', () => {
  it('same inputs → same references', () => {
    const cache: NodeAnnotationCache = new Map();
    const nodes = [graphNode('0', 0), graphNode('1', 1)];
    const subscribedSet = new Set<number>([0]);

    const first = annotateNodesStable(cache, nodes, subscribedSet);
    const second = annotateNodesStable(cache, nodes, subscribedSet);

    expect(second[0]).toBe(first[0]);
    expect(second[1]).toBe(first[1]);
  });

  it('subscribedSet membership changes for one node → only its reference changes', () => {
    const cache: NodeAnnotationCache = new Map();
    const nodes = [graphNode('0', 0), graphNode('1', 1)];

    const first = annotateNodesStable(cache, nodes, new Set<number>([]));
    const second = annotateNodesStable(cache, nodes, new Set<number>([1]));

    expect(second[0]).toBe(first[0]);
    expect(second[1]).not.toBe(first[1]);
    expect(second[1].data.isMonitored).toBe(true);
  });

  it('node removed from input → evicted from cache', () => {
    const cache: NodeAnnotationCache = new Map();
    const subscribedSet = new Set<number>();

    annotateNodesStable(
      cache,
      [graphNode('0', 0), graphNode('1', 1)],
      subscribedSet,
    );
    annotateNodesStable(cache, [graphNode('0', 0)], subscribedSet);

    expect(cache.has('1')).toBe(false);
  });
});
