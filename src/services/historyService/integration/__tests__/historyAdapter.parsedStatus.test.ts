import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { HistoryAdapter } from '../historyAdapter';
import type {
  HistoryFilter,
  HistorySnapshot,
  SessionStatsEvent,
} from '../../types';
import type { SessionFilterStats } from '@/shared/store/slices/sessionStatsSlice';
import sessionStatsReducer from '@/shared/store/slices/sessionStatsSlice';
import monitoredFilterReducer from '@/shared/store/slices/monitoredFilterSlice';

function makeStore() {
  return configureStore({
    reducer: {
      sessionStats: sessionStatsReducer,
      monitoredFilter: monitoredFilterReducer,
    },
  });
}

const rawStatusOf = (store: ReturnType<typeof makeStore>, idx: number) =>
  store.getState().monitoredFilter.parsedStatusByFilterIdx[idx]?.raw;

const SNAPSHOT_STATUS = 'wait info="waiting for clock init"';
const PLAYED_STATUS = 'done r_pck=4454 r_bytes=51518908 ohead=0.04 %';

const mp4mxFilter: HistoryFilter = {
  idx: 8,
  name: 'mp4mx',
  type: 'output',
  status: SNAPSHOT_STATUS,
  nb_ipid: 1,
  nb_opid: 0,
  ipids: [],
  opids: [],
};

const makeSnapshot = (): HistorySnapshot => ({
  ts_us: 0,
  command_line: null,
  graph_v: 1,
  filters: [mp4mxFilter],
});

const makePlayedStatsEvent = (): SessionStatsEvent => ({
  ts_us: 31_777_251,
  message: 'session_stats',
  all_packets_done: true,
  stats: [
    {
      idx: 8,
      status: PLAYED_STATUS,
      bytes_done: 51_518_908,
      bytes_sent: 51_541_229,
      pck_sent: 4454,
      pck_done: 4454,
      nb_ipid: 1,
      nb_opid: 0,
      time: 0,
    } as SessionFilterStats,
  ],
});

describe('HistoryAdapter — parsedStatus is rebuilt from baseState', () => {
  it('hydrate exposes the snapshot filter status as parsedStatus', () => {
    const store = makeStore();
    const adapter = new HistoryAdapter(store.dispatch);

    adapter.hydrate(makeSnapshot(), 0);

    expect(rawStatusOf(store, 8)).toBe(SNAPSHOT_STATUS);
  });

  it('re-hydrating (seek back) drops a previously played status', () => {
    const store = makeStore();
    const adapter = new HistoryAdapter(store.dispatch);

    adapter.hydrate(makeSnapshot(), 0);
    adapter.handleEvent(makePlayedStatsEvent());
    expect(rawStatusOf(store, 8)).toBe(PLAYED_STATUS);

    adapter.hydrate(makeSnapshot(), 0);

    expect(rawStatusOf(store, 8)).toBe(SNAPSHOT_STATUS);
  });
});
