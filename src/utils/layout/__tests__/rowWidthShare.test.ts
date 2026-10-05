import { describe, it, expect } from 'vitest';
import { Layout } from 'react-grid-layout';
import { changedLayoutItems, shareRowWidth } from '../rowWidthShare';

const graph: Layout = { i: 'graph', x: 0, y: 0, w: 12, h: 6, minW: 2 };
const filters: Layout = { i: 'filters', x: 12, y: 0, w: 12, h: 6, minW: 10 };
const logs: Layout = { i: 'logs', x: 0, y: 6, w: 24, h: 4, minW: 2 };

describe('shareRowWidth', () => {
  it('shrinks the right neighbor by the width gained', () => {
    const narrowFilters = { ...filters, minW: 2 };
    const share = shareRowWidth([graph, narrowFilters, logs], {
      ...graph,
      w: 15,
    });

    expect(share.width).toBe(15);
    expect(share.neighbors).toEqual([{ ...narrowFilters, x: 15, w: 9 }]);
  });

  it('caps the resized item when the neighbor reaches its minimum', () => {
    const share = shareRowWidth([graph, filters, logs], { ...graph, w: 18 });

    expect(share.width).toBe(14);
    expect(share.neighbors).toEqual([{ ...filters, x: 14, w: 10 }]);
  });

  it('restores the neighbor start geometry when the item shrinks back', () => {
    const share = shareRowWidth([graph, filters, logs], { ...graph, w: 12 });

    expect(share.width).toBe(12);
    expect(share.neighbors).toEqual([filters]);
  });

  it('leaves the resize unchanged without a neighbor on the same rows', () => {
    const share = shareRowWidth([graph, logs], { ...graph, w: 16 });

    expect(share.width).toBe(16);
    expect(share.neighbors).toEqual([]);
  });
});

describe('changedLayoutItems', () => {
  it('returns only the items whose geometry changed during the resize', () => {
    const resizedGraph = { ...graph, w: 14 };
    const shrunkFilters = { ...filters, x: 14, w: 10 };

    expect(
      changedLayoutItems(
        [graph, filters, logs],
        [resizedGraph, shrunkFilters, { ...logs }],
      ),
    ).toEqual([resizedGraph, shrunkFilters]);
  });
});
