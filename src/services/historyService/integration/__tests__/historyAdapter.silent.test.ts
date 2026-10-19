import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HistoryAdapter } from '../historyAdapter';
import type {
  SessionStatsEvent,
  CpuStatsEvent,
  PidReconfiguredEvent,
} from '../../types';

/** Real-ish events derived from server/history/1774943115615/events.jsonl */
const sessionStatsEvent: SessionStatsEvent = {
  message: 'session_stats',
  ts_us: 1237805,
  all_packets_done: false,
  stats: [
    {
      idx: 0,
      status: '',
      bytes_done: 727528,
      bytes_sent: 727528,
      pck_sent: 167,
      pck_done: 167,
      time: 4967,
      nb_ipid: 2,
      nb_opid: 2,
      is_eos: false,
      last_ts_sent: { n: 73, d: 30 },
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
      last_ts_sent: { n: 78, d: 30 },
    },
  ],
};

/** Second tick — bandwidth is a rate, so it needs a previous reference. */
const sessionStatsEvent2: SessionStatsEvent = {
  message: 'session_stats',
  ts_us: 2237805,
  all_packets_done: false,
  stats: [
    {
      idx: 0,
      status: '',
      bytes_done: 1455056,
      bytes_sent: 1455056,
      pck_sent: 334,
      pck_done: 334,
      time: 9934,
      nb_ipid: 2,
      nb_opid: 2,
      is_eos: false,
      last_ts_sent: { n: 146, d: 30 },
    },
    {
      idx: 4,
      status: '',
      bytes_done: 10000,
      bytes_sent: 1514352,
      pck_sent: 338,
      pck_done: 4,
      time: 6156,
      nb_ipid: 1,
      nb_opid: 2,
      is_eos: true,
      last_ts_sent: { n: 156, d: 30 },
    },
  ],
};

const cpuStatsEvent: CpuStatsEvent = {
  message: 'cpu_stats',
  ts_us: 237464,
  stats: {
    total_cpu_usage: 0,
    process_cpu_usage: 8,
    process_memory: 102359040,
    physical_memory: 66624581632,
    physical_memory_avail: 27096256512,
    gpac_memory: 0,
    nb_cores: 20,
    thread_count: 0,
    memory_usage_percent: 59.33,
    process_memory_percent: 0.15,
    gpac_memory_percent: 0,
    cpu_efficiency: 0,
  },
};

describe('HistoryAdapter silent mode', () => {
  let dispatch: ReturnType<typeof vi.fn>;
  let adapter: HistoryAdapter;

  beforeEach(() => {
    dispatch = vi.fn();
    adapter = new HistoryAdapter(dispatch as any);
  });

  it('dispatches bandwidth immediately when not silent', () => {
    adapter.handleEvent(sessionStatsEvent); // seeds prev (no delta yet)
    adapter.handleEvent(sessionStatsEvent2); // now has a previous reference

    const bandwidthDispatches = dispatch.mock.calls.filter(
      ([action]: any) =>
        action.type === 'monitoredFilter/addCombinedNetworkPoint',
    );
    // 2 filters × 1 combined dispatch = 2 dispatches (from the second event)
    expect(bandwidthDispatches).toHaveLength(2);
  });

  it('buffers bandwidth when silent, dispatches bulk on flush', () => {
    adapter.setSilent(true);
    adapter.handleEvent(sessionStatsEvent); // seeds prev
    adapter.handleEvent(sessionStatsEvent2); // produces buffered bandwidth

    const bandwidthDispatches = dispatch.mock.calls.filter(
      ([action]: any) =>
        action.type === 'monitoredFilter/addCombinedNetworkPoint',
    );
    expect(bandwidthDispatches).toHaveLength(0);

    dispatch.mockClear();
    adapter.flush();

    const bulkDispatches = dispatch.mock.calls.filter(
      ([action]: any) => action.type === 'monitoredFilter/bulkAddNetworkData',
    );
    expect(bulkDispatches).toHaveLength(1);
    expect(bulkDispatches[0][0].payload).toMatchSnapshot();
  });

  it('dispatches cpu stats immediately when not silent', () => {
    adapter.handleEvent(cpuStatsEvent);

    const cpuDispatches = dispatch.mock.calls.filter(
      ([action]: any) => action.type === 'sessionDetails/setSystemStats',
    );
    expect(cpuDispatches).toHaveLength(1);
  });

  it('buffers cpu stats when silent, dispatches bulk on flush', () => {
    adapter.setSilent(true);
    adapter.handleEvent(cpuStatsEvent);

    const cpuDispatches = dispatch.mock.calls.filter(
      ([action]: any) => action.type === 'sessionDetails/setSystemStats',
    );
    expect(cpuDispatches).toHaveLength(0);

    dispatch.mockClear();
    adapter.flush();

    const bulkDispatches = dispatch.mock.calls.filter(
      ([action]: any) => action.type === 'sessionDetails/bulkAddSystemStats',
    );
    expect(bulkDispatches).toHaveLength(1);
    expect(bulkDispatches[0][0].payload).toMatchSnapshot();
  });

  it('dispatches setFilterPids on filter_pid_reconfigured (non-silent)', () => {
    const event: PidReconfiguredEvent = {
      message: 'filter_pid_reconfigured',
      ts_us: 1000,
      indexes: [3],
      pidsByFilter: { '3': { pid_a: { name: 'pid_a' } as any } },
    };
    adapter.handleEvent(event);

    const calls = dispatch.mock.calls.filter(
      ([action]: any) => action.type === 'sessionStats/setFilterPids',
    );
    expect(calls).toHaveLength(1);
    expect(calls[0][0].payload['3'].ipids).toBeDefined();
  });

  it('buffers filter_pid_reconfigured in silent mode, dispatches on flush', () => {
    adapter.setSilent(true);
    const event: PidReconfiguredEvent = {
      message: 'filter_pid_reconfigured',
      ts_us: 1000,
      indexes: [5],
      pidsByFilter: { '5': { pid_b: { name: 'pid_b' } as any } },
    };
    adapter.handleEvent(event);

    const beforeFlush = dispatch.mock.calls.filter(
      ([action]: any) => action.type === 'sessionStats/setFilterPids',
    );
    expect(beforeFlush).toHaveLength(0);

    dispatch.mockClear();
    adapter.flush();

    const afterFlush = dispatch.mock.calls.filter(
      ([action]: any) => action.type === 'sessionStats/setFilterPids',
    );
    expect(afterFlush).toHaveLength(1);
    expect(afterFlush[0][0].payload['5'].ipids).toBeDefined();
  });

  it('resets silent mode after flush', () => {
    adapter.setSilent(true);
    adapter.handleEvent(sessionStatsEvent); // buffered, seeds prev
    adapter.flush();

    dispatch.mockClear();
    adapter.handleEvent(sessionStatsEvent2); // non-silent, prev exists → dispatches

    const bandwidthDispatches = dispatch.mock.calls.filter(
      ([action]: any) =>
        action.type === 'monitoredFilter/addCombinedNetworkPoint',
    );
    expect(bandwidthDispatches).toHaveLength(2);
  });
});
