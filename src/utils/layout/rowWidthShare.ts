import { Layout } from 'react-grid-layout';

export interface RowWidthShare {
  width: number;
  neighbors: Layout[];
}

const sharesRows = (item: Layout, other: Layout): boolean =>
  other.y < item.y + item.h && item.y < other.y + other.h;

export const shareRowWidth = (
  startLayout: Layout[],
  resizedItem: Layout,
): RowWidthShare => {
  const startItem = startLayout.find((item) => item.i === resizedItem.i);
  if (!startItem) return { width: resizedItem.w, neighbors: [] };

  const startRight = startItem.x + startItem.w;
  const rightItems = startLayout.filter(
    (item) =>
      item.i !== resizedItem.i &&
      item.x >= startRight &&
      sharesRows(resizedItem, item),
  );
  const maxRight = rightItems.reduce(
    (limit, item) => Math.min(limit, item.x + item.w - (item.minW ?? 1)),
    Infinity,
  );
  const width = Math.min(resizedItem.w, maxRight - resizedItem.x);
  const right = resizedItem.x + width;
  const neighbors = rightItems.map((item) =>
    item.x < right ? { ...item, x: right, w: item.x + item.w - right } : item,
  );

  return { width, neighbors };
};

export const changedLayoutItems = (
  startLayout: Layout[],
  layout: Layout[],
): Layout[] =>
  layout.filter((item) => {
    const startItem = startLayout.find((start) => start.i === item.i);
    return (
      !startItem ||
      startItem.x !== item.x ||
      startItem.y !== item.y ||
      startItem.w !== item.w ||
      startItem.h !== item.h
    );
  });

export const applyRowWidthShare = (
  startLayout: Layout[],
  layout: Layout[],
  resizedItem: Layout,
  placeholder: Layout,
): void => {
  const { width, neighbors } = shareRowWidth(startLayout, resizedItem);
  resizedItem.w = width;
  placeholder.w = width;
  neighbors.forEach((neighbor) => {
    const index = layout.findIndex((item) => item.i === neighbor.i);
    if (index === -1) return;
    layout[index] = { ...layout[index], x: neighbor.x, w: neighbor.w };
  });
};
