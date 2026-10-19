import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { HistoryAdapter } from '../historyAdapter';
import type { HistoryCheckpoint } from '../historyAdapter';
import type { HistorySnapshot } from '../../types';
import sessionStatsReducer from '@/shared/store/slices/sessionStatsSlice';
import graphReducer from '@/shared/store/slices/graphSlice';
import filterArgumentReducer from '@/shared/store/slices/filterArgumentSlice';
import monitoredFilterReducer from '@/shared/store/slices/monitoredFilterSlice';
import sessionDetailsReducer from '@/shared/store/slices/sessionDetailsSlice';
import logsReducer from '@/shared/store/slices/logsSlice';

function makeStore() {
  return configureStore({
    reducer: {
      sessionStats: sessionStatsReducer,
      graph: graphReducer,
      filterArgument: filterArgumentReducer,
      monitoredFilter: monitoredFilterReducer,
      sessionDetails: sessionDetailsReducer,
      logs: logsReducer,
    },
  });
}

const selectDefs = (store: ReturnType<typeof makeStore>) =>
  store.getState().sessionStats.metricDefinitions;

const makeSnapshot = (session_metrics?: string | null): HistorySnapshot => ({
  ts_us: 0,
  command_line: null,
  graph_v: 1,
  filters: [],
  session_metrics,
});

const makeCheckpoint = (metric_defs?: string | null): HistoryCheckpoint => ({
  ts_us: 1000,
  graph_v: 1,
  filters: [],
  metric_defs,
});

describe('HistoryAdapter — metricDefinitions from baseState', () => {
  it('hydrate dispatches definitions from snapshot.session_metrics', () => {
    const store = makeStore();
    const adapter = new HistoryAdapter(store.dispatch);

    adapter.hydrate(makeSnapshot('freg=rfnalu;NALU=NAL Units'), 0);

    expect(selectDefs(store)['NALU']).toBeDefined();
  });

  it('hydrate with null session_metrics leaves definitions empty', () => {
    const store = makeStore();
    const adapter = new HistoryAdapter(store.dispatch);

    adapter.hydrate(makeSnapshot(null), 0);

    expect(Object.keys(selectDefs(store))).toHaveLength(0);
  });

  it('hydrateCheckpoint dispatches definitions from checkpoint.metric_defs', () => {
    const store = makeStore();
    const adapter = new HistoryAdapter(store.dispatch);

    adapter.hydrate(makeSnapshot(null), 0);
    adapter.hydrateCheckpoint(
      makeCheckpoint('freg=mp4mx;fps=Frames Per Second;u=fps'),
    );

    expect(selectDefs(store)['fps']).toBeDefined();
  });

  it('seek (hydrateCheckpoint with superset) keeps definitions, never clears', () => {
    const store = makeStore();
    const adapter = new HistoryAdapter(store.dispatch);

    adapter.hydrate(makeSnapshot('freg=rfnalu;NALU=NAL Units'), 0);
    const superset = 'freg=rfnalu;NALU=NAL Units\nfreg=rfnalu;IDR=IDR slices';
    adapter.hydrateCheckpoint(makeCheckpoint(superset));

    expect(selectDefs(store)['NALU']).toBeDefined();
    expect(selectDefs(store)['IDR']).toBeDefined();
  });
});
