import { describe, it, expect } from 'vitest';
import { Edge } from '@xyflow/react';
import {
  updateEdgesWithState,
  EDGE_ANIMATION_MAX_EDGES,
} from '../useGraphMonitor.helpers';

function makeEdges(): Edge[] {
  return [
    { id: 'e1-2', source: '1', target: '2' } as Edge,
    { id: 'e2-3', source: '2', target: '3' } as Edge,
    { id: 'e3-4', source: '3', target: '4' } as Edge,
  ];
}

function makeLargeEdges(count: number): Edge[] {
  return Array.from(
    { length: count },
    (_unused, index) =>
      ({
        id: `e${index}-${index + 1}`,
        source: `${index}`,
        target: `${index + 1}`,
      }) as Edge,
  );
}

describe('updateEdgesWithState', () => {
  describe('below the animation threshold', () => {
    it('animates every edge even when no node is selected', () => {
      const edgesRef = { current: [] as Edge[] };
      const result = updateEdgesWithState(makeEdges(), edgesRef, null);

      expect(result.every((edge) => edge.animated === true)).toBe(true);
    });

    it('keeps every edge animated when a node is selected', () => {
      const edgesRef = { current: [] as Edge[] };
      const result = updateEdgesWithState(makeEdges(), edgesRef, '2');

      expect(result.every((edge) => edge.animated === true)).toBe(true);
    });
  });

  describe('above the animation threshold', () => {
    const edgeCount = EDGE_ANIMATION_MAX_EDGES + 1;

    it('animates no edge when no node is selected', () => {
      const edgesRef = { current: [] as Edge[] };
      const result = updateEdgesWithState(
        makeLargeEdges(edgeCount),
        edgesRef,
        null,
      );

      expect(result.every((edge) => edge.animated === false)).toBe(true);
    });

    it('animates only the edges incident to the selected node', () => {
      const edgesRef = { current: [] as Edge[] };
      const result = updateEdgesWithState(
        makeLargeEdges(edgeCount),
        edgesRef,
        '2',
      );

      expect(result.find((edge) => edge.id === 'e1-2')?.animated).toBe(true);
      expect(result.find((edge) => edge.id === 'e2-3')?.animated).toBe(true);
      expect(result.find((edge) => edge.id === 'e3-4')?.animated).toBe(false);
    });

    it('drops animation on the previously selected edges when the selection changes', () => {
      const edges = makeLargeEdges(edgeCount);
      const edgesRef = {
        current: updateEdgesWithState(edges, { current: [] }, '2'),
      };
      const result = updateEdgesWithState(edges, edgesRef, '4');

      expect(result.find((edge) => edge.id === 'e1-2')?.animated).toBe(false);
      expect(result.find((edge) => edge.id === 'e2-3')?.animated).toBe(false);
      expect(result.find((edge) => edge.id === 'e3-4')?.animated).toBe(true);
    });

    it('does not carry over a stale animated flag from the existing edge', () => {
      const edgesRef = {
        current: [
          { id: 'e1-2', source: '1', target: '2', animated: true } as Edge,
        ],
      };
      const result = updateEdgesWithState(
        makeLargeEdges(edgeCount),
        edgesRef,
        null,
      );

      expect(result.find((edge) => edge.id === 'e1-2')?.animated).toBe(false);
    });
  });

  it('preserves the selected flag reported from the existing edge', () => {
    const edgesRef = {
      current: [
        { id: 'e1-2', source: '1', target: '2', selected: true } as Edge,
      ],
    };
    const result = updateEdgesWithState(makeEdges(), edgesRef, null);

    expect(result.find((edge) => edge.id === 'e1-2')?.selected).toBe(true);
  });
});
