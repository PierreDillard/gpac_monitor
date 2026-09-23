import { useEffect, useRef, memo } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

export interface UplotChartProps {
  data: uPlot.AlignedData;
  options: uPlot.Options;
  className?: string;
  onCreate?: (chart: uPlot) => void;
  onDestroy?: (chart: uPlot) => void;
}

/**
 * Low-level wrapper for uPlot chart
 *
 */
export const UplotChart = memo(
  ({ data, options, className, onCreate, onDestroy }: UplotChartProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<uPlot | null>(null);
    const onCreateRef = useRef(onCreate);
    const onDestroyRef = useRef(onDestroy);
    const dataRef = useRef(data);

    // Keep refs up to date
    useEffect(() => {
      onCreateRef.current = onCreate;
      onDestroyRef.current = onDestroy;
      dataRef.current = data;
    });

    useEffect(() => {
      if (!containerRef.current) return;

      const chart = new uPlot(options, dataRef.current, containerRef.current);
      chartRef.current = chart;
      onCreateRef.current?.(chart);

      // Set initial size from container after creation (zero re-renders)
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        chart.setSize({ width: rect.width, height: rect.height });
      }

      return () => {
        if (!chartRef.current) return;
        onDestroyRef.current?.(chartRef.current);
        chartRef.current.destroy();
        chartRef.current = null;
      };
    }, [options]);

    // Update data without recreating chart
    useEffect(() => {
      if (!chartRef.current) return;
      chartRef.current.setData(data);
    }, [data]);

    useEffect(() => {
      const handleResize = () => {
        if (!containerRef.current || !chartRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          chartRef.current.setSize({ width: rect.width, height: rect.height });
        }
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    return <div ref={containerRef} className={className} />;
  },
  (prev, next) => {
    return (
      prev.data === next.data &&
      prev.options === next.options &&
      prev.className === next.className
    );
  },
);

UplotChart.displayName = 'UplotChart';
