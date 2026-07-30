import uPlot from 'uplot';
import { createTooltipPlugin } from './plugins/createTooltipPlugin';
import type { SeriesDef, AxisConfig, EndLabelInfo } from './chartTypes';

export type { SeriesDef, AxisConfig, EndLabelInfo };

export interface LineChartConfigOptions {
  series: SeriesDef[];
  leftAxis?: AxisConfig;
  rightAxis?: AxisConfig;
  formatX: (v: number) => string;
  /** @deprecated use leftAxis.formatY */
  formatY?: (v: number) => string;
  onEndLabels?: (labels: EndLabelInfo[]) => void;
  width: number;
  height: number;
}

const DEFAULT_GRID = 'rgba(110, 231, 183, 0.1)';

export const createLineChartConfig = ({
  series,
  leftAxis,
  rightAxis,
  formatY = String,
  formatX,
  onEndLabels,
  width,
  height,
}: LineChartConfigOptions): uPlot.Options => {
  const hasRightAxis =
    rightAxis != null && series.some((def) => def.yAxis === 'right');
  const rightColor =
    rightAxis?.color ??
    series.find((def) => def.yAxis === 'right')?.color ??
    '#6ee7b7';
  const leftFmt = leftAxis?.formatY ?? formatY;
  const leftColor = leftAxis?.color ?? '#6ee7b7';

  const getTimeLabel = (u: uPlot, idx: number): string =>
    formatX(u.data[0][idx] as number);

  return {
    width,
    height,
    padding: [10, 10, 5, 5],
    cursor: {
      show: true,
      drag: { x: false, y: false },
      points: { size: 8, width: 2 },
    },
    legend: { show: false },
    plugins: [createTooltipPlugin(series, getTimeLabel)],
    hooks: {
      draw: onEndLabels
        ? [
            (u) => {
              const oy =
                u.over.getBoundingClientRect().top -
                u.root.getBoundingClientRect().top;
              const labels: EndLabelInfo[] = [];
              for (let i = 0; i < series.length; i++) {
                const col = u.data[i + 1] as (number | null)[];
                let lastVal: number | null = null;
                for (let j = col.length - 1; j >= 0; j--) {
                  if (col[j] != null) {
                    lastVal = col[j] as number;
                    break;
                  }
                }
                if (lastVal == null) continue;
                const def = series[i];
                labels.push({
                  top: oy + u.valToPos(lastVal, 'y', false),
                  value: def.formatValue
                    ? def.formatValue(lastVal)
                    : String(lastVal),
                  color: def.color,
                  label: def.label,
                });
              }
              onEndLabels(labels);
            },
          ]
        : [],
    },
    series: [
      { label: 'Time' },
      ...series.map((def) => ({
        label: def.label,
        stroke: def.color,
        width: def.strokeWidth ?? 0.7,
        ...(def.fill ? { fill: def.fill } : {}),
        ...(def.yAxis === 'right' ? { scale: 'right' } : {}),
        value: (_u: uPlot, v: number | null) =>
          v == null ? '--' : def.formatValue ? def.formatValue(v) : String(v),
      })),
    ],
    scales: {
      x: { time: false },
      y: { ...(leftAxis?.range ? { range: leftAxis.range } : {}) },
      ...(hasRightAxis
        ? { right: { ...(rightAxis?.range ? { range: rightAxis.range } : {}) } }
        : {}),
    },
    axes: [
      {
        stroke: '#6ee7b7',
        grid: { show: true, stroke: DEFAULT_GRID, width: 1 },
        ticks: { stroke: '#6ee7b7', size: 5, width: 1 },
        font: '10px monospace',
        size: 50,
        values: (_u: uPlot, vals: number[]) => vals.map((v) => formatX(v)),
      },
      {
        stroke: leftColor,
        grid: {
          show: true,
          stroke: leftAxis?.gridStroke ?? DEFAULT_GRID,
          width: 1,
        },
        ticks: { stroke: leftColor, size: 5, width: 2 },
        font: '10px monospace',
        size: leftAxis?.size ?? 80,
        values: (_u: uPlot, vals: number[]) =>
          vals.map((v) => leftFmt(v as number)),
      },
      ...(hasRightAxis && rightAxis
        ? [
            {
              scale: 'right',
              side: 1,
              stroke: rightColor,
              grid: { show: false },
              ticks: { stroke: rightColor, size: 5, width: 1 },
              font: '10px monospace',
              size: rightAxis.size ?? 70,
              values: (_u: uPlot, vals: number[]) =>
                vals.map((v) => rightAxis.formatY(v as number)),
            },
          ]
        : []),
    ],
  };
};
