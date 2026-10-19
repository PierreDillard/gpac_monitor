import { memo, useMemo, useRef, useState } from 'react';
import uPlot from 'uplot';
import { UplotChart } from '@/components/common/charts/UplotChart';
import {
  createLineChartConfig,
  useContainerSize,
  type SeriesDef,
  type EndLabelInfo,
} from '@/components/common/charts';

export const CHART_HEIGHT = 140;

interface LineHistoryChartProps {
  series: SeriesDef[];
  data: uPlot.AlignedData;
  formatX: (v: number) => string;
  formatAxisX?: (v: number) => string;
  leftAxisFormat?: (value: number) => string;
  rightAxisFormat?: (value: number) => string;
  showCurrentTime?: boolean;
  showEndLabels?: boolean;
  height?: number;
}

/** Multi-series time chart with real X timestamps and end-value labels (uPlot). */
const LineHistoryChart = memo(
  ({
    series,
    data,
    formatX,
    formatAxisX,
    leftAxisFormat,
    showCurrentTime = true,
    showEndLabels = true,
    height = CHART_HEIGHT,
    rightAxisFormat,
  }: LineHistoryChartProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const dimensions = useContainerSize(containerRef);
    const [endLabels, setEndLabels] = useState<EndLabelInfo[]>([]);

    const options = useMemo(
      () =>
        createLineChartConfig({
          series,
          formatX,
          formatAxisX,
          leftAxis: leftAxisFormat ? { formatY: leftAxisFormat } : undefined,
          rightAxis: rightAxisFormat ? { formatY: rightAxisFormat } : undefined,
          onEndLabels: showEndLabels ? setEndLabels : undefined,
          ...dimensions,
        }),
      [
        series,
        formatX,
        formatAxisX,
        dimensions,
        leftAxisFormat,
        rightAxisFormat,
        showEndLabels,
      ],
    );

    const xData = data[0] as number[];
    const lastX = xData.length > 0 ? xData[xData.length - 1] : null;

    return (
      <div
        style={{ width: '100%' }}
        className="flex flex-col justify-items-end"
      >
        {showCurrentTime && lastX != null && (
          <div className="w-full text-right font-mono text-xs opacity-60 mb-1">
            {formatX(lastX)}
          </div>
        )}
        <div
          ref={containerRef}
          style={{ width: '100%', height, position: 'relative' }}
        >
          <UplotChart
            data={data}
            options={options}
            className="w-12/12 h-full"
          />
          {endLabels.map((endLabel, index) => {
            const clampedTop = Math.min(Math.max(endLabel.top, 0), height - 16);
            return (
              <div
                key={index}
                style={{
                  position: 'absolute',
                  top: clampedTop,
                  right: 2,
                  transform: 'translateY(-50%)',
                  border: `1px solid ${endLabel.color}`,
                  pointerEvents: 'none',
                  zIndex: 10,
                }}
                className="bg-monitor-panel text-[0.714rem] font-mono leading-none text-info px-1 py-0.5 rounded"
              >
                <span className="opacity-70">{endLabel.label}</span>{' '}
                {endLabel.value}
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);

LineHistoryChart.displayName = 'LineHistoryChart';

export default LineHistoryChart;
