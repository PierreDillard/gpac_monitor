import type { MutableRefObject } from 'react';
import uPlot from 'uplot';
import {
  formatCpuMemoryTimeLabel,
  type CpuMemoryDataPoint,
} from '@/utils/charts/cpuMemory';
import { formatAxisTime, formatCompactTime } from '@/utils/formatting/time';

export interface UplotConfigParams {
  memoryYAxisMax: number;
  dataPointsRef: MutableRefObject<CpuMemoryDataPoint[]>;
  width?: number;
  height?: number;
}

export const createCpuMemoryUplotConfig = ({
  memoryYAxisMax,
  dataPointsRef,
  width = 100,
  height = 100,
}: UplotConfigParams): uPlot.Options => {
  return {
    width,
    height,
    padding: [10, 10, 5, 5],
    cursor: {
      show: true,
      drag: { x: false, y: false },
      points: {
        size: 8,
        width: 2,
      },
    },
    legend: {
      show: false,
      live: false,
    },
    hooks: {
      setCursor: [
        (u) => {
          const { left = 0, top = 0, idx } = u.cursor;

          if (idx === null || idx === undefined) {
            const tooltip = u.root.querySelector('.u-tooltip');
            if (tooltip) (tooltip as HTMLElement).style.display = 'none';
            return;
          }

          let tooltip = u.root.querySelector('.u-tooltip') as HTMLElement;
          if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'u-tooltip';
            tooltip.style.cssText = `
              position: absolute;
              background: rgb(2 6 23);
              color: rgb(226 232 240);
              border: 1px solid hsl(var(--border));
              border-radius: 6px;
              padding: 8px 10px;
              font-size: 11px;
              font-family: monospace;
              pointer-events: none;
              z-index: 100;
              white-space: nowrap;
            `;
            u.root.appendChild(tooltip);
          }

          const time =
            formatCpuMemoryTimeLabel(
              dataPointsRef.current,
              idx,
              formatCompactTime,
            ) || '--';
          const memory = u.data[1][idx]?.toFixed(2) || '--';
          const cpu = u.data[2][idx]?.toFixed(2) || '--';

          tooltip.innerHTML = `
            <div style="margin-bottom: 4px; color: #6ee7b7;">Time: ${time}</div>
            <div style="color: #38bdf8;">Memory: ${memory} MB</div>
            <div style="color: #ef4444;">CPU: ${cpu}%</div>
          `;

          tooltip.style.display = 'block';
          tooltip.style.left = `${left + 15}px`;
          tooltip.style.top = `${top + 15}px`;
        },
      ],
    },
    series: [
      { label: 'Time' },
      {
        label: 'Memory (MB)',
        stroke: '#38bdf8',
        width: 2,
        fill: 'rgba(56, 189, 248, 0.15)',
        scale: 'memory',
        value: (_u, v) => (v == null ? '--' : `${v.toFixed(2)} MB`),
      },
      {
        label: 'CPU (%)',
        stroke: '#ef4444',
        width: 2,
        fill: 'rgba(239, 68, 68, 0.15)',
        scale: 'cpu',
        value: (_u, v) => (v == null ? '--' : `${v.toFixed(2)}%`),
      },
    ],
    scales: {
      x: { time: false },
      memory: { range: [0, memoryYAxisMax] },
      cpu: { range: [0, 100] },
    },
    axes: [
      {
        stroke: '#6ee7b7',
        grid: { show: true, stroke: 'rgba(110, 231, 183, 0.1)', width: 1 },
        ticks: { stroke: '#6ee7b7', size: 5, width: 1 },
        font: '11px monospace',
        size: 50,
        space: 80,
        values: (_u, vals) =>
          vals.map((tickIndex) =>
            formatCpuMemoryTimeLabel(
              dataPointsRef.current,
              Math.round(tickIndex),
              formatAxisTime,
            ),
          ),
      },
      {
        scale: 'memory',
        stroke: '#38bdf8',
        side: 3,
        grid: { show: true, stroke: 'rgba(56, 189, 248, 0.1)', width: 1 },
        ticks: { stroke: '#38bdf8', size: 5, width: 2 },
        font: '11px monospace',
        size: 60,
        values: (_u, vals) => vals.map((v) => `${v.toFixed(0)}`),
      },
      {
        scale: 'cpu',
        stroke: '#ef4444',
        side: 1,
        grid: { show: false },
        ticks: { stroke: '#ef4444', size: 5, width: 2 },
        font: '11px monospace',
        size: 55,
        values: (_u, vals) => vals.map((v) => `${v}%`),
      },
    ],
  };
};
