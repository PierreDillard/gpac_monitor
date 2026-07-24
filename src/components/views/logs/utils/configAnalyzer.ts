import {
  GpacLogLevel,
  GpacLogTool,
  LogLevelUtils,
} from '@/types/domain/gpac/log-types';

/**
 * Determine if any config change requires a backend call
 * @param changes - Array of config changes
 * @param defaultAllLevel - Default level for 'all' tool
 * @param lastSentLevelsByTool - Last sent levels to backend
 * @returns { needsBackend: boolean, backendOnlyChanges: string, reason: string }
 */
export function analyzeConfigChanges(
  changes: Array<{ tool: string; level: GpacLogLevel }>,
  defaultAllLevel: GpacLogLevel,
  lastSentLevelsByTool: Partial<Record<GpacLogTool, GpacLogLevel>>,
) {
  const backendRequiredChanges: string[] = [];
  let reason = '';

  for (const change of changes) {
    const { tool, level } = change;

    // Get the backend's current level for this tool
    // This is what the backend actually has configured and is collecting
    const backendCurrentLevel =
      tool === 'all'
        ? defaultAllLevel
        : lastSentLevelsByTool[tool as GpacLogTool] || defaultAllLevel;

    // Check if this change requires a backend call
    // We need backend call if requested level > what backend currently collects
    const needsBackendForThisChange = LogLevelUtils.needsBackendCall(
      backendCurrentLevel,
      level,
    );

    if (needsBackendForThisChange) {
      backendRequiredChanges.push(`${tool}@${level}`);
      if (!reason) {
        reason = `${tool}@${level} requires more verbosity than backend's current ${tool}@${backendCurrentLevel}`;
      }
    }
  }

  return {
    needsBackend: backendRequiredChanges.length > 0,
    backendOnlyChanges: backendRequiredChanges.join(':'),
    reason,
  };
}
