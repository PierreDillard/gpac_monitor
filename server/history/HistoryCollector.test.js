import { describe, it, expect, vi } from 'vitest';
import { Sys as sys } from 'gpaccore';
import { HistoryCollector } from './HistoryCollector.js';

const DAY_US = 24 * 60 * 60 * 1000 * 1000;

function makeCollector() {
  const collector = new HistoryCollector('test-history');
  collector.writer.writeLog = vi.fn();
  collector.writer.recordJournalFact = vi.fn();
  return collector;
}

describe('HistoryCollector args-change indexing', () => {
  it('emits a single args-change index when one live arg update goes through both record paths', () => {
    const collector = makeCollector();
    collector.writer.addEventIndex = vi.fn();
    collector.writer.writeEvent = vi.fn(() => false);

    collector.recordFilterArgsUpdate(3, 'fullscreen', 'true');
    collector.recordArgUpdated([3], { 3: [{ name: 'fullscreen', value: 'true' }] });

    expect(collector.writer.addEventIndex).toHaveBeenCalledTimes(1);
    expect(collector.writer.addEventIndex).toHaveBeenCalledWith(expect.any(Number), 'args-change');
  });

  it('still writes the filter_args_update event on the command path, without indexing it', () => {
    const collector = makeCollector();
    collector.writer.addEventIndex = vi.fn();
    collector.writer.writeEvent = vi.fn(() => false);

    collector.recordFilterArgsUpdate(3, 'fullscreen', 'true');

    expect(collector.writer.addEventIndex).not.toHaveBeenCalled();
    expect(collector.writer.writeEvent).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(collector.writer.writeEvent.mock.calls[0][0]);
    expect(payload.message).toBe('filter_args_update');
    expect(payload.payload).toEqual({ filter_idx: 3, arg_name: 'fullscreen', value: 'true' });
  });
});

describe('HistoryCollector flushLogs', () => {
  it('records an error fact using the log line\'s own timestamp, not the flush-time clock', () => {
    const collector = makeCollector();

    // real bug report line: batch flushed at ts_us=1533744, but this line
    // was actually captured at timestamp=1523463
    collector.pendingLogs = [
      { timestamp: 1523463, tool: 'core', level: 1, message: 'Unsupported audio format 0', thread_id: -680877248, caller: null },
    ];

    collector.flushLogs();

    expect(collector.writer.recordJournalFact).toHaveBeenCalledWith(1523463, 1);
  });

  it('records each error/warning individually when a batch holds several, no aggregation', () => {
    const collector = makeCollector();

    // same batch as the real bug report: two errors (level 1) + one warning (level 2)
    collector.pendingLogs = [
      { timestamp: 1523463, tool: 'core', level: 1, message: 'Unsupported audio format 0', thread_id: -680877248, caller: null },
      { timestamp: 1523478, tool: 'core', level: 2, message: 'Unsupported cicp audio layout for channel layout 0', thread_id: -680877248, caller: null },
      { timestamp: 1527685, tool: 'core', level: 1, message: 'Unsupported audio format 0', thread_id: -680877248, caller: null },
    ];

    collector.flushLogs();

    expect(collector.writer.recordJournalFact).toHaveBeenCalledTimes(3);
    expect(collector.writer.recordJournalFact).toHaveBeenNthCalledWith(1, 1523463, 1);
    expect(collector.writer.recordJournalFact).toHaveBeenNthCalledWith(2, 1523478, 2);
    expect(collector.writer.recordJournalFact).toHaveBeenNthCalledWith(3, 1527685, 1);
  });

  it('ignores info-level logs, never recording a journal fact for them', () => {
    const collector = makeCollector();

    collector.pendingLogs = [
      { timestamp: 1523463, tool: 'core', level: 0, message: 'some info line', thread_id: -680877248, caller: null },
    ];

    collector.flushLogs();

    expect(collector.writer.recordJournalFact).not.toHaveBeenCalled();
  });
});

