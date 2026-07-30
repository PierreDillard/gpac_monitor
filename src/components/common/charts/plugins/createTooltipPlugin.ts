import type uPlot from 'uplot';
import type { SeriesDef } from '../chartTypes';

const TOOLTIP_STYLE =
  'position:absolute;background:rgb(17 24 39);color:rgb(209 213 219);border:1px solid rgb(55 65 81);border-radius:6px;padding:8px 12px;font-size:11px;font-family:monospace;pointer-events:none;z-index:100;white-space:nowrap;box-shadow:0 4px 6px -1px rgb(0 0 0/0.3)';

export function createTooltipPlugin(
  series: SeriesDef[],
  getTimeLabel: (u: uPlot, idx: number) => string,
): uPlot.Plugin {
  let tooltipEl: HTMLDivElement | null = null;
  let lastIdx: number | null = null;

  return {
    hooks: {
      init: [
        (u) => {
          u.over.addEventListener('mouseleave', () => {
            if (tooltipEl) tooltipEl.style.display = 'none';
            lastIdx = null;
          });
        },
      ],
      setCursor: [
        (u) => {
          const { left = 0, top = 0, idx } = u.cursor;
          if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.className = 'u-tooltip';
            tooltipEl.style.cssText = TOOLTIP_STYLE;
            u.root.appendChild(tooltipEl);
          }
          if (idx == null) {
            tooltipEl.style.display = 'none';
            lastIdx = null;
            return;
          }
          const overRect = u.over.getBoundingClientRect();
          const rootRect = u.root.getBoundingClientRect();
          const ox = overRect.left - rootRect.left;
          const oy = overRect.top - rootRect.top;
          const computeLeft = (cursorLeft: number, tooltip: HTMLDivElement) => {
            const tooltipWidth = tooltip.offsetWidth;
            const rootWidth = u.root.clientWidth;
            const rightOf = ox + cursorLeft + 10;
            const leftOf = ox + cursorLeft - tooltipWidth - 10;
            const raw = rightOf + tooltipWidth > rootWidth ? leftOf : rightOf;
            return Math.max(0, raw);
          };

          if (lastIdx === idx) {
            tooltipEl.style.left = `${computeLeft(left, tooltipEl)}px`;
            tooltipEl.style.top = `${oy + top + 1}px`;
            return;
          }
          lastIdx = idx;
          const time = getTimeLabel(u, idx);
          const rows = series
            .map((def, seriesIdx) => {
              const raw = u.data[seriesIdx + 1]?.[idx];
              const display =
                raw != null
                  ? def.formatValue
                    ? def.formatValue(raw as number)
                    : String(raw)
                  : '--';
              if (def.metricLabel) {
                return `<div style="margin-bottom:3px"><div style="color:${def.color};font-weight:600">${def.label}</div><div style="color:${def.color}">${def.metricLabel} = ${display}</div></div>`;
              }
              return `<div style="color:${def.color}">${def.label}: ${display}</div>`;
            })
            .join('');
          tooltipEl.innerHTML = `<div style="margin-bottom:4px;color:#6ee7b7">time = ${time}</div>${rows}`;
          tooltipEl.style.display = 'block';
          tooltipEl.style.left = `${computeLeft(left, tooltipEl)}px`;
          tooltipEl.style.top = `${oy + top + 10}px`;
        },
      ],
      destroy: [
        () => {
          tooltipEl?.remove();
          tooltipEl = null;
          lastIdx = null;
        },
      ],
    },
  };
}
