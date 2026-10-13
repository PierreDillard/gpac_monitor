export enum ScrollDirection {
  Down = 'down',
  Up = 'up',
}

export const readScrollDirection = (
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
): ScrollDirection | null => {
  const maxScrollTop = scrollHeight - clientHeight;
  if (maxScrollTop <= 0) return null;
  return scrollTop < maxScrollTop / 2
    ? ScrollDirection.Down
    : ScrollDirection.Up;
};
