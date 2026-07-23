import {
  GpacLogLevel,
  GpacLogTool,
  LOG_LEVEL_VALUES,
} from '@/types/domain/gpac/log-types';

/**
 * Parse a log config change string to extract individual changes.
 * Entries without a valid level (e.g. "console" in a recorded CLI config)
 * are skipped instead of producing an undefined level.
 * @param configString - Format: "all@info:core@debug:mmio@warning"
 * @returns Array of parsed config changes
 */
export function parseConfigChanges(
  configString: string,
): Array<{ tool: GpacLogTool; level: GpacLogLevel }> {
  if (!configString.trim()) return [];

  return configString
    .split(':')
    .map((config) => {
      const [tool, level] = config.split('@');
      return { tool: tool as GpacLogTool, level: level as GpacLogLevel };
    })
    .filter((entry) => entry.tool && entry.level in LOG_LEVEL_VALUES);
}
