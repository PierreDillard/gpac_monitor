import { describe, it, expect, vi, beforeEach } from 'vitest';
import { store } from '@/shared/store';
import { createStoreCallbacks } from '../storeIntegration';
import { resetSessionStats } from '@/shared/store/slices/sessionStatsSlice';
import {
  resetAllData,
  clearAllPIDSamples,
  clearStatusMetricsByFilter,
} from '@/shared/store/slices/monitoredFilterSlice';
import type { GpacLogEntry } from '@/types/domain/gpac/log-types';

/** Real-ish payloads shaped like BaseMessageHandler.handleSessionStatsMessage/handleFilterStatsMessage output. */
const sessionStatsPayload1 = {
  ts_us: 1_237_805,
  stats: [
    {
      idx: 0,
      status: 'fps=25',
      bytes_done: 727528,
      bytes_sent: 727528,
      pck_sent: 167,
      pck_done: 167,
      time: 4967,
      nb_ipid: 2,
      nb_opid: 2,
    },
    {
      idx: 4,
      status: '',
      bytes_done: 5000,
      bytes_sent: 757176,
      pck_sent: 169,
      pck_done: 2,
      time: 3078,
      nb_ipid: 1,
      nb_opid: 2,
      is_eos: true,
    },
  ],
};

const sessionStatsPayload2 = {
  ts_us: 2_237_805,
  stats: [
    {
      idx: 0,
      status: 'fps=30',
      bytes_done: 1_455_056,
      bytes_sent: 1_455_056,
      pck_sent: 334,
      pck_done: 334,
      time: 9934,
      nb_ipid: 2,
      nb_opid: 2,
    },
    {
      idx: 4,
      status: '',
      bytes_done: 10_000,
      bytes_sent: 1_514_352,
      pck_sent: 338,
      pck_done: 4,
      time: 6156,
      nb_ipid: 1,
      nb_opid: 2,
      is_eos: true,
    },
  ],
};

const makePid = (name: string, averageBitrate: number) =>
  ({
    name,
    buffer: 1000,
    nb_pck_queued: 0,
    would_block: false,
    eos: false,
    bitrate: null,
    stats: {
      disconnected: false,
      average_process_rate: 10,
      max_process_rate: 20,
      average_bitrate: averageBitrate,
      max_bitrate: averageBitrate * 2,
      nb_processed: 100,
      max_process_time: 5,
      total_process_time: 50,
    },
  }) as any;

const filterStatsPayload1 = {
  idx: 2,
  ts_us: 500_000,
  bytes_sent: 100_000,
  bytes_done: 90_000,
  last_task_time: 12,
  ipids: { pid_in: makePid('pid_in', 5000) },
};

const filterStatsPayload2 = {
  idx: 2,
  ts_us: 600_000,
  bytes_sent: 150_000,
  bytes_done: 120_000,
  last_task_time: 8,
  ipids: { pid_in: makePid('pid_in', 6000) },
};

function actionsOfType(calls: unknown[][], type: string) {
  return calls.filter(([action]: any) => action.type === type);
}

