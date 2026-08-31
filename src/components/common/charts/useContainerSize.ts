import { useState, useEffect, type RefObject } from 'react';

export const useContainerSize = (ref: RefObject<HTMLElement>) => {
  const [size, setSize] = useState({ width: 400, height: 160 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const applySize = (width: number, height: number) => {
      const nextWidth = width || 400;
      const nextHeight = height || 160;
      setSize((previousSize) =>
        previousSize.width === nextWidth && previousSize.height === nextHeight
          ? previousSize
          : { width: nextWidth, height: nextHeight },
      );
    };

    const initialRect = el.getBoundingClientRect();
    applySize(initialRect.width, initialRect.height);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      applySize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
};
