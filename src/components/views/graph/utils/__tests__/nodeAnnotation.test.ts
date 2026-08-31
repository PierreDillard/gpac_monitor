import { describe, it, expect } from 'vitest';
import { Node } from '@xyflow/react';
import {
  annotateNodesStable,
  type NodeAnnotationCache,
} from '../nodeAnnotation';
import type { FilterAlerts } from '@/shared/store/slices/logs/logs.types';

const graphNode = (id: string, filterIdx: number): Node => ({
  id,
  position: { x: 0, y: 0 },
  data: { idx: filterIdx, name: `filter-${filterIdx}` },
});

const filterAlerts = (): FilterAlerts => ({
  warnings: 0,
  errors: 0,
  info: 0,
});

describe('annotateNodesStable', () => {
  it('same inputs → same references', () => {
    const cache: NodeAnnotationCache = new Map();
    const nodes = [graphNode('0', 0), graphNode('1', 1)];
    const subscribedSet = new Set<number>([0]);
    const allAlerts = {};

    const first = annotateNodesStable(cache, nodes, subscribedSet, allAlerts);
    const second = annotateNodesStable(cache, nodes, subscribedSet, allAlerts);

    expect(second[0]).toBe(first[0]);
    expect(second[1]).toBe(first[1]);
  });

  it('subscribedSet membership changes for one node → only its reference changes', () => {
    const cache: NodeAnnotationCache = new Map();
    const nodes = [graphNode('0', 0), graphNode('1', 1)];
    const allAlerts = {};

    const first = annotateNodesStable(
      cache,
      nodes,
      new Set<number>([]),
      allAlerts,
    );
    const second = annotateNodesStable(
      cache,
      nodes,
      new Set<number>([1]),
      allAlerts,
    );

    expect(second[0]).toBe(first[0]);
    expect(second[1]).not.toBe(first[1]);
    expect(second[1].data.isMonitored).toBe(true);
  });

  it('node removed from input → evicted from cache', () => {
    const cache: NodeAnnotationCache = new Map();
    const subscribedSet = new Set<number>();
    const allAlerts = {};

    annotateNodesStable(
      cache,
      [graphNode('0', 0), graphNode('1', 1)],
      subscribedSet,
      allAlerts,
    );
    annotateNodesStable(cache, [graphNode('0', 0)], subscribedSet, allAlerts);

    expect(cache.has('1')).toBe(false);
  });

  it('alerts identical by reference → no new object for that node', () => {
    const cache: NodeAnnotationCache = new Map();
    const nodes = [graphNode('0', 0)];
    const subscribedSet = new Set<number>();
    const alerts = filterAlerts();
    const allAlerts = { '0': alerts };

    const first = annotateNodesStable(cache, nodes, subscribedSet, allAlerts);
    const second = annotateNodesStable(cache, nodes, subscribedSet, allAlerts);

    expect(second[0]).toBe(first[0]);
  });
});
