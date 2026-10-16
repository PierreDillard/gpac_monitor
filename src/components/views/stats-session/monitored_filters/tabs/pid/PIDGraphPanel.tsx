import { memo, useMemo } from 'react';
import { useAppSelector } from '@/shared/hooks/redux';
import { useAdaptiveChartHeight } from '@/shared/hooks';
import { selectAllSelectedPidSamplesByFilter } from '@/shared/store/selectors';
import type { PIDMetricMode } from '../../../types/pid';
import { PID_SELECTION_COLORS } from './utils/pidColors';
import {
  usePIDChartData,
  type PIDSeriesEntry,
} from '../../charts/hooks/usePIDChartData';
import {
  MODE_FORMATTERS,
  PID_METRICS_BY_KEY,
} from '../../charts/config/pidHistoryChartConfig';
import { formatCompactTime, formatAxisTime } from '@/utils/formatting';
import LineHistoryChart from '../../charts/LineHistoryChart';

interface PIDGraphPanelProps {
  filterIdx: number;
  mode: PIDMetricMode;
  showEndLabels: boolean;
  maxPoints?: number;
  showSessionTimeLabel?: boolean;
}

const PIDGraphPanel = memo(
  ({ filterIdx, mode, showEndLabels, maxPoints }: PIDGraphPanelProps) => {
    const allSamples = useAppSelector((state) =>
      selectAllSelectedPidSamplesByFilter(state, filterIdx),
    );

    const entries = useMemo<PIDSeriesEntry[]>(
      () =>
        allSamples.map(({ target, pidHistory }, index) => {
          const typeStr = target.streamTypeLabel
            ? ` (${target.streamTypeLabel})`
            : '';
          const sliced =
            maxPoints != null ? pidHistory.slice(-maxPoints) : pidHistory;
          return {
            pidHistory: sliced,
            label: `PID ${target.pidIndex}${typeStr}`,
            metricLabel: PID_METRICS_BY_KEY[mode].label,
            color: PID_SELECTION_COLORS[index],
          };
        }),
      [allSamples, mode, maxPoints],
    );

    const chartHeight = useAdaptiveChartHeight();
    const { series, data } = usePIDChartData(entries, mode);

    if (entries.length === 0) return null;

    return (
      <div className="p-2">
        <LineHistoryChart
          series={series}
          data={data}
          formatX={formatCompactTime}
          formatAxisX={formatAxisTime}
          leftAxisFormat={MODE_FORMATTERS[mode]}
          showCurrentTime
          showEndLabels={showEndLabels}
          height={chartHeight}
        />
      </div>
    );
  },
);

PIDGraphPanel.displayName = 'PIDGraphPanel';

export default PIDGraphPanel;
