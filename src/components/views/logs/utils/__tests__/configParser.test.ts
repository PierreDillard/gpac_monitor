import { describe, it, expect } from 'vitest';
import { parseConfigChanges } from '../configParser';

// Real recorded snapshot log_config (server/rmt-log/2026-07-23_13-09-04):
// GPAC emits "console" without a level in sys.get_logs(true) output.
const RECORDED_CLI_CONFIG = 'all@warning:console:app@info';

describe('parseConfigChanges — recorded CLI config with level-less entry', () => {
  it('skips entries without a level instead of producing undefined', () => {
    const changes = parseConfigChanges(RECORDED_CLI_CONFIG);

    expect(changes).toEqual([
      { tool: 'all', level: 'warning' },
      { tool: 'app', level: 'info' },
    ]);
  });

  it('skips entries with an invalid level value', () => {
    const changes = parseConfigChanges('all@warning:core@bogus');

    expect(changes).toEqual([{ tool: 'all', level: 'warning' }]);
  });

  it('still parses a well-formed delta string', () => {
    const changes = parseConfigChanges('all@info:core@debug:mmio@warning');

    expect(changes).toEqual([
      { tool: 'all', level: 'info' },
      { tool: 'core', level: 'debug' },
      { tool: 'mmio', level: 'warning' },
    ]);
  });
});
