import { memo, useMemo, useState } from 'react';
import { LuArrowUpDown } from 'react-icons/lu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type uPlot from 'uplot';
import { SeriesLegend } from '@/components/common/charts';
import { useFilterPerformanceChartData } from '../../charts/hooks/useFilterPerformanceChartData';
import {
  BANDWIDTH_SERIES,
  formatBw,
} from '../../charts/config/bandwidthCombinedUplotConfig';
import {
  formatMicroseconds,
  formatCompactTime,
  formatAxisTime,
} from '@/utils/formatting';
import { useAdaptiveChartHeight } from '@/shared/hooks';
import LineHistoryChart from '../../charts/LineHistoryChart';

type SeriesKey = 'outband' | 'inband' | 'lastTaskTime';

const SERIES_ORDER: SeriesKey[] = ['outband', 'inband', 'lastTaskTime'];

const SERIES_META: Record<SeriesKey, { label: string; color: string }> = {
  outband: { label: 'Outband', color: '#10b981' },
  inband: { label: 'Inband', color: '#3b82f6' },
  lastTaskTime: { label: 'Filter Proc. Time', color: '#f59e0b' },
};

interface FilterPerformanceCardProps {
  filterId: string;
  showCurrentTime?: boolean;
  maxPoints?: number;
}

export const FilterPerformanceCard = memo(
  ({
    filterId,
    showCurrentTime = false,
    maxPoints,
  }: FilterPerformanceCardProps) => {
    const chartHeight = useAdaptiveChartHeight();

    const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
      outband: true,
      inband: true,
      lastTaskTime: true,
    });

    const { outbandPoints, inbandPoints, lastTaskTimePoints } =
      useFilterPerformanceChartData({ filterId });

    const data = useMemo((): uPlot.AlignedData => {
      const slicedOutband =
        maxPoints != null ? outbandPoints.slice(-maxPoints) : outbandPoints;
      const slicedInband =
        maxPoints != null ? inbandPoints.slice(-maxPoints) : inbandPoints;
      const slicedLastTask =
        maxPoints != null
          ? lastTaskTimePoints.slice(-maxPoints)
          : lastTaskTimePoints;
      const maxLength = Math.max(slicedOutband.length, slicedInband.length);
      const xValues = Array.from({ length: maxLength }, (_, index) => {
        return (
          slicedOutband[index]?.timestamp ?? slicedInband[index]?.timestamp ?? 0
        );
      });

      const pointsMap: Record<SeriesKey, (number | null)[]> = {
        outband: xValues.map((_, index) => slicedOutband[index]?.value ?? 0),
        inband: xValues.map((_, index) => slicedInband[index]?.value ?? 0),
        lastTaskTime: xValues.map(
          (_, index) => slicedLastTask[index]?.value ?? 0,
        ),
      };

      const visibleKeys = SERIES_ORDER.filter((key) => visible[key]);
      return [xValues, ...visibleKeys.map((key) => pointsMap[key])];
    }, [outbandPoints, inbandPoints, lastTaskTimePoints, visible, maxPoints]);

    const filteredSeries = useMemo(
      () =>
        SERIES_ORDER.flatMap((key, idx) =>
          visible[key] ? [BANDWIDTH_SERIES[idx]] : [],
        ),
      [visible],
    );

    const lastTs =
      outbandPoints.at(-1)?.timestamp ?? inbandPoints.at(-1)?.timestamp;

    return (
      <Card className="bg-monitor-panel border-transparent">
        <CardHeader className="pb-1">
          <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <LuArrowUpDown className="h-4 w-4 opacity-60 shrink-0" />
            <SeriesLegend
              items={SERIES_ORDER.map((key) => ({
                key,
                label: SERIES_META[key].label,
                color: SERIES_META[key].color,
                active: visible[key],
                onToggle: () =>
                  setVisible((prev) => ({ ...prev, [key]: !prev[key] })),
              }))}
            />
            {showCurrentTime && lastTs != null && (
              <span className="ml-auto font-mono normal-case opacity-60 text-xs">
                {formatCompactTime(lastTs)}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <LineHistoryChart
            series={filteredSeries}
            data={data}
            formatX={formatCompactTime}
            formatAxisX={formatAxisTime}
            leftAxisFormat={formatBw}
            rightAxisFormat={formatMicroseconds}
            showCurrentTime={false}
            showEndLabels={false}
            height={chartHeight}
          />
        </CardContent>
      </Card>
    );
  },
);

FilterPerformanceCard.displayName = 'FilterPerformanceCard';
