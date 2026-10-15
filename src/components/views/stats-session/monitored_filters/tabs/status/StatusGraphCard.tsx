import { memo } from 'react';
import { useAppSelector } from '@/shared/hooks/redux';
import { useChartDuration, useAdaptiveChartHeight } from '@/shared/hooks';
import { selectSelectedStatusMetric } from '@/shared/store/selectors';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { WindowDurationBadge } from '@/components/common/WindowDurationBadge';
import { useIsDetached } from '../../FilterViewContext';
import type { NumericMetric } from '../../utils/statusViewModel';
import { useStatusMetricChartData } from '../../charts/hooks/useStatusMetricChartData';
import { formatCompactTime, formatAxisTime } from '@/utils/formatting';
import LineHistoryChart from '../../charts/LineHistoryChart';
import StatusMetricSelector from './StatusMetricSelector';

interface StatusGraphCardProps {
  metrics: NumericMetric[];
  filterIdx: number;
  filterName: string;
}

const StatusGraphCard = memo(
  ({ metrics, filterIdx, filterName }: StatusGraphCardProps) => {
    const selectedKeys = useAppSelector((state) =>
      selectSelectedStatusMetric(state, filterIdx),
    );
    const isDetached = useIsDetached();
    const chartHeight = useAdaptiveChartHeight();
    const { duration, setDuration, maxPoints } = useChartDuration(
      'status_graph_duration',
      '5min',
      1000,
    );

    const { series, data } = useStatusMetricChartData(
      filterIdx,
      selectedKeys,
      maxPoints,
    );

    return (
      <Card className="bg-monitor-panel border-t-monitor-line border-transparent">
        <CardHeader className="pb-1 px-3 pt-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.786rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Status
              <span className="mx-1 opacity-50">·</span>
              <span className="normal-case font-normal">{filterName}</span>
            </p>
            {!isDetached && (
              <WindowDurationBadge
                value={duration}
                onChange={setDuration}
                options={['1min', '5min']}
              />
            )}
          </div>
          <StatusMetricSelector metrics={metrics} filterIdx={filterIdx} />
        </CardHeader>
        {selectedKeys.length > 0 && (
          <CardContent className="px-3 pb-2 pt-0">
            <LineHistoryChart
              series={series}
              data={data}
              formatX={formatCompactTime}
              formatAxisX={formatAxisTime}
              showCurrentTime
              height={chartHeight}
            />
          </CardContent>
        )}
      </Card>
    );
  },
);

StatusGraphCard.displayName = 'StatusGraphCard';

export default StatusGraphCard;