describe('createStoreCallbacks (liveAdapter storeIntegration)', () => {
  const dispatchSpy = vi.spyOn(store, 'dispatch');

  beforeEach(() => {
    store.dispatch(resetSessionStats());
    store.dispatch(resetAllData());
    store.dispatch(clearAllPIDSamples());
    store.dispatch(clearStatusMetricsByFilter(0));
    store.dispatch(clearStatusMetricsByFilter(4));
    store.dispatch(clearStatusMetricsByFilter(2));
    dispatchSpy.mockClear();
  });

  describe('onUpdateSessionStats', () => {
    it('dispatches updateSessionStats and no network point on the first event (no prev reference)', () => {
      const callbacks = createStoreCallbacks();
      callbacks.onUpdateSessionStats(sessionStatsPayload1);

      const updateCalls = actionsOfType(
        dispatchSpy.mock.calls,
        'sessionStats/updateSessionStats',
      );
      expect(updateCalls).toHaveLength(1);
      expect((updateCalls[0][0] as any).payload).toEqual(sessionStatsPayload1);

      const networkCalls = actionsOfType(
        dispatchSpy.mock.calls,
        'monitoredFilter/addCombinedNetworkPoint',
      );
      expect(networkCalls).toHaveLength(0);
    });

    it('derives graphable status samples with sessionTimeUs = 0 on the first event', () => {
      const callbacks = createStoreCallbacks();
      callbacks.onUpdateSessionStats(sessionStatsPayload1);

      const statusCalls = actionsOfType(
        dispatchSpy.mock.calls,
        'monitoredFilter/addStatusMetricSamples',
      );
      expect(statusCalls).toHaveLength(1);
      const samples = (statusCalls[0][0] as any).payload;
      expect(samples).toContainEqual({
        key: '0:fps',
        sample: { sessionTimeUs: 0, value: 25 },
      });
    });

    it('dispatches one network point per filter from the second event, with sessionTimeUs relative to sessionStartUs', () => {
      const callbacks = createStoreCallbacks();
      callbacks.onUpdateSessionStats(sessionStatsPayload1);
      dispatchSpy.mockClear();

      callbacks.onUpdateSessionStats(sessionStatsPayload2);

      const networkCalls = actionsOfType(
        dispatchSpy.mock.calls,
        'monitoredFilter/addCombinedNetworkPoint',
      );
      expect(networkCalls).toHaveLength(2);

      const expectedSessionTimeUs =
        sessionStatsPayload2.ts_us - sessionStatsPayload1.ts_us;
      for (const [action] of networkCalls) {
        expect((action as any).payload.outband.timestamp).toBe(
          expectedSessionTimeUs,
        );
      }
    });
  });

  describe('onUpdateFilterStats', () => {
    it('seeds filterPrevPerf from the store on cold start, so a network point fires on the very first call', () => {
      const callbacks = createStoreCallbacks();
      // Simulate a session_stats tick that already ran for filter idx 2, before any filter_stats arrived.
      callbacks.onUpdateSessionStats({
        ts_us: 400_000,
        stats: [
          {
            idx: 2,
            status: '',
            bytes_done: 80_000,
            bytes_sent: 90_000,
            pck_sent: 1,
            pck_done: 1,
            time: 1,
            nb_ipid: 1,
            nb_opid: 1,
          },
        ],
      });
      dispatchSpy.mockClear();

      callbacks.onUpdateFilterStats(filterStatsPayload1);

      const networkCalls = actionsOfType(
        dispatchSpy.mock.calls,
        'monitoredFilter/addCombinedNetworkPoint',
      );
      expect(networkCalls).toHaveLength(1);

      const pidCalls = actionsOfType(
        dispatchSpy.mock.calls,
        'monitoredFilter/addPIDSamples',
      );
      expect(pidCalls).toHaveLength(1);
    });

    it('computes the perf delta between two consecutive filter_stats calls (no prior filter_stats for this idx)', () => {
      const callbacks = createStoreCallbacks();
      // Prime sessionStartUs only (no stats for idx 2), so buildPerfSamplesFromStats
      // has a session origin without pre-seeding filterPrevPerf from the store.
      callbacks.onUpdateSessionStats({ ts_us: 100_000, stats: [] });
      dispatchSpy.mockClear();

      callbacks.onUpdateFilterStats(filterStatsPayload1);
      const firstCallNetwork = actionsOfType(
        dispatchSpy.mock.calls,
        'monitoredFilter/addCombinedNetworkPoint',
      );
      expect(firstCallNetwork).toHaveLength(0); // no prev yet, only seeds filterPrevPerf
      dispatchSpy.mockClear();

      callbacks.onUpdateFilterStats(filterStatsPayload2);

      const networkCalls = actionsOfType(
        dispatchSpy.mock.calls,
        'monitoredFilter/addCombinedNetworkPoint',
      );
      expect(networkCalls).toHaveLength(1);

      const deltaSec =
        (filterStatsPayload2.ts_us - filterStatsPayload1.ts_us) / 1_000_000;
      const expectedOutband =
        (filterStatsPayload2.bytes_sent - filterStatsPayload1.bytes_sent) /
        deltaSec;
      const expectedInband =
        (filterStatsPayload2.bytes_done - filterStatsPayload1.bytes_done) /
        deltaSec;

      const payload = (networkCalls[0][0] as any).payload;
      expect(payload.outband.value).toBeCloseTo(expectedOutband);
      expect(payload.inband.value).toBeCloseTo(expectedInband);
    });

    it('does not dispatch a network point and does not throw when ts_us is missing', () => {
      const callbacks = createStoreCallbacks();
      const { ts_us: _omit, ...payloadWithoutTsUs } = filterStatsPayload1;

      expect(() =>
        callbacks.onUpdateFilterStats(payloadWithoutTsUs as any),
      ).not.toThrow();

      const networkCalls = actionsOfType(
        dispatchSpy.mock.calls,
        'monitoredFilter/addCombinedNetworkPoint',
      );
      expect(networkCalls).toHaveLength(0);
    });
  });

  describe('simple callbacks', () => {
    it('onPidReconfigured dispatches graph/markPidReconfigured with the given indexes', () => {
      const callbacks = createStoreCallbacks();
      callbacks.onPidReconfigured([3]);

      const calls = actionsOfType(
        dispatchSpy.mock.calls,
        'graph/markPidReconfigured',
      );
      expect(calls).toHaveLength(1);
      expect((calls[0][0] as any).payload).toEqual([3]);
    });

    it('onArgUpdated dispatches graph/markArgUpdated with the given indexes', () => {
      const callbacks = createStoreCallbacks();
      callbacks.onArgUpdated([7]);

      const calls = actionsOfType(
        dispatchSpy.mock.calls,
        'graph/markArgUpdated',
      );
      expect(calls).toHaveLength(1);
      expect((calls[0][0] as any).payload).toEqual([7]);
    });

    it('onFilterStatuses dispatches monitoredFilter/setParsedStatuses with parsed entries', () => {
      const callbacks = createStoreCallbacks();
      callbacks.onFilterStatuses([{ idx: 5, status: 'seg=3' }]);

      const calls = actionsOfType(
        dispatchSpy.mock.calls,
        'monitoredFilter/setParsedStatuses',
      );
      expect(calls).toHaveLength(1);
      const entries = (calls[0][0] as any).payload;
      expect(entries[0].filterIdx).toBe(5);
      expect(entries[0].parsedStatus.raw).toBe('seg=3');
    });

    it('onFilterStatuses skips re-parsing and does not dispatch when the raw status is unchanged', () => {
      const callbacks = createStoreCallbacks();
      callbacks.onFilterStatuses([{ idx: 5, status: 'seg=3' }]);
      dispatchSpy.mockClear();

      callbacks.onFilterStatuses([{ idx: 5, status: 'seg=3' }]);

      const calls = actionsOfType(
        dispatchSpy.mock.calls,
        'monitoredFilter/setParsedStatuses',
      );
      expect(calls).toHaveLength(0);
    });

    it('onFilterStatuses dispatches only the entries whose raw status changed', () => {
      const callbacks = createStoreCallbacks();
      callbacks.onFilterStatuses([
        { idx: 5, status: 'seg=3' },
        { idx: 6, status: '' },
      ]);
      dispatchSpy.mockClear();

      callbacks.onFilterStatuses([
        { idx: 5, status: 'seg=4' },
        { idx: 6, status: '' },
      ]);

      const calls = actionsOfType(
        dispatchSpy.mock.calls,
        'monitoredFilter/setParsedStatuses',
      );
      expect(calls).toHaveLength(1);
      const entries = (calls[0][0] as any).payload;
      expect(entries).toHaveLength(1);
      expect(entries[0].filterIdx).toBe(5);
      expect(entries[0].parsedStatus.raw).toBe('seg=4');
    });

    it('onLogsUpdate dispatches logs/appendLogsForAllTools with the given entries', () => {
      const callbacks = createStoreCallbacks();
      const logs: GpacLogEntry[] = [
        { timestamp: 1000, tool: 'core', level: 2, message: 'hello' },
      ];
      callbacks.onLogsUpdate(logs);

      const calls = actionsOfType(
        dispatchSpy.mock.calls,
        'logs/appendLogsForAllTools',
      );
      expect(calls).toHaveLength(1);
      expect((calls[0][0] as any).payload).toEqual(logs);
    });
  });
});
