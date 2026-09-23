import { useState, useEffect } from 'react';

interface AdaptiveChartHeightOptions {
  min?: number;
  max?: number;
  viewportFraction?: number; // proportion of window.innerHeight used as target height (0–1)
}

const computeHeight = (
  min: number,
  max: number,
  viewportFraction: number,
): number =>
  Math.max(
    min,
    Math.min(max, Math.floor(window.innerHeight * viewportFraction)),
  );

export function useAdaptiveChartHeight({
  min = 180,
  max = 320,
  viewportFraction = 0.2,
}: AdaptiveChartHeightOptions = {}): number {
  const [height, setHeight] = useState(() =>
    computeHeight(min, max, viewportFraction),
  );

  useEffect(() => {
    const onResize = () => setHeight(computeHeight(min, max, viewportFraction));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [min, max, viewportFraction]);

  return height;
}
