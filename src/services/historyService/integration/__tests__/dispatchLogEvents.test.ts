import { describe, it, expect, vi } from 'vitest';
import { dispatchLogEvents } from '../handlers/logHandler';
import type { LogEvent } from '../../types';
import type { GpacLogEntry } from '@/types/domain/gpac/log-types';

function makeLogLine(timestamp: number): GpacLogEntry {
  return {
    timestamp,
    tool: 'core',
    level: 1,
    message: `line at ${timestamp}`,
    thread_id: -1,
    caller: null,
  };
}

function makeLogBatchEvent(timestamp: number): LogEvent {
  return {
    message: 'log_batch',
    ts_us: timestamp,
    logs: [makeLogLine(timestamp)],
  };
}

describe('dispatchLogEvents', () => {
  it('dispatches every due log line in a single appendLogsForAllTools call', () => {
    const dispatch = vi.fn();
    const events = [
      makeLogBatchEvent(1),
      makeLogBatchEvent(2),
      makeLogBatchEvent(3),
    ];

    dispatchLogEvents(dispatch as any, events);

    const logDispatches = dispatch.mock.calls.filter(
      ([action]: any) => action.type === 'logs/appendLogsForAllTools',
    );
    expect(logDispatches).toHaveLength(1);
    expect(logDispatches[0][0].payload).toEqual([
      makeLogLine(1),
      makeLogLine(2),
      makeLogLine(3),
    ]);
  });

  it('flushes pending logs before an interleaved config change, then resumes accumulating', () => {
    const dispatch = vi.fn();
    const configEvent: LogEvent = {
      message: 'log_config_changed',
      ts_us: 2,
      logLevel: 'all@warning',
    };
    const events = [makeLogBatchEvent(1), configEvent, makeLogBatchEvent(3)];

    dispatchLogEvents(dispatch as any, events);

    const dispatchedTypes = dispatch.mock.calls.map(
      ([action]: any) => action.type,
    );
    expect(dispatchedTypes).toEqual([
      'logs/appendLogsForAllTools',
      'logs/restoreConfig',
      'logs/appendLogsForAllTools',
    ]);
    expect(dispatch.mock.calls[0][0].payload).toEqual([makeLogLine(1)]);
    expect(dispatch.mock.calls[2][0].payload).toEqual([makeLogLine(3)]);
  });

  it('dispatches nothing for an empty event list', () => {
    const dispatch = vi.fn();

    dispatchLogEvents(dispatch as any, []);

    expect(dispatch).not.toHaveBeenCalled();
  });
});
