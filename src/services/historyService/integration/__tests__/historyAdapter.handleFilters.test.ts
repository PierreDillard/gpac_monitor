import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { HistoryAdapter } from '../historyAdapter';
import type { HistoryFilter, HistorySnapshot, FiltersEvent } from '../../types';
import sessionStatsReducer from '@/shared/store/slices/sessionStatsSlice';
import graphReducer from '@/shared/store/slices/graphSlice';
import filterArgumentReducer from '@/shared/store/slices/filterArgumentSlice';

function makeStore() {
  return configureStore({
    reducer: {
      sessionStats: sessionStatsReducer,
      graph: graphReducer,
      filterArgument: filterArgumentReducer,
    },
  });
}

const makeFilter = (
  idx: number,
  argName: string,
  argValue: string,
): HistoryFilter => ({
  idx,
  name: `f${idx}`,
  type: 'filter',
  status: 'connected',
  nb_ipid: 0,
  nb_opid: 1,
  ipids: [],
  opids: [],
  gpac_args: [{ name: argName, value: argValue } as any],
});

const makeSnapshot = (filters: HistoryFilter[]): HistorySnapshot => ({
  version: 1,
  ts_us: 0,
  command_line: null,
  graph_v: 1,
  filters,
});

const makeFiltersEvent = (
  filters: HistoryFilter[],
  graphV = 2,
): FiltersEvent => ({
  version: 1,
  ts_us: 1000,
  message: 'filters',
  graph_v: graphV,
  filters,
});

describe('HistoryAdapter.handleFilters — arg state management', () => {
  it('seek removes stale args for deleted filter', () => {
    const store = makeStore();
    const adapter = new HistoryAdapter(store.dispatch);

    adapter.hydrate(
      makeSnapshot([
        makeFilter(0, 'src', 'a.mp4'),
        makeFilter(99, 'dst', 'b.mp4'),
      ]),
      0,
    );
    expect(store.getState().filterArgument.argsByFilter['99']).toBeDefined();

    adapter.handleEvent(makeFiltersEvent([makeFilter(0, 'src', 'a.mp4')]));

    const args = store.getState().filterArgument.argsByFilter;
    expect(args['0']).toBeDefined();
    expect(args['99']).toBeUndefined();
  });

  it('new graph replaces args entirely', () => {
    const store = makeStore();
    const adapter = new HistoryAdapter(store.dispatch);

    adapter.hydrate(
      makeSnapshot([
        makeFilter(0, 'src', 'a.mp4'),
        makeFilter(1, 'dst', 'b.mp4'),
      ]),
      0,
    );
    expect(store.getState().filterArgument.argsByFilter['0']).toBeDefined();
    expect(store.getState().filterArgument.argsByFilter['1']).toBeDefined();

    adapter.handleEvent(makeFiltersEvent([makeFilter(2, 'out', 'c.mp4')]));

    const args = store.getState().filterArgument.argsByFilter;
    expect(args['0']).toBeUndefined();
    expect(args['1']).toBeUndefined();
    expect(args['2']).toBeDefined();
  });
});
