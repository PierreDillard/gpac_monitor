import { memo, useMemo, useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UplotChart } from '@/components/common/charts/UplotChart';
import { useContainerSize } from '@/components/common/charts';
import { useChartData } from '../hooks/useChartData';
import { useDataMode } from '@/shared/hooks/data/useDataMode';
import { createCpuMemoryUplotConfig } from './uplotConfig';
import {
  prepareCpuMemoryData,
  calculateMemoryYMax,
  type CpuMemoryDataPoint,
} from '@/utils/charts/cpuMemory';
import { selectSystemStatsHistory } from '@/shared/store/selectors/sessionDetails/sessionDetailsSelectors';

interface CpuMemoryChartUplotProps {
  currentCPUPercent: number;
  currentMemoryBytes: number;
  animating: boolean;
  maxPoints?: number;
  windowDuration?: number;
}

export const CpuMemoryChartUplot = memo(
  ({
    currentCPUPercent,
    currentMemoryBytes,
    animating,
    maxPoints = 400,
    windowDuration,
  }: CpuMemoryChartUplotProps) => {
    const { isHistory } = useDataMode();
    const systemStatsHistory = useSelector(selectSystemStatsHistory);
    const timeLabelsRef = useRef<string[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const dimensions = useContainerSize(containerRef);

    const currentMemoryMB = useMemo(
      () => currentMemoryBytes / (1024 * 1024),
      [currentMemoryBytes],
    );

    const [stableYMax, setStableYMax] = useState(() =>
      calculateMemoryYMax(currentMemoryMB),
    );

    const currentMemoryMBRef = useRef(currentMemoryMB);
    currentMemoryMBRef.current = currentMemoryMB;

    useEffect(() => {
      setStableYMax(calculateMemoryYMax(currentMemoryMBRef.current));
    }, [isHistory]);

    useEffect(() => {
      const next = calculateMemoryYMax(currentMemoryMB);
      if (next > stableYMax) setStableYMax(next);
    }, [currentMemoryMB, stableYMax]);

    const { dataPoints: liveDataPoints } = useChartData(
      currentCPUPercent,
      currentMemoryMB,
      animating,
      maxPoints,
      windowDuration,
      150,
    );

    const historyDataPoints = useMemo((): CpuMemoryDataPoint[] => {
      return systemStatsHistory.map((s) => ({
        timestamp: s.timestamp / 1000,
        time: s.time,
        cpu_percent: s.process_cpu_usage,
        memory_mb: s.process_memory / (1024 * 1024),
      }));
    }, [systemStatsHistory]);

    const dataPoints = isHistory ? historyDataPoints : liveDataPoints;

    const options = useMemo(
      () =>
        createCpuMemoryUplotConfig({
          memoryYAxisMax: stableYMax,
          timeLabelsRef,
          width: dimensions.width,
          height: dimensions.height,
        }),
      [stableYMax, dimensions],
    );

    const data = useMemo(() => {
      const { alignedData, timeLabels } = prepareCpuMemoryData(dataPoints);
      timeLabelsRef.current = timeLabels;
      return alignedData;
    }, [dataPoints]);

    return (
      <Card className="bg-monitor-panel border-transparent h-full flex flex-col">
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="flex justify-center items-center gap-2 text-sm stat stat-label">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-sky-400" />
              Memory
            </span>
            /
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-red-500" />
              CPU
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 flex-1 min-h-0">
          <div ref={containerRef} className="w-full h-full">
            <UplotChart
              data={data}
              options={options}
              className="w-full h-full"
            />
          </div>
        </CardContent>
      </Card>
    );
  },
);

CpuMemoryChartUplot.displayName = 'CpuMemoryChartUplot';
