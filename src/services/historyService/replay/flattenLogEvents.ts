import type { LogEvent } from '../types';

/**
 * Splits every log_batch into one single-entry log_batch per line, each
 * carrying that line's own timestamp instead of the batch's flush time.
 * Without this, seek/playback gate log visibility on the flush time of the
 * whole batch, which can be later than a specific line's own timestamp
 * (see EventJournal seeking to a log's exact instant).
 */
export function flattenLogEvents(logEvents: LogEvent[]): LogEvent[] {
  return logEvents.flatMap((event): LogEvent[] => {
    if (event.message !== 'log_batch') return [event];
    return event.logs.map(
      (log): LogEvent => ({
        message: 'log_batch',
        ts_us: log.timestamp,
        logs: [log],
      }),
    );
  });
}