describe('HistoryCollector rollover snapshot reseed', () => {
  it('updates _graphVersion at the very start of recordGraph', () => {
    const collector = makeCollector();
    collector.writer.addEventIndex = vi.fn();
    collector.writer.writeEvent = vi.fn(() => false);
    collector.writer.writeSnapshot = vi.fn();

    collector.recordGraph([], [], 7);

    expect(collector._graphVersion).toBe(7);
  });

  it('builds the rollover snapshot from SnapshotBuilder with the current graphVersion, overriding ts_us', () => {
    const collector = makeCollector();
    collector._graphVersion = 3;
    collector.snapshotBuilder.build = vi.fn(() => ({
      version: 1, ts_us: 999, command_line: null, graph_v: 3, filters: [], session_metrics: null,
    }));

    const snapshot = collector._buildRolloverSnapshot(123456);

    expect(collector.snapshotBuilder.build).toHaveBeenCalledWith(3, null);
    expect(snapshot.ts_us).toBe(123456);
  });

  it('is unaffected by pending arg_state or checkpoints when producing the rollover snapshot', () => {
    const collector = makeCollector();
    collector._graphVersion = 2;
    collector._currentArgState = { 3: [{ name: 'x', value: 'changed' }] };
    collector._latestStructural = { version: 1, graph_v: 2, filters: [] };
    collector._currentPidState = {};
    collector.snapshotBuilder.build = vi.fn(() => ({
      version: 1, ts_us: 0, command_line: null, graph_v: 2, filters: [], session_metrics: null,
    }));

    collector._buildRolloverSnapshot(999);

    expect(collector.snapshotBuilder.build).toHaveBeenCalledWith(2, null);
    expect(collector.snapshotBuilder.build).toHaveBeenCalledTimes(1);
  });

  it('writes the rollover snapshot before publishing the new session.json', () => {
    const collector = makeCollector();
    collector._graphVersion = 5;
    const order = [];
    collector.snapshotBuilder.build = vi.fn(() => {
      order.push('buildSnapshot');
      return { version: 1, ts_us: 0, command_line: null, graph_v: 5, filters: [], session_metrics: null };
    });

    collector.writer.writeEvent('{"a":1}', 0);
    const originalWriteSessionIndex = collector.writer.writeSessionIndex.bind(collector.writer);
    collector.writer.writeSessionIndex = () => { order.push('writeSessionIndex'); originalWriteSessionIndex(); };

    collector.writer.writeEvent('{"a":2}', DAY_US);

    expect(order).toEqual(['buildSnapshot', 'writeSessionIndex']);
  });

  it('also reseeds the snapshot when the rollover boundary is crossed via writeLog', () => {
    const collector = new HistoryCollector('test-history');
    collector.snapshotBuilder.build = vi.fn(() => ({
      version: 1, ts_us: 0, command_line: null, graph_v: 0, filters: [], session_metrics: null,
    }));

    collector.writer.writeLog('{"a":1}', 0);
    collector.writer.writeLog('{"a":2}', DAY_US);

    expect(collector.snapshotBuilder.build).toHaveBeenCalledTimes(1);
  });

  it('does not rebuild the snapshot on every write within the same segment, only at rollover', () => {
    const collector = makeCollector();
    collector.snapshotBuilder.build = vi.fn(() => ({
      version: 1, ts_us: 0, command_line: null, graph_v: 0, filters: [], session_metrics: null,
    }));

    collector.writer.writeEvent('{"a":1}', 0);
    collector.writer.writeEvent('{"a":2}', 1000);
    collector.writer.writeEvent('{"a":3}', 2000);

    expect(collector.snapshotBuilder.build).not.toHaveBeenCalled();
  });

  it('uses the fresh graphVersion when recordGraph itself triggers the rollover', () => {
    const collector = makeCollector();
    collector.writer.writeEvent('{"a":1}', 0);
    collector.snapshotBuilder.build = vi.fn((graphVersion) => ({
      version: 1, ts_us: 0, command_line: null, graph_v: graphVersion, filters: [], session_metrics: null,
    }));

    const clockSpy = vi.spyOn(sys, 'clock_us').mockReturnValue(DAY_US);
    collector.recordGraph([], [], 42);
    clockSpy.mockRestore();

    expect(collector.snapshotBuilder.build).toHaveBeenCalledWith(42, null);
  });
});
