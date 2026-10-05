import type { Edge } from '@xyflow/react';
import type { PIDGraphTarget } from '@/components/views/stats-session/types/pid';

export const MONITORED_PID_EDGE_CLASS = 'monitored-pid-edge';
const MONITORED_PID_EDGE_Z_INDEX = 1001;
const LABEL_FALLBACK_COLOR = '#6b7280';
const LABEL_BG_PADDING: [number, number] = [8, 4];

const inputKey = (filterId: string, handleId: string | null | undefined) =>
  `in:${filterId}:${handleId}`;

const outputKey = (filterId: string, handleId: string | null | undefined) =>
  `out:${filterId}:${handleId}`;

function buildLabelTextByKey(targets: PIDGraphTarget[]): Map<string, string> {
  const labelTextByKey = new Map<string, string>();
  targets.forEach((target) => {
    const filterId = String(target.filterIdx);
    const key =
      target.direction === 'input'
        ? inputKey(filterId, `ipid-${target.pidIndex}`)
        : outputKey(filterId, `opid-${target.pidIndex}`);
    labelTextByKey.set(
      key,
      target.infoLine
        ? `PID #${target.pidIndex} | ${target.infoLine}`
        : (target.label ?? `PID #${target.pidIndex}`),
    );
  });
  return labelTextByKey;
}

export function applyMonitoredPidEdges(
  edges: Edge[],
  targets: PIDGraphTarget[],
): Edge[] {
  if (targets.length === 0) return edges;

  const labelTextByKey = buildLabelTextByKey(targets);

  return edges.map((edge) => {
    const labelText =
      labelTextByKey.get(inputKey(edge.target, edge.targetHandle)) ??
      labelTextByKey.get(outputKey(edge.source, edge.sourceHandle));
    if (!labelText) return edge;

    const streamColor = edge.style?.stroke ?? LABEL_FALLBACK_COLOR;

    return {
      ...edge,
      className: MONITORED_PID_EDGE_CLASS,
      zIndex: MONITORED_PID_EDGE_Z_INDEX,
      label: labelText,
      labelStyle: { fill: streamColor, fontSize: 13, fontWeight: 600 },
      labelShowBg: true,
      labelBgStyle: {
        stroke: streamColor,
        strokeWidth: 1.5,
      },
      labelBgPadding: LABEL_BG_PADDING,
      labelBgBorderRadius: 6,
    };
  });
}
