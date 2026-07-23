import { createSelector } from '@reduxjs/toolkit';
import {
  selectLogsState,
  selectLevelsByTool,
  selectDefaultAllLevel,
} from './logsSelectors';

/** Generate GPAC log config string for backend communication (format: "core@info,demux@warning,all@quiet") */
/** Create logs config string with ALL changed values (for complete backend sync) */
export const selectLogsConfigString = createSelector(
  [selectLevelsByTool, selectDefaultAllLevel],
  (levelsByTool, defaultAllLevel): string => {
    const configs: string[] = [];

    // Add default level for 'all' FIRST to set the base
    configs.push(`all@${defaultAllLevel}`);

    // Then add tool-specific levels (they will override the default)
    Object.entries(levelsByTool).forEach(([tool, level]) => {
      configs.push(`${tool}@${level}`);
    });

    const result = configs.join(':');
    return result;
  },
);

/** Create optimized logs config string with ONLY changes from last sent config */
export const selectLogsConfigChanges = createSelector(
  [selectLogsState],
  (logsState): string => {
    const { levelsByTool, defaultAllLevel, lastSentConfig } = logsState;
    const configs: string[] = [];
    const isFirstConfig = lastSentConfig.defaultAllLevel === null;

    // Check if default level changed (null means no config sent yet)
    if (isFirstConfig || defaultAllLevel !== lastSentConfig.defaultAllLevel) {
      configs.push(`all@${defaultAllLevel}`);
    }

    // Check for changed tool levels
    Object.entries(levelsByTool).forEach(([tool, level]) => {
      const lastSentLevel =
        lastSentConfig.levelsByTool[
          tool as keyof typeof lastSentConfig.levelsByTool
        ];

      // First config: send ALL tools
      if (isFirstConfig) {
        configs.push(`${tool}@${level}`);
      }
      // Subsequent configs: only send changes
      else if (lastSentLevel !== undefined && level !== lastSentLevel) {
        configs.push(`${tool}@${level}`);
      }
      // New tool added after initial config
      else if (lastSentLevel === undefined) {
        configs.push(`${tool}@${level}`);
      }
    });

    // Check for removed tool levels (tools that were configured but now removed)
    if (!isFirstConfig) {
      Object.entries(lastSentConfig.levelsByTool).forEach(([tool, _]) => {
        if (!(tool in levelsByTool)) {
          // Tool was removed, reset it to default by sending all@level
          configs.push(`${tool}@${defaultAllLevel}`);
        }
      });
    }

    const result = configs.join(':');
    return result;
  },
);
