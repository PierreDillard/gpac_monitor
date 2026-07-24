import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { HistoryAdapter } from '../historyAdapter';
import type { HistoryCheckpoint } from '../historyAdapter';
import {
  toGraphFilterData,
  buildPidsByFilter,
} from '../../loader/snapshotHydrator';
import type { HistoryFilter, HistorySnapshot } from '../../types';
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

const baseFilter: HistoryFilter = {
  idx: 0,
  name: 'src',
  type: 'input',
  status: 'connected',
  nb_ipid: 0,
  nb_opid: 1,
  ipids: [],
  opids: [],
  gpac_args: [{ name: 'src', value: 'file.mp4' } as any],
};

const makeCheckpoint = (
  overrides?: Partial<HistoryCheckpoint>,
): HistoryCheckpoint => ({
  version: 1,
  ts_us: 5_000_000,
  graph_v: 1,
  filters: [baseFilter],
  ...overrides,
});

const makeSnapshot = (filters: HistoryFilter[]): HistorySnapshot => ({
  version: 1,
  ts_us: 0,
  command_line: null,
  graph_v: 1,
  filters,
});

describe('HistoryAdapter.hydrateCheckpoint', () => {
  let dispatch: ReturnType<typeof vi.fn>;
  let adapter: HistoryAdapter;

  beforeEach(() => {
    dispatch = vi.fn();
    adapter = new HistoryAdapter(dispatch as any);
  });

  it('dispatches clearGraph, filtersUpdated, clearFilterPids, setFilterPids', () => {
    const cp = makeCheckpoint();
    adapter.hydrateCheckpoint(cp);

    const types = dispatch.mock.calls.map(([action]: any) => action.type);
    expect(types).toContain('graph/clearGraph');
    expect(types).toContain('graph/filtersUpdated');
    expect(types).toContain('sessionStats/clearFilterPids');
    expect(types).toContain('sessionStats/setFilterPids');
  });

  it('dispatches clearGraph before filtersUpdated', () => {
    adapter.hydrateCheckpoint(makeCheckpoint());
    const types = dispatch.mock.calls.map(([action]: any) => action.type);
    expect(types.indexOf('graph/clearGraph')).toBeLessThan(
      types.indexOf('graph/filtersUpdated'),
    );
  });

  it('dispatches clearFilterPids before setFilterPids', () => {
    adapter.hydrateCheckpoint(makeCheckpoint());
    const types = dispatch.mock.calls.map(([action]: any) => action.type);
    expect(types.indexOf('sessionStats/clearFilterPids')).toBeLessThan(
      types.indexOf('sessionStats/setFilterPids'),
    );
  });

  it('passes transformed filters to filtersUpdated', () => {
    const cp = makeCheckpoint();
    adapter.hydrateCheckpoint(cp);
    const call = dispatch.mock.calls.find(
      ([action]: any) => action.type === 'graph/filtersUpdated',
    );
    expect(call?.[0].payload).toEqual(cp.filters.map(toGraphFilterData));
  });

  it('falls back to buildPidsByFilter(filters) when no pid_state', () => {
    const cp = makeCheckpoint();
    adapter.hydrateCheckpoint(cp);
    const call = dispatch.mock.calls.find(
      ([action]: any) => action.type === 'sessionStats/setFilterPids',
    );
    expect(call?.[0].payload).toEqual(buildPidsByFilter(cp.filters));
  });

  it('dispatches base args when no arg_state', () => {
    const store = makeStore();
    const a = new HistoryAdapter(store.dispatch);
    a.hydrate(makeSnapshot([baseFilter]), 0);

    a.hydrateCheckpoint(makeCheckpoint());

    expect(store.getState().filterArgument.argsByFilter).toEqual({
      '0': baseFilter.gpac_args,
    });
  });

  it('merges pid_state enum into ipids.properties', () => {
    const store = makeStore();
    const a = new HistoryAdapter(store.dispatch);

    const filterWithIpid: HistoryFilter = {
      ...baseFilter,
      properties: {
        ipids: {
          V1_0: {
            name: 'V1_0',
            codec: '264',
            type: 'Visual' as any,
            buffer: 0,
            eos: false,
            nb_pck_queued: null,
            would_block: null,
            playing: null,
            timescale: 12800,
            bitrate: 0,
            samplerate: null,
            channels: null,
            width: 1280,
            height: 720,
            pixelformat: null,
            source_idx: 0,
          },
        },
        opids: {},
      },
    };

    const pid_state = {
      '0': {
        V1_0: {
          CodecID: { name: 'CodecID', type: 'str' as any, value: '264' },
        },
      },
    };

    a.hydrateCheckpoint(
      makeCheckpoint({ filters: [filterWithIpid], pid_state }),
    );

    const ipid =
      store.getState().sessionStats.pidsByFilter['0']?.ipids?.['V1_0'];
    expect(ipid?.properties).toEqual(pid_state['0']['V1_0']);
    expect(ipid?.codec).toBe('264');
  });

  it('applies arg_state as delta over base args', () => {
    const store = makeStore();
    const a = new HistoryAdapter(store.dispatch);

    const filter1: HistoryFilter = {
      ...baseFilter,
      idx: 1,
      gpac_args: [{ name: 'dst', value: 'out.mp4' } as any],
    };
    a.hydrate(makeSnapshot([baseFilter, filter1]), 0);

    const arg_state = {
      '0': [{ name: 'src', value: 'file2.mp4' } as any],
    };
    a.hydrateCheckpoint(
      makeCheckpoint({ filters: [baseFilter, filter1], arg_state }),
    );

    const argsByFilter = store.getState().filterArgument.argsByFilter;
    expect(argsByFilter['0']).toEqual(arg_state['0']);
    expect(argsByFilter['1']).toEqual(filter1.gpac_args);
  });

  it('resets temporal state — no stats dispatched after checkpoint', () => {
    adapter.setSilent(true);
    adapter.hydrateCheckpoint(makeCheckpoint());
    dispatch.mockClear();

    adapter.flush();
    const statsTypes = dispatch.mock.calls
      .map(([action]: any) => action.type)
      .filter(
        (type: string) =>
          type.includes('bulkAdd') || type.includes('addNetworkDataPoint'),
      );
    expect(statsTypes).toHaveLength(0);
  });

  it('works with empty filters', () => {
    expect(() =>
      adapter.hydrateCheckpoint(makeCheckpoint({ filters: [] })),
    ).not.toThrow();
  });

  it('does not dispatch logs', () => {
    adapter.hydrateCheckpoint(makeCheckpoint());
    const logTypes = dispatch.mock.calls
      .map(([action]: any) => action.type)
      .filter((type: string) => type.toLowerCase().includes('log'));
    expect(logTypes).toHaveLength(0);
  });

  it('does not dispatch stats (bandwidth, cpu)', () => {
    adapter.hydrateCheckpoint(makeCheckpoint());
    const statsTypes = dispatch.mock.calls
      .map(([action]: any) => action.type)
      .filter(
        (type: string) =>
          type.includes('NetworkData') || type.includes('SystemStats'),
      );
    expect(statsTypes).toHaveLength(0);
  });

  it('applies baseArgs + arg_state delta (unaffected filter preserved)', () => {
    const store = makeStore();
    const a = new HistoryAdapter(store.dispatch);

    const filterSpeed: HistoryFilter = {
      ...baseFilter,
      idx: 0,
      gpac_args: [{ name: 'speed', value: '1' } as any],
    };
    const filterMode: HistoryFilter = {
      ...baseFilter,
      idx: 1,
      gpac_args: [{ name: 'mode', value: 'auto' } as any],
    };
    a.hydrate(makeSnapshot([filterSpeed, filterMode]), 0);

    a.hydrateCheckpoint(
      makeCheckpoint({
        filters: [filterSpeed, filterMode],
        arg_state: { '0': [{ name: 'speed', value: '2' } as any] },
      }),
    );

    const args = store.getState().filterArgument.argsByFilter;
    expect(args['0']).toEqual([{ name: 'speed', value: '2' } as any]);
    expect(args['1']).toEqual([{ name: 'mode', value: 'auto' } as any]);
  });

  it('backward seek without arg_state rolls back to baseArgs', () => {
    const store = makeStore();
    const a = new HistoryAdapter(store.dispatch);

    const filterSpeed: HistoryFilter = {
      ...baseFilter,
      gpac_args: [{ name: 'speed', value: '1' } as any],
    };
    a.hydrate(makeSnapshot([filterSpeed]), 0);

    a.hydrateCheckpoint(
      makeCheckpoint({
        filters: [filterSpeed],
        arg_state: { '0': [{ name: 'speed', value: '2' } as any] },
      }),
    );
    expect(store.getState().filterArgument.argsByFilter['0']).toEqual([
      { name: 'speed', value: '2' } as any,
    ]);

    a.hydrateCheckpoint(makeCheckpoint({ filters: [filterSpeed] }));
    const argsAfterRollback = store.getState().filterArgument.argsByFilter;
    expect(argsAfterRollback['0']).toEqual([
      { name: 'speed', value: '1' } as any,
    ]);
  });
});
