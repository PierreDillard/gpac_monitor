import { describe, it, expect } from 'vitest';
import { dispatchSessionStats } from '../handlers/statsHandler';
import type {
  CombinedBandwidthBuffer,
  PrevBandwidthState,
  PIDSamplesBuffer,
  StatusMetricSamplesBuffer,
} from '../handlers/statsHandler';
import type { PIDDynamicByFilter } from '../extractPIDDynamic';
import { buildStatusSamplesFromStats } from '@/utils/metrics/statusMetricGraph';
import { buildPIDSamplesFromFilterStats } from '@/utils/metrics/pidMetricGraph';
import {
  buildPerfSamplesFromStats,
  type PerfStatEntry,
} from '@/utils/metrics/perfMetricGraph';
import {
  addStatusMetricSamples,
  addPIDSamples,
  addCombinedNetworkPoint,
} from '@/shared/store/slices/monitoredFilterSlice';
import type { SessionStatsEvent } from '../../types';
import type { SessionFilterStatistics } from '@/types/domain/gpac/filter-stats';

const SESSION_START_US = 1_000_000;

const pid = (buffer: number, stats: Record<string, number>) =>
  ({ buffer, stats }) as unknown as SessionFilterStatistics['ipids'][string];

const makeEvent = (tsUs: number, bytes: number): SessionStatsEvent =>
  ({
    message: 'session_stats',
    all_packets_done: false,
    ts_us: tsUs,
    stats: [
      {
        idx: 0,
        status: 'fps=27.39 buffer=120/1094 ms',
        bytes_sent: bytes,
        bytes_done: bytes,
        last_task_time: 5,
        ipids: {
          V1_0: pid(40000, {
            average_bitrate: 966247,
            buffer_time: 40000,
            average_process_time: 4,
            average_process_rate: 0,
            last_process_time: 1445110,
          }),
        },
      },
      {
        idx: 1,
        status: '',
        bytes_sent: bytes * 2,
        bytes_done: bytes * 2,
        last_task_time: 0,
      },
    ] as unknown as SessionFilterStatistics[],
  }) as SessionStatsEvent;

function capture() {
  const actions: { type: string; payload: unknown }[] = [];
  const dispatch = ((action: { type: string; payload: unknown }) => {
    actions.push(action);
    return action;
  }) as never;
  return { actions, dispatch };
}

function run(
  dispatch: never,
  event: SessionStatsEvent,
  prevBandwidth: PrevBandwidthState,
) {
  return dispatchSessionStats(
    dispatch,
    event,
    SESSION_START_US,
    prevBandwidth,
    false,
    null,
    {} as CombinedBandwidthBuffer,
    [] as PIDSamplesBuffer,
    {} as PIDDynamicByFilter,
    [] as StatusMetricSamplesBuffer,
  );
}

describe('session_stats reuses shared builders (live==history parity)', () => {
  it('status samples == buildStatusSamplesFromStats', () => {
    const event = makeEvent(2_000_000, 1000);
    const { actions, dispatch } = capture();
    run(dispatch, event, {});

    const dispatched = actions.find(
      (action) => action.type === addStatusMetricSamples.type,
    )?.payload;
    expect(dispatched).toEqual(
      buildStatusSamplesFromStats(event.stats, event.ts_us, SESSION_START_US),
    );
  });

  it('pid samples == flatMap(buildPIDSamplesFromFilterStats)', () => {
    const event = makeEvent(2_000_000, 1000);
    const { actions, dispatch } = capture();
    run(dispatch, event, {});

    const dispatched = actions.find(
      (action) => action.type === addPIDSamples.type,
    )?.payload;
    expect(dispatched).toEqual(
      event.stats.flatMap((stat) =>
        buildPIDSamplesFromFilterStats(stat, event.ts_us, SESSION_START_US),
      ),
    );
  });

  it('network points == buildPerfSamplesFromStats with replay-owned prev', () => {
    const event1 = makeEvent(2_000_000, 1000);
    const event2 = makeEvent(3_000_000, 5000);
    const prevBandwidth: PrevBandwidthState = {};

    run(capture().dispatch, event1, prevBandwidth);

    const prevStats: Record<string, PerfStatEntry> = {};
    for (const stat of event1.stats) {
      prevStats[String(stat.idx)] = {
        idx: stat.idx,
        bytes_sent: stat.bytes_sent,
        bytes_done: stat.bytes_done,
      };
    }
    const expected = buildPerfSamplesFromStats(
      event2.stats as unknown as PerfStatEntry[],
      prevStats,
      event2.ts_us,
      event1.ts_us,
      SESSION_START_US,
    );

    const { actions, dispatch } = capture();
    run(dispatch, event2, prevBandwidth);
    const dispatched = actions
      .filter((action) => action.type === addCombinedNetworkPoint.type)
      .map((action) => action.payload);

    expect(dispatched).toEqual(expected);
  });
});
