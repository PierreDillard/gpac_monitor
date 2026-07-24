import { describe, it, expect } from 'vitest';
import { isStructuralEvent } from '../types';
import type { HistoryEvent } from '../types';

const makeEvent = (message: string): HistoryEvent =>
  ({ ts_us: 1000, message }) as unknown as HistoryEvent;

describe('isStructuralEvent', () => {
  it.each([
    'filters',
    'filter_args_update',
    'filter_pid_reconfigured',
    'filter_arg_updated',
  ])('returns true for structural message "%s"', (message) => {
    expect(isStructuralEvent(makeEvent(message))).toBe(true);
  });

  it.each(['session_stats', 'cpu_stats'])(
    'returns false for non-structural message "%s"',
    (message) => {
      expect(isStructuralEvent(makeEvent(message))).toBe(false);
    },
  );
});
