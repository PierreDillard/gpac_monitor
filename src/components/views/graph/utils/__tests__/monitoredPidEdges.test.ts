import { describe, it, expect } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { PIDGraphTarget } from '@/components/views/stats-session/types/pid';
import { getFilterColor } from '@/utils/filters/streamType';
import {
  applyMonitoredPidEdges,
  MONITORED_PID_EDGE_CLASS,
} from '../monitoredPidEdges';

const audioStyle = { stroke: getFilterColor('audio'), strokeWidth: 3 };
const videoStyle = { stroke: getFilterColor('video'), strokeWidth: 3 };

function makeEdges(): Edge[] {
  return [
    {
      id: 'edge:1->5:ipid:0',
      source: '1',
      target: '5',
      sourceHandle: 'opid-0',
      targetHandle: 'ipid-0',
      style: audioStyle,
    },
    {
      id: 'edge:2->5:ipid:1',
      source: '2',
      target: '5',
      sourceHandle: 'opid-0',
      targetHandle: 'ipid-1',
      style: videoStyle,
    },
    {
      id: 'edge:5->6:ipid:0',
      source: '5',
      target: '6',
      sourceHandle: 'opid-0',
      targetHandle: 'ipid-0',
      style: audioStyle,
    },
    {
      id: 'edge:5->7:ipid:0',
      source: '5',
      target: '7',
      sourceHandle: 'opid-0',
      targetHandle: 'ipid-0',
      style: audioStyle,
    },
  ];
}

const videoInputTarget: PIDGraphTarget = {
  filterIdx: 5,
  direction: 'input',
  pidIndex: 1,
  label: '#1·V·264·640×480',
  infoLine: '264 · 640×480 · 25.00 fps',
};

describe('applyMonitoredPidEdges', () => {
  it('returns the same array when no PID is monitored', () => {
    const edges = makeEdges();
    expect(applyMonitoredPidEdges(edges, [])).toBe(edges);
  });

  it('labels only the edge feeding the monitored input PID, in its stream color', () => {
    const edges = makeEdges();
    const result = applyMonitoredPidEdges(edges, [videoInputTarget]);

    expect(result[1].label).toBe('PID #1 | 264 · 640×480 · 25.00 fps');
    expect(result[1].labelBgStyle?.stroke).toBe(getFilterColor('video'));
    expect(result[1].labelStyle?.fill).toBe(getFilterColor('video'));
    expect(result[1].style).toBe(videoStyle);
    expect(result[1].className).toBe(MONITORED_PID_EDGE_CLASS);
    expect(result[1].zIndex).toBeGreaterThan(1000);
    expect(result[0]).toBe(edges[0]);
    expect(result[2]).toBe(edges[2]);
    expect(result[3]).toBe(edges[3]);
  });

  it('labels every edge leaving the monitored output PID', () => {
    const edges = makeEdges();
    const audioOutputTarget: PIDGraphTarget = {
      filterIdx: 5,
      direction: 'output',
      pidIndex: 0,
      infoLine: 'aac · 48.0 kHz',
    };
    const result = applyMonitoredPidEdges(edges, [
      videoInputTarget,
      audioOutputTarget,
    ]);

    expect(result[2].label).toBe('PID #0 | aac · 48.0 kHz');
    expect(result[3].label).toBe('PID #0 | aac · 48.0 kHz');
    expect(result[2].labelBgStyle?.stroke).toBe(getFilterColor('audio'));
    expect(result[0]).toBe(edges[0]);
  });

  it('falls back to the selection label without infoLine', () => {
    const result = applyMonitoredPidEdges(makeEdges(), [
      { filterIdx: 5, direction: 'input', pidIndex: 0, label: '#0·A·aac' },
    ]);

    expect(result[0].label).toBe('#0·A·aac');
  });
});
